import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Boutique from '../models/Boutique.js';
import Product from '../models/Product.js';
import { repartirCommission } from './commissionService.js';

// [DURCISSEMENT IDEMPOTENCE] Un index unique en base (voir
// models/WalletTransaction.js) rend un doublon impossible pour
// vente/liberation/annulation/retour, même en cas de course entre deux
// requêtes concurrentes. Si on le heurte malgré le exists() préalable, ce
// n'est pas une erreur métier : une autre requête a gagné la course et a
// déjà fait le travail — on l'ignore silencieusement plutôt que de renvoyer
// une 500 au client.
const estDoublonIgnorable = (erreur) => erreur?.code === 11000;

// Mouvements d'argent des portefeuilles commerçants.
//
// Tout est concentré ici parce que c'est le seul endroit du projet où une
// erreur coûte littéralement de l'argent. Deux principes tiennent ce module :
//
//   1. IDEMPOTENCE — chaque opération vérifie qu'elle n'a pas déjà eu lieu
//      avant d'écrire. Un double clic, un retry réseau ou une commande
//      repassée deux fois au même statut ne doivent jamais créditer deux fois.
//
//   2. TRAÇABILITÉ — aucun solde n'est modifié « à la main ». On écrit des
//      transactions, puis on recalcule les soldes depuis elles. Un solde
//      faux est donc toujours réparable.

/**
 * Répartit les articles d'une commande par boutique.
 * Les articles sans boutique (catalogue principal) sont ignorés : ils
 * appartiennent à la plateforme, aucun portefeuille à créditer.
 *
 * Fonction PURE, testable sans base : voir tests/walletService.test.js.
 *
 * @param {Array} items - items de la commande
 * @param {Map<string,string|null>} boutiqueParProduit - produit -> boutique
 * @returns {Map<string, {montant:number, nombreArticles:number}>}
 */
export const repartirParBoutique = (items = [], boutiqueParProduit = new Map()) => {
    const parBoutique = new Map();

    for (const item of items || []) {
        // Les lignes explicitement indisponibles ne génèrent jamais de dette
        // commerçant ni de libération. Les anciennes commandes sans champ
        // availabilityStatus restent traitées comme disponibles.
        if (item?.availabilityStatus === 'unavailable') continue;
        const produitId = item?.product?.toString?.() ?? String(item?.product ?? '');
        // La boutique enregistrée SUR la ligne de commande fait foi : elle
        // fige la situation au moment de l'achat. Si le vendeur réaffecte
        // l'article plus tard, la vente reste due à la boutique d'origine.
        const boutiqueId = item?.boutiqueId?.toString?.()
            ?? boutiqueParProduit.get(produitId)
            ?? null;

        if (!boutiqueId) continue;

        const montantLigne = (Number(item.priceAtOrder) || 0) * (Number(item.quantity) || 0);
        const courant = parBoutique.get(boutiqueId) || { montant: 0, nombreArticles: 0 };
        courant.montant += montantLigne;
        courant.nombreArticles += 1;
        parBoutique.set(boutiqueId, courant);
    }

    return parBoutique;
};

/** Charge la correspondance produit -> boutique pour des articles donnés. */
const chargerBoutiquesDesProduits = async (items) => {
    const ids = [...new Set((items || []).map((i) => i.product?.toString()).filter(Boolean))];
    if (ids.length === 0) return new Map();

    const produits = await Product.find({ _id: { $in: ids } }).select('boutiqueId').lean();
    return new Map(produits.map((p) => [p._id.toString(), p.boutiqueId ? p.boutiqueId.toString() : null]));
};

/** Portefeuille du propriétaire d'une boutique (créé si absent). */
const portefeuilleDeLaBoutique = async (boutiqueId) => {
    const boutique = await Boutique.findById(boutiqueId).select('ownerId nom').lean();
    if (!boutique?.ownerId) return null;

    let wallet = await Wallet.findOne({ ownerId: boutique.ownerId });
    if (!wallet) {
        wallet = await Wallet.create({ ownerId: boutique.ownerId, solde: 0, soldeEnAttente: 0 });
    }
    return { wallet, boutique };
};

/**
 * Crédite le solde EN ATTENTE de chaque boutique concernée, dès la commande.
 *
 * C'est ce qui permet au commerçant de VOIR son argent avant de remettre le
 * colis — sans pouvoir encore le retirer.
 *
 * Idempotent : une commande déjà créditée pour une boutique ne l'est pas
 * une seconde fois.
 *
 * @returns {Promise<{creditees:number, montantTotal:number}>}
 */
export const crediterVenteEnAttente = async (order) => {
    if (!order?.items?.length) return { creditees: 0, montantTotal: 0 };

    const boutiqueParProduit = await chargerBoutiquesDesProduits(order.items);
    const parBoutique = repartirParBoutique(order.items, boutiqueParProduit);

    let creditees = 0;
    let montantTotal = 0;

    for (const [boutiqueId, data] of parBoutique) {
        if (data.montant <= 0) continue;

        const dejaCredite = await WalletTransaction.exists({
            orderId: order._id,
            boutiqueId,
            type: 'vente',
        });
        if (dejaCredite) continue;

        const cible = await portefeuilleDeLaBoutique(boutiqueId);
        if (!cible) continue;

        // La commission de la plateforme est retirée AVANT le crédit : le
        // portefeuille du commerçant ne contient que ce qui lui revient
        // réellement. Il ne voit jamais le prix affiché au client, ce qui
        // évite toute ambiguïté au moment du retrait.
        const { net, commission } = repartirCommission(data.montant);
        if (net <= 0) continue;

        try {
            await WalletTransaction.create({
                walletId: cible.wallet._id,
                type: 'vente',
                compte: 'en_attente',
                montant: net,
                orderId: order._id,
                boutiqueId,
                description: `Vente — ${data.nombreArticles} article(s)`,
                // Trace de la commission : permet de justifier l'écart entre
                // le prix payé par le client et le montant crédité, sans
                // recalcul.
                montantBrut: data.montant,
                commission,
            });
        } catch (erreur) {
            if (!estDoublonIgnorable(erreur)) throw erreur;
            continue;
        }

        await cible.wallet.recalculerSoldes();
        creditees += 1;
        montantTotal += net;
    }

    return { creditees, montantTotal };
};

/**
 * Libère les fonds : transfert « en attente » -> « disponible ».
 * Déclenché par la validation de l'admin, une fois tous les commerçants
 * confirmés.
 *
 * Écrit DEUX transactions par boutique (sortie puis entrée) : l'argent ne
 * peut ni se dupliquer ni s'évaporer, et l'opération est relisible.
 *
 * Idempotent : une commande déjà libérée ne l'est pas deux fois.
 */
export const libererFonds = async (order) => {
    if (!order?.items?.length) return { liberees: 0, montantTotal: 0 };

    // Verrou métier : les fonds ne sont libérables qu'après réception
    // complète en entrepôt et passage explicite de la commande à Shipped.
    if (order.status !== 'Shipped') {
        return { liberees: 0, montantTotal: 0, blocked: true, reason: 'La commande doit être Shipped avant libération.' };
    }

    const boutiqueParProduit = await chargerBoutiquesDesProduits(order.items);
    const parBoutique = repartirParBoutique(order.items, boutiqueParProduit);

    let liberees = 0;
    let montantTotal = 0;

    for (const [boutiqueId, data] of parBoutique) {
        if (data.montant <= 0) continue;

        const dejaLibere = await WalletTransaction.exists({
            orderId: order._id,
            boutiqueId,
            type: 'liberation',
        });
        if (dejaLibere) continue;

        // On ne libère que ce qui a effectivement été mis en attente : sans
        // ce garde-fou, une commande créditée avant la mise en place du
        // système produirait de l'argent à partir de rien.
        const creditEnAttente = await WalletTransaction.exists({
            orderId: order._id,
            boutiqueId,
            type: 'vente',
            compte: 'en_attente',
        });
        if (!creditEnAttente) continue;

        const cible = await portefeuilleDeLaBoutique(boutiqueId);
        if (!cible) continue;

        // On libère EXACTEMENT ce qui a été mis en attente (net de
        // commission) : relire le crédit d'origine évite tout écart si le
        // taux de commission venait à changer entre-temps.
        const credit = await WalletTransaction.findOne({
            orderId: order._id, boutiqueId, type: 'vente', compte: 'en_attente',
        }).select('montant').lean();
        const montantNet = credit?.montant ?? repartirCommission(data.montant).net;
        if (montantNet <= 0) continue;

        try {
            // Sortie du compte en attente
            await WalletTransaction.create({
                walletId: cible.wallet._id,
                type: 'liberation',
                compte: 'en_attente',
                montant: -montantNet,
                orderId: order._id,
                boutiqueId,
                description: 'Libération — sortie du solde en attente',
            });

            // Entrée sur le compte disponible
            await WalletTransaction.create({
                walletId: cible.wallet._id,
                type: 'liberation',
                compte: 'disponible',
                montant: montantNet,
                orderId: order._id,
                boutiqueId,
                description: 'Libération — fonds retirables',
            });
        } catch (erreur) {
            if (!estDoublonIgnorable(erreur)) throw erreur;
            await cible.wallet.recalculerSoldes();
            continue;
        }

        await cible.wallet.recalculerSoldes();
        liberees += 1;
        montantTotal += montantNet;
    }

    return { liberees, montantTotal };
};

/**
 * Reprend un crédit encore EN ATTENTE (commande annulée ou retournée).
 * Ne touche jamais au solde disponible : de l'argent déjà libéré, voire
 * déjà retiré, ne se reprend pas unilatéralement — cela relève d'un
 * ajustement manuel décidé par l'admin.
 *
 * [CORRECTION FINALE] On annule exactement le montant NET qui a été crédité,
 * et on s'assure que la transaction est bien sur le compte 'en_attente'.
 */
export const annulerVenteEnAttente = async (order) => {
    if (!order?.items?.length) return { annulees: 0 };

    const boutiqueParProduit = await chargerBoutiquesDesProduits(order.items);
    const parBoutique = repartirParBoutique(order.items, boutiqueParProduit);

    let annulees = 0;

    for (const [boutiqueId, data] of parBoutique) {
        if (data.montant <= 0) continue;

        // Vérifier si les fonds ont déjà été libérés
        const dejaLibere = await WalletTransaction.exists({
            orderId: order._id,
            boutiqueId,
            type: 'liberation',
        });
        if (dejaLibere) continue; // Ne pas annuler si déjà libéré

        // Récupérer le crédit en attente pour connaître le montant NET exact
        const creditEnAttente = await WalletTransaction.findOne({
            orderId: order._id,
            boutiqueId,
            type: 'vente',
            compte: 'en_attente',
        }).select('montant').lean();

        if (!creditEnAttente) continue; // Pas de crédit en attente

        // Vérifier si déjà annulé
        const dejaAnnule = await WalletTransaction.exists({
            orderId: order._id,
            boutiqueId,
            type: 'annulation',
        });
        if (dejaAnnule) continue;

        const cible = await portefeuilleDeLaBoutique(boutiqueId);
        if (!cible) continue;

        try {
            await WalletTransaction.create({
                walletId: cible.wallet._id,
                type: 'annulation',
                compte: 'en_attente', // <-- ESSENTIEL : sur le compte en attente
                montant: -creditEnAttente.montant, // <-- montant net exact
                orderId: order._id,
                boutiqueId,
                description: 'Commande annulée — crédit repris',
            });
        } catch (erreur) {
            if (!estDoublonIgnorable(erreur)) throw erreur;
            continue;
        }

        await cible.wallet.recalculerSoldes();
        annulees += 1;
    }

    return { annulees };
};

/**
 * Réintègre au stock les articles d'une boutique pour une commande donnée.
 * Même logique de correspondance variante (couleur/taille) que
 * confirmerCommandeCommercant, pour rester cohérent avec le seul autre
 * endroit du code qui réincrémente déjà du stock.
 *
 * Les lignes 'unavailable' sont exclues : un article jamais réellement
 * vendu (le commerçant l'avait déjà signalé indisponible) n'a rien à
 * réintégrer, son stock n'a jamais bougé.
 *
 * PURE côté logique, mais fait des I/O (lecture + sauvegarde Produit) —
 * volontairement séparée de traiterRetourColis pour rester lisible et
 * réutilisable si un futur flux de retour partiel en a besoin.
 */
const restockerArticlesBoutique = async (order, boutiqueId) => {
    const items = (order.items || []).filter((item) => {
        if (item?.availabilityStatus === 'unavailable') return false;
        const itemBoutiqueId = item?.boutiqueId?.toString?.() ?? String(item?.boutiqueId ?? '');
        return itemBoutiqueId === String(boutiqueId);
    });
    if (!items.length) return 0;

    const products = await Product.find({ _id: { $in: items.map((i) => i.product) } });
    let restockes = 0;

    for (const item of items) {
        const product = products.find((p) => p._id.toString() === item.product.toString());
        if (!product) continue;

        if (product.variants?.length) {
            const variant = product.variants.find((v) =>
                (item.color == null ? v.color == null : v.color === item.color) &&
                (item.size == null ? v.size == null : v.size === item.size)
            );
            if (!variant) continue;
            variant.stock = Number(variant.stock || 0) + Number(item.quantity || 0);
            product.inStock = product.variants.some((v) => Number(v.stock || 0) > 0);
        } else if (product.stock !== null && product.stock !== undefined) {
            product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
            product.inStock = product.stock > 0;
        } else {
            continue;
        }

        await product.save();
        restockes += 1;
    }

    return restockes;
};

/**
 * COLIS RETOURNÉ — reprend l'argent d'une vente, où qu'il se trouve, et
 * réintègre le stock si l'article revient en état revendable.
 *
 * Trois situations pour l'argent, traitées dans cet ordre :
 *   1. les fonds sont encore EN ATTENTE  -> on les reprend là ;
 *   2. ils ont été LIBÉRÉS mais pas retirés -> on les reprend au disponible ;
 *   3. ils ont déjà été RETIRÉS -> le solde disponible passe en NÉGATIF.
 *
 * Le cas 3 est volontaire. Plafonner à zéro effacerait la dette : la
 * plateforme perdrait la somme sans trace, et le commerçant repartirait à
 * zéro au prochain retrait. Un solde négatif se résorbe naturellement avec
 * les ventes suivantes, et reste visible de tous en attendant.
 *
 * @param {object} order
 * @param {object} [options]
 * @param {string[]|null} [options.boutiqueIds] - limite le retour à ces boutiques
 * @param {'bon_etat'|'endommage'} [options.etat] - état constaté du colis.
 *   'bon_etat' (par défaut) réintègre le stock ; 'endommage' reprend
 *   l'argent SANS toucher au stock (article mis au rebut).
 *
 * Idempotent : un retour déjà traité (argent ET stock) ne l'est pas deux
 * fois — le restockage est fait dans le MÊME bloc que la création de la
 * transaction 'retour', protégée par l'index unique en base. Si la
 * transaction existe déjà (dejaRepris) ou heurte le doublon (code 11000),
 * on ne restocke pas non plus : sinon un retry créditerait le stock deux
 * fois sans reprendre l'argent une seconde fois.
 */
export const traiterRetourColis = async (order, { boutiqueIds = null, etat = 'bon_etat' } = {}) => {
    if (!order?.items?.length) return { boutiques: 0, montantRepris: 0, articlesRestockes: 0 };

    const boutiqueParProduit = await chargerBoutiquesDesProduits(order.items);
    const parBoutique = repartirParBoutique(order.items, boutiqueParProduit);

    let boutiques = 0;
    let montantRepris = 0;
    let articlesRestockes = 0;

    for (const [boutiqueId, data] of parBoutique) {
        // Retour partiel possible : une seule boutique du panier peut être
        // concernée. Sans filtre, on reprendrait l'argent des autres.
        if (boutiqueIds && !boutiqueIds.map(String).includes(String(boutiqueId))) continue;

        const dejaRepris = await WalletTransaction.exists({
            orderId: order._id, boutiqueId, type: 'retour',
        });
        if (dejaRepris) continue;

        // Montant exact crédité à l'origine (net de commission).
        const credit = await WalletTransaction.findOne({
            orderId: order._id, boutiqueId, type: 'vente',
        }).select('montant').lean();
        if (!credit || credit.montant <= 0) continue;

        const cible = await portefeuilleDeLaBoutique(boutiqueId);
        if (!cible) continue;

        // Les fonds ont-ils déjà été libérés ?
        const libere = await WalletTransaction.exists({
            orderId: order._id, boutiqueId, type: 'liberation', compte: 'disponible',
        });

        // Encore en attente -> on reprend là. Déjà libéré -> on reprend au
        // disponible, quitte à le rendre négatif.
        const compte = libere ? 'disponible' : 'en_attente';

        try {
            await WalletTransaction.create({
                walletId: cible.wallet._id,
                type: 'retour',
                compte,
                montant: -credit.montant,
                orderId: order._id,
                boutiqueId,
                description: etat === 'endommage' ? 'Colis retour — article endommagé' : 'Colis retour — remis en stock',
            });
        } catch (erreur) {
            if (!estDoublonIgnorable(erreur)) throw erreur;
            continue;
        }

        await cible.wallet.recalculerSoldes();
        boutiques += 1;
        montantRepris += credit.montant;

        if (etat !== 'endommage') {
            articlesRestockes += await restockerArticlesBoutique(order, boutiqueId);
        }
    }

    return { boutiques, montantRepris, articlesRestockes };
};

/**
 * Écriture manuelle sur le solde DISPONIBLE d'un commerçant.
 *
 * [PHASE 0] Ajout de la traçabilité : acteur, idempotence et journalisation.
 *
 * Utilisée pour la retenue créée par la résolution d'un litige (doc §15 :
 * « après libération, le litige peut créer une retenue ou une dette
 * commerçant sans modifier l'historique initial ») ou toute correction
 * ponctuelle décidée par l'admin. Ce module ne connaît que l'argent — le
 * "pourquoi" métier est journalisé séparément par l'appelant
 * (orderController.resoudreLitige).
 *
 * Un solde négatif est autorisé (doc §1, principe 8) : plafonner à zéro
 * effacerait la dette silencieusement.
 *
 * @param {object} params
 * @param {string} params.boutiqueId
 * @param {number} params.montant - signé : négatif = dette/retenue, positif = recrédit
 * @param {string} params.description
 * @param {string} [params.orderId]
 * @param {object} [params.acteur] - { id, nom, role } (pour journaliser)
 * @param {string} [params.idempotencyKey] - clé d'idempotence
 * @param {string} [params.motif] - motif (≥10 caractères)
 * @returns {Promise<object|null>} la transaction créée, ou null si rien à faire
 */
export const ajusterPortefeuille = async ({
    boutiqueId,
    montant,
    description,
    orderId = null,
    acteur = null,
    idempotencyKey = null,
    motif = null,
}) => {
    const montantEntier = Math.round(Number(montant) || 0);
    if (!boutiqueId || montantEntier === 0) return null;

    const cible = await portefeuilleDeLaBoutique(boutiqueId);
    if (!cible) return null;

    // Vérification d'idempotence si une clé est fournie
    if (idempotencyKey) {
        const existing = await WalletTransaction.findOne({
            walletId: cible.wallet._id,
            idempotencyKey,
        });
        if (existing) return existing; // rejeu
    }

    const transactionData = {
        walletId: cible.wallet._id,
        type: 'ajustement',
        compte: 'disponible',
        montant: montantEntier,
        orderId,
        boutiqueId,
        description: description || 'Ajustement manuel',
        creePar: acteur?.id || null,
        idempotencyKey: idempotencyKey || null,
        motif: motif || description || null,
    };

    let transaction;
    try {
        transaction = await WalletTransaction.create(transactionData);
    } catch (error) {
        if (error.code === 11000 && idempotencyKey) {
            // Réécriture concurrente : on renvoie l'existante
            const existing = await WalletTransaction.findOne({
                walletId: cible.wallet._id,
                idempotencyKey,
            });
            return existing;
        }
        throw error;
    }

    await cible.wallet.recalculerSoldes();

    // Journalisation si un acteur est fourni
    if (acteur) {
        try {
            const { journaliser } = await import('../services/journalService.js');
            await journaliser({
                acteur,
                action: 'wallet.ajustement',
                cible: {
                    id: boutiqueId,
                    libelle: `Boutique ${boutiqueId}`,
                },
                boutiqueId,
                note: `Montant: ${montantEntier}, motif: ${motif || description}`,
            });
        } catch (journalError) {
            console.error('[walletService] Échec journalisation:', journalError.message);
        }
    }

    return transaction;
};

/**
 * Boutiques concernées par une commande, et lesquelles ont confirmé.
 * Fonction PURE.
 *
 * @returns {{attendues:string[], confirmees:string[], manquantes:string[], toutesConfirmees:boolean}}
 */
export const etatConfirmations = (order) => {
    const attendues = [...new Set(
        (order?.items || [])
            .map((i) => i.boutiqueId?.toString?.() ?? null)
            .filter(Boolean)
    )];

    const confirmees = [...new Set(
        (order?.confirmationsBoutiques || [])
            .map((c) => c.boutiqueId?.toString?.() ?? null)
            .filter(Boolean)
    )].filter((id) => attendues.includes(id));

    const manquantes = attendues.filter((id) => !confirmees.includes(id));

    return {
        attendues,
        confirmees,
        manquantes,
        // Une commande sans aucune boutique (catalogue principal seul) n'a
        // personne à attendre : elle est prête d'emblée pour l'admin.
        toutesConfirmees: manquantes.length === 0,
    };
};