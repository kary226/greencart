import axios from 'axios';
import Product from '../models/Product.js';
import Boutique from '../models/Boutique.js';

// ---------------------------------------------------------------------------
// Synchro catalogue -> Airtable (base "Ramci Produits", table "Produits").
//
// Principe : Ramci (MongoDB) reste la seule source de vérité. Airtable n'est
// qu'un miroir en lecture pour le récap/reporting. On pousse vers Airtable
// (jamais l'inverse) via un "upsert" sur le champ caché "ID Ramci" — Airtable
// crée la ligne si elle n'existe pas encore, la met à jour sinon. On n'a donc
// jamais besoin de connaître/stocker l'ID de la ligne Airtable côté Mongo.
//
// Déclenchement :
//  - automatique (fire-and-forget) après ajout/modif/suppression d'un
//    produit et après chaque commande (vente => stock + salesCount changent)
//  - manuel via le bouton "Synchroniser" (resyncAllProducts), qui repousse
//    tout le catalogue et attend le résultat pour informer l'admin.
//
// Toute erreur de sync (token absent, Airtable down, etc.) est avalée et
// journalisée : la disponibilité d'Airtable ne doit jamais faire échouer une
// requête produit/commande côté Ramci.
// ---------------------------------------------------------------------------

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const UPSERT_MERGE_FIELD = 'ID Ramci';
const BATCH_SIZE = 10; // limite imposée par l'API Airtable par requête

// Table optionnelle "Variantes" : une ligne par couleur × taille, avec son
// stock. Si AIRTABLE_VARIANTS_TABLE_ID n'est pas défini, elle est ignorée et
// seule la table "Produits" est synchronisée (comportement d'origine).
const VARIANT_MERGE_FIELD = 'ID Variante';  // clé d'upsert : produit + couleur + taille
const VARIANT_PRODUCT_FIELD = 'ID Produit'; // rattache chaque ligne à son produit
const PAUSE_ENTRE_LOTS_MS = 250; // Airtable tolère ~5 requêtes/seconde par base

const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getConfig = () => {
    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableId = process.env.AIRTABLE_TABLE_ID;
    const variantsTableId = process.env.AIRTABLE_VARIANTS_TABLE_ID || null;
    if (!token || !baseId || !tableId) return null;
    return { token, baseId, tableId, variantsTableId };
};

const airtableClient = (config, tableId = config.tableId) => axios.create({
    baseURL: `${AIRTABLE_API_BASE}/${config.baseId}/${tableId}`,
    headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
    },
    timeout: 15000,
});

// Résume les tailles/couleurs présentes sur un produit, qu'il soit simple,
// multi-tailles ou multi-variantes.
const resumerTaillesEtCouleurs = (product) => {
    const variants = product.variants || [];

    const tailles = new Set();
    const couleurs = new Set();

    if (variants.length > 0) {
        variants.forEach(v => {
            if (v.size) tailles.add(v.size);
            if (v.color) couleurs.add(v.color);
        });
    } else if (product.size) {
        tailles.add(product.size);
    }

    return {
        tailles: [...tailles].join(', '),
        couleurs: [...couleurs].join(', '),
    };
};

const quantiteRestante = (product) => {
    const variants = product.variants || [];
    if (variants.length > 0) {
        return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    }
    return product.stock || 0;
};

// Construit l'objet "fields" attendu par Airtable pour un produit donné.
// `boutiqueNom` est pré-résolu par l'appelant pour éviter un aller-retour
// Mongo par produit lors d'une resynchro complète.
const construireChamps = (product, boutiqueNom) => {
    const { tailles, couleurs } = resumerTaillesEtCouleurs(product);
    const restante = quantiteRestante(product);
    const prixAchat = product.purchasePrice || 0;
    const prixVente = product.offerPrice || product.price || 0;

    return {
        'Nom': product.name || '',
        'Code produit': product.sku || '',
        'Lien supplémentaire': product.externalLink || undefined,
        "Prix d'achat": prixAchat,
        'Prix de vente': prixVente,
        'Prix barré': product.price || 0,
        'Quantité restante': restante,
        'Quantité vendue': product.salesCount || 0,
        'Tailles': tailles,
        'Couleurs': couleurs,
        'Catégories': (product.categories || []).join(', '),
        'En stock': !!product.inStock,
        'Boutique': boutiqueNom || '',
        'Marge estimée': prixAchat ? Math.max(0, prixVente - prixAchat) : 0,
        [UPSERT_MERGE_FIELD]: product._id.toString(),
        'Dernière synchro': new Date().toISOString(),
    };
};

const resoudreNomBoutique = async (boutiqueId) => {
    if (!boutiqueId) return '';
    try {
        const boutique = await Boutique.findById(boutiqueId).select('nom').lean();
        return boutique?.nom || '';
    } catch {
        return '';
    }
};

const upsertBatch = async (client, records, mergeField = UPSERT_MERGE_FIELD) => {
    if (records.length === 0) return;
    await client.patch('', {
        performUpsert: { fieldsToMergeOn: [mergeField] },
        records: records.map(fields => ({ fields })),
        typecast: true,
    });
};

// ---------------------------------------------------------------------------
// Table "Variantes" — stock détaillé par couleur × taille
// ---------------------------------------------------------------------------

// Une ligne par variante. Produit simple (sans variantes) : une seule ligne,
// avec sa taille éventuelle. Clé stable = produit + couleur + taille, car les
// _id des variantes Mongo sont régénérés à chaque modification du produit.
const construireLignesVariantes = (product, boutiqueNom) => {
    const variants = product.variants || [];
    const prixBarreBase = product.price || 0;
    const prixVenteBase = product.offerPrice || product.price || 0;
    const idProduit = product._id.toString();

    const sources = variants.length > 0
        ? variants.map(v => ({
            couleur: v.color || '',
            taille: v.size || '',
            stock: v.stock || 0,
            prixVente: v.offerPrice || v.price || prixVenteBase,
            prixBarre: v.price || prixBarreBase,
        }))
        : [{
            couleur: '',
            taille: product.size || '',
            stock: product.stock || 0,
            prixVente: prixVenteBase,
            prixBarre: prixBarreBase,
        }];

    // Deux variantes identiques (donnée historique) : on additionne le stock
    // plutôt que d'envoyer deux fois la même clé dans une requête.
    const parCle = new Map();
    sources.forEach(s => {
        const cle = `${idProduit}__${s.couleur}__${s.taille}`;
        const existante = parCle.get(cle);
        if (existante) {
            existante['Stock'] += s.stock;
            return;
        }
        parCle.set(cle, {
            'Produit': product.name || '',
            'Code produit': product.sku || '',
            'Couleur': s.couleur,
            'Taille / Variante': s.taille,
            'Stock': s.stock,
            'Prix de vente': s.prixVente,
            'Prix barré': s.prixBarre,
            'Boutique': boutiqueNom || '',
            [VARIANT_PRODUCT_FIELD]: idProduit,
            [VARIANT_MERGE_FIELD]: cle,
            'Dernière synchro': new Date().toISOString(),
        });
    });

    return [...parCle.values()];
};

// Lit les lignes déjà présentes dans la table Variantes (avec pagination).
// Seuls les deux champs de clé sont demandés, pour garder la réponse légère.
const listerLignesVariantes = async (client, formula) => {
    const lignes = [];
    let offset;
    do {
        const params = new URLSearchParams();
        params.append('pageSize', '100');
        params.append('fields[]', VARIANT_MERGE_FIELD);
        params.append('fields[]', VARIANT_PRODUCT_FIELD);
        if (formula) params.append('filterByFormula', formula);
        if (offset) params.append('offset', offset);

        const { data } = await client.get('', { params });
        (data.records || []).forEach(r => lignes.push({
            recordId: r.id,
            cle: r.fields?.[VARIANT_MERGE_FIELD],
            idProduit: r.fields?.[VARIANT_PRODUCT_FIELD],
        }));
        offset = data.offset;
        if (offset) await pause(PAUSE_ENTRE_LOTS_MS);
    } while (offset);
    return lignes;
};

const supprimerLignesVariantes = async (client, recordIds) => {
    for (let i = 0; i < recordIds.length; i += BATCH_SIZE) {
        const params = new URLSearchParams();
        recordIds.slice(i, i + BATCH_SIZE).forEach(id => params.append('records[]', id));
        await client.delete('', { params });
        await pause(PAUSE_ENTRE_LOTS_MS);
    }
};

// Pousse les variantes de `products`, puis retire de la table les lignes
// devenues inutiles (couleur ou taille supprimée du produit).
//  - listerTout : lit toute la table au lieu de filtrer par produit
//    (resynchro complète : une seule lecture plutôt qu'une par produit).
//  - supprimerOrphelins : retire aussi les lignes dont le produit n'existe
//    plus. Jamais pour une resynchro limitée à une boutique. Les lignes
//    ajoutées à la main (sans "ID Produit") ne sont jamais touchées.
const syncVariantes = async (config, products, nomParBoutique, { listerTout = false, supprimerOrphelins = false } = {}) => {
    if (!config.variantsTableId) return;

    const client = airtableClient(config, config.variantsTableId);
    const lignes = products.flatMap(p => construireLignesVariantes(
        p,
        p.boutiqueId ? nomParBoutique.get(p.boutiqueId.toString()) : ''
    ));

    for (let i = 0; i < lignes.length; i += BATCH_SIZE) {
        await upsertBatch(client, lignes.slice(i, i + BATCH_SIZE), VARIANT_MERGE_FIELD);
        await pause(PAUSE_ENTRE_LOTS_MS);
    }

    const idsProduits = new Set(products.map(p => p._id.toString()));
    if (idsProduits.size === 0 && !listerTout) return;

    const clesAttendues = new Set(lignes.map(l => l[VARIANT_MERGE_FIELD]));
    const formule = listerTout
        ? undefined
        : `OR(${[...idsProduits].map(id => `{${VARIANT_PRODUCT_FIELD}} = "${id}"`).join(',')})`;

    const existantes = (await listerLignesVariantes(client, formule)).filter(l => l.idProduit);
    const aSupprimer = existantes.filter(l => (
        idsProduits.has(l.idProduit)
            ? !clesAttendues.has(l.cle)
            : supprimerOrphelins
    ));
    await supprimerLignesVariantes(client, aSupprimer.map(l => l.recordId));
};

const logErreurVariantes = (error) => {
    console.error('❌ Erreur sync table Variantes:', error.response?.data || error.message);
};

// Synchronise UN produit (après ajout/modif/vente/changement de stock).
// Fire-and-forget côté appelant : cette fonction n'est jamais censée faire
// échouer la requête qui l'a déclenchée.
export const syncProductToAirtable = async (productId) => {
    const config = getConfig();
    if (!config) return; // Airtable non configuré, on ignore silencieusement

    try {
        const product = await Product.findById(productId).lean();
        if (!product) return;

        const boutiqueNom = await resoudreNomBoutique(product.boutiqueId);
        const client = airtableClient(config);
        await upsertBatch(client, [construireChamps(product, boutiqueNom)]);

        const nomParBoutique = new Map(product.boutiqueId ? [[product.boutiqueId.toString(), boutiqueNom]] : []);
        await syncVariantes(config, [product], nomParBoutique).catch(logErreurVariantes);
    } catch (error) {
        console.error('❌ Erreur syncProductToAirtable:', error.response?.data || error.message);
    }
};

// Synchronise plusieurs produits d'un coup (ex : après une commande qui
// touche plusieurs articles). Fire-and-forget également.
export const syncManyProductsToAirtable = async (productIds) => {
    const config = getConfig();
    if (!config || !productIds?.length) return;

    try {
        const uniqueIds = [...new Set(productIds.map(id => id.toString()))];
        const products = await Product.find({ _id: { $in: uniqueIds } }).lean();
        if (products.length === 0) return;

        const boutiqueIds = [...new Set(products.filter(p => p.boutiqueId).map(p => p.boutiqueId.toString()))];
        const boutiques = boutiqueIds.length
            ? await Boutique.find({ _id: { $in: boutiqueIds } }).select('nom').lean()
            : [];
        const nomParBoutique = new Map(boutiques.map(b => [b._id.toString(), b.nom]));

        const client = airtableClient(config);
        const champs = products.map(p => construireChamps(
            p,
            p.boutiqueId ? nomParBoutique.get(p.boutiqueId.toString()) : ''
        ));

        for (let i = 0; i < champs.length; i += BATCH_SIZE) {
            await upsertBatch(client, champs.slice(i, i + BATCH_SIZE));
        }

        await syncVariantes(config, products, nomParBoutique).catch(logErreurVariantes);
    } catch (error) {
        console.error('❌ Erreur syncManyProductsToAirtable:', error.response?.data || error.message);
    }
};

// Supprime la ligne Airtable correspondant à un produit supprimé sur Ramci.
export const deleteProductFromAirtable = async (productId) => {
    const config = getConfig();
    if (!config) return;

    try {
        const client = airtableClient(config);
        const formula = `{${UPSERT_MERGE_FIELD}} = "${productId.toString()}"`;
        const { data } = await client.get('', { params: { filterByFormula: formula, maxRecords: 1 } });

        const record = data?.records?.[0];
        if (record) {
            await client.delete('', { params: { 'records[]': record.id } });
        }

        // Retire aussi les lignes de stock détaillé de ce produit.
        if (config.variantsTableId) {
            const variantsClient = airtableClient(config, config.variantsTableId);
            const lignes = await listerLignesVariantes(
                variantsClient,
                `{${VARIANT_PRODUCT_FIELD}} = "${productId.toString()}"`
            ).catch(logErreurVariantes);
            if (lignes?.length) {
                await supprimerLignesVariantes(variantsClient, lignes.map(l => l.recordId)).catch(logErreurVariantes);
            }
        }
    } catch (error) {
        console.error('❌ Erreur deleteProductFromAirtable:', error.response?.data || error.message);
    }
};

// Resynchro complète du catalogue — utilisée par le bouton "Synchroniser".
// Contrairement aux fonctions ci-dessus, celle-ci PROPAGE ses erreurs : un
// clic manuel doit informer l'admin en cas d'échec plutôt que d'échouer en
// silence.
export const resyncAllProducts = async (boutiqueId = null) => {
    const config = getConfig();
    if (!config) {
        const error = new Error("Synchro Airtable non configurée (variables d'environnement manquantes).");
        error.code = 'AIRTABLE_NOT_CONFIGURED';
        throw error;
    }

    const filter = boutiqueId ? { boutiqueId } : {};
    const products = await Product.find(filter).lean();

    const boutiqueIds = [...new Set(products.filter(p => p.boutiqueId).map(p => p.boutiqueId.toString()))];
    const boutiques = boutiqueIds.length
        ? await Boutique.find({ _id: { $in: boutiqueIds } }).select('nom').lean()
        : [];
    const nomParBoutique = new Map(boutiques.map(b => [b._id.toString(), b.nom]));

    const client = airtableClient(config);
    const champs = products.map(p => construireChamps(
        p,
        p.boutiqueId ? nomParBoutique.get(p.boutiqueId.toString()) : ''
    ));

    for (let i = 0; i < champs.length; i += BATCH_SIZE) {
        await upsertBatch(client, champs.slice(i, i + BATCH_SIZE));
    }

    // Ici les erreurs remontent à l'appelant, comme pour la table Produits.
    await syncVariantes(config, products, nomParBoutique, {
        listerTout: true,
        supprimerOrphelins: !boutiqueId,
    });

    return { total: products.length };
};