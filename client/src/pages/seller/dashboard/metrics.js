/* ═══════════════════════════════════════════════════════════════════════
   Calculs du tableau de bord vendeur — fonctions pures, sans React.

   Tout est isolé ici pour deux raisons : ces règles sont du métier (ce qui
   compte comme chiffre d'affaires, ce qui compte comme commande), et elles
   se relisent mal noyées dans du JSX.
   ═══════════════════════════════════════════════════════════════════════ */

/* Statuts tels que définis par server/models/Order.js. L'ordre est celui de
   l'entonnoir réel — il porte l'information, ne pas trier par valeur. */
export const STATUTS = [
    { cle: 'pending_payment', label: 'Paiement en attente' },
    { cle: 'Order Placed', label: 'Commandée' },
    { cle: 'Confirmed', label: 'Confirmée' },
    { cle: 'Shipped', label: 'Expédiée' },
    { cle: 'Out for Delivery', label: 'En livraison' },
    { cle: 'Delivered', label: 'Livrée' },
    { cle: 'Returned', label: 'Retournée' },
    { cle: 'Cancelled', label: 'Annulée' },
];

export const LIBELLE_STATUT = Object.fromEntries(STATUTS.map(s => [s.cle, s.label]));

/* Une commande en `pending_payment` est un panier dont le paiement n'a jamais
   abouti. La compter comme commande gonfle tous les taux ; l'ancien tableau de
   bord le faisait. Elle reste visible dans l'entonnoir, mais n'entre pas dans
   les dénominateurs. */
export const estCommandeReelle = (o) => o.status !== 'pending_payment';

export const PERIODES = [
    { cle: '7j', label: '7 jours', jours: 7 },
    { cle: '30j', label: '30 jours', jours: 30 },
    { cle: '90j', label: '90 jours', jours: 90 },
    { cle: '12m', label: '12 mois', jours: 365 },
    { cle: 'tout', label: 'Tout', jours: null },
];

const AU_DEBUT_DU_JOUR = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Fenêtre [debut, fin] de la période, plus la fenêtre équivalente qui la
 * précède immédiatement — c'est elle qui donne un delta honnête.
 * Pour « tout », il n'y a pas de période précédente : le delta est masqué.
 */
export function fenetres(clePeriode, maintenant = new Date()) {
    const periode = PERIODES.find(p => p.cle === clePeriode) || PERIODES[1];
    if (periode.jours === null) return { debut: null, fin: maintenant, precDebut: null, precFin: null };

    const fin = maintenant;
    const debut = AU_DEBUT_DU_JOUR(new Date(fin.getTime() - (periode.jours - 1) * JOUR_MS));
    const precFin = new Date(debut.getTime() - 1);
    const precDebut = AU_DEBUT_DU_JOUR(new Date(debut.getTime() - periode.jours * JOUR_MS));
    return { debut, fin, precDebut, precFin };
}

export const dansFenetre = (o, debut, fin) => {
    if (!debut) return true;
    const d = new Date(o.createdAt);
    return d >= debut && d <= fin;
};

/* ── Agrégats ─────────────────────────────────────────────────────────── */

/**
 * `isPaid` sépare l'encaissé de l'espéré. L'ancien tableau de bord sommait
 * `amount` sur toutes les commandes, paniers abandonnés compris : le chiffre
 * d'affaires affiché était supérieur à l'argent réellement reçu.
 */
export function agreger(commandes) {
    const reelles = commandes.filter(estCommandeReelle);
    const payees = reelles.filter(o => o.isPaid);
    const livrees = reelles.filter(o => o.status === 'Delivered');
    const annulees = reelles.filter(o => o.status === 'Cancelled');
    const retournees = reelles.filter(o => o.status === 'Returned');

    /* En attente : facturé mais pas encore encaissé. Une commande annulée
       n'est plus attendue, elle sort du compte. */
    const enAttente = reelles.filter(o => !o.isPaid && o.status !== 'Cancelled');

    const caEncaisse = payees.reduce((s, o) => s + (o.amount || 0), 0);
    const caEnAttente = enAttente.reduce((s, o) => s + (o.amount || 0), 0);
    const fraisLivraison = payees.reduce((s, o) => s + (o.deliveryPrice || 0), 0);
    const remises = reelles.reduce((s, o) => s + (o.discountAmount || 0), 0);
    const avecCoupon = reelles.filter(o => o.couponApplied).length;

    /* Délai réel de livraison, en jours, sur les commandes effectivement
       livrées (deliveredAt renseigné). */
    const delais = livrees
        .filter(o => o.deliveredAt)
        .map(o => (new Date(o.deliveredAt) - new Date(o.createdAt)) / JOUR_MS)
        .filter(d => d >= 0);
    const delaiMoyen = delais.length ? delais.reduce((s, d) => s + d, 0) / delais.length : null;

    /* Ponctualité : livré au plus tard à la fin de la fourchette annoncée.
       Ne se calcule que sur les commandes qui portaient une estimation. */
    const avecEstimation = livrees.filter(o => o.deliveredAt && o.estimatedDeliveryEnd);
    const aLHeure = avecEstimation.filter(o => new Date(o.deliveredAt) <= new Date(o.estimatedDeliveryEnd));
    const ponctualite = avecEstimation.length ? (aLHeure.length / avecEstimation.length) * 100 : null;

    return {
        nbCommandes: reelles.length,
        nbPayees: payees.length,
        nbLivrees: livrees.length,
        nbAnnulees: annulees.length,
        nbRetournees: retournees.length,
        nbEnAttente: enAttente.length,
        caEncaisse,
        caEnAttente,
        fraisLivraison,
        remises,
        avecCoupon,
        panierMoyen: payees.length ? caEncaisse / payees.length : 0,
        tauxLivraison: reelles.length ? (livrees.length / reelles.length) * 100 : 0,
        tauxAnnulation: reelles.length ? (annulees.length / reelles.length) * 100 : 0,
        tauxRetour: livrees.length ? (retournees.length / (livrees.length + retournees.length)) * 100 : 0,
        delaiMoyen,
        ponctualite,
        nbClients: new Set(reelles.map(o => o.userId)).size,
    };
}

/**
 * Variation en pourcentage. Renvoie null quand la base est nulle : passer de
 * 0 à 3 n'est pas « +300 % », c'est une apparition. L'ancien calcul divisait
 * par `base || 1`, ce qui affichait des variations à six chiffres.
 */
export function variation(courant, precedent) {
    if (precedent === null || precedent === undefined) return null;
    if (precedent === 0) return null;
    return ((courant - precedent) / precedent) * 100;
}

/* ── Séries temporelles ───────────────────────────────────────────────── */

const MOIS_COURTS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];

/**
 * Regroupe le CA encaissé par jour (périodes courtes) ou par mois (12 mois et
 * plus). Les intervalles vides sont présents à zéro — sans ça, une rupture de
 * ventes se lit comme une ligne continue.
 */
export function serieTemporelle(commandes, clePeriode, maintenant = new Date()) {
    const payees = commandes.filter(o => estCommandeReelle(o) && o.isPaid);
    const parMois = clePeriode === '12m' || clePeriode === 'tout';

    if (parMois) {
        const seaux = new Map();
        let debut;
        if (clePeriode === '12m') {
            debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 11, 1);
        } else {
            const dates = payees.map(o => new Date(o.createdAt));
            debut = dates.length
                ? new Date(Math.min(...dates))
                : new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
            debut = new Date(debut.getFullYear(), debut.getMonth(), 1);
        }
        const curseur = new Date(debut);
        while (curseur <= maintenant) {
            seaux.set(`${curseur.getFullYear()}-${curseur.getMonth()}`, {
                label: `${MOIS_COURTS[curseur.getMonth()]} ${String(curseur.getFullYear()).slice(2)}`,
                ca: 0,
                commandes: 0,
            });
            curseur.setMonth(curseur.getMonth() + 1);
        }
        payees.forEach(o => {
            const d = new Date(o.createdAt);
            const seau = seaux.get(`${d.getFullYear()}-${d.getMonth()}`);
            if (seau) { seau.ca += o.amount || 0; seau.commandes += 1; }
        });
        return [...seaux.values()];
    }

    const periode = PERIODES.find(p => p.cle === clePeriode) || PERIODES[1];
    const seaux = new Map();
    for (let i = periode.jours - 1; i >= 0; i--) {
        const d = AU_DEBUT_DU_JOUR(new Date(maintenant.getTime() - i * JOUR_MS));
        seaux.set(d.toDateString(), {
            label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
            ca: 0,
            commandes: 0,
        });
    }
    payees.forEach(o => {
        const cle = AU_DEBUT_DU_JOUR(new Date(o.createdAt)).toDateString();
        const seau = seaux.get(cle);
        if (seau) { seau.ca += o.amount || 0; seau.commandes += 1; }
    });
    return [...seaux.values()];
}

/* ── Répartitions ─────────────────────────────────────────────────────── */

export function repartitionStatuts(commandes) {
    const compte = Object.fromEntries(STATUTS.map(s => [s.cle, 0]));
    commandes.forEach(o => { if (compte[o.status] !== undefined) compte[o.status] += 1; });
    return STATUTS.map(s => ({ cle: s.cle, label: s.label, valeur: compte[s.cle] }));
}

/* Jèko a remplacé GeniusPay ; les commandes historiques portent encore
   l'ancien libellé et doivent rester comptées comme Mobile Money. */
export function repartitionPaiements(commandes) {
    const reelles = commandes.filter(estCommandeReelle);
    const compte = { mobile: 0, cod: 0, autre: 0 };
    reelles.forEach(o => {
        if (o.paymentType === 'Jeko' || o.paymentType === 'GeniusPay') compte.mobile += 1;
        else if (o.paymentType === 'COD') compte.cod += 1;
        else compte.autre += 1;
    });
    return [
        { cle: 'mobile', label: 'Mobile Money', valeur: compte.mobile },
        { cle: 'cod', label: 'À la livraison', valeur: compte.cod },
        { cle: 'autre', label: 'Autre', valeur: compte.autre },
    ].filter(x => x.valeur > 0);
}

export function ventesParCategorie(commandes, produits, limite = 6) {
    const parId = new Map(produits.map(p => [p._id, p]));
    const total = {};
    commandes.filter(o => estCommandeReelle(o) && o.isPaid).forEach(o => {
        (o.items || []).forEach(item => {
            const p = parId.get(item.product);
            if (!p) return;
            const cat = p.category || p.categories?.[0] || 'Autre';
            const pu = item.priceAtOrder || p.offerPrice || p.price || 0;
            total[cat] = (total[cat] || 0) + pu * item.quantity;
        });
    });
    return Object.entries(total)
        .map(([label, valeur]) => ({ label, valeur }))
        .sort((a, b) => b.valeur - a.valeur)
        .slice(0, limite);
}

export function topProduits(commandes, produits, limite = 6) {
    const parId = new Map(produits.map(p => [p._id, p]));
    const cumul = {};
    commandes.filter(o => estCommandeReelle(o) && o.isPaid).forEach(o => {
        (o.items || []).forEach(item => {
            const e = cumul[item.product] || { quantite: 0, ca: 0 };
            const p = parId.get(item.product);
            e.quantite += item.quantity;
            e.ca += (item.priceAtOrder || p?.offerPrice || p?.price || 0) * item.quantity;
            cumul[item.product] = e;
        });
    });
    return Object.entries(cumul)
        .sort((a, b) => b[1].quantite - a[1].quantite)
        .slice(0, limite)
        .map(([id, e]) => {
            const p = parId.get(id);
            return { id, nom: p?.name || 'Produit supprimé', image: p?.image?.[0], quantite: e.quantite, ca: e.ca };
        });
}

/** Stock au plus bas d'un produit, variantes comprises. */
export function stockMini(p) {
    if (p.variants?.length) {
        const stocks = p.variants.map(v => v.stock ?? 0);
        return stocks.length ? Math.min(...stocks) : null;
    }
    return p.stock ?? null;
}

export function stocksFaibles(produits, seuil = 5) {
    return produits
        .map(p => ({ produit: p, stock: stockMini(p) }))
        .filter(x => x.stock !== null && x.stock <= seuil)
        .sort((a, b) => a.stock - b.stock);
}

/* ── Formatage ────────────────────────────────────────────────────────── */

export const formaterMontant = (v, devise) =>
    `${Math.round(v || 0).toLocaleString('fr-FR')} ${devise || ''}`.trim();

/** Format compact pour les axes : 1 200 000 → 1,2 M. */
export const formaterCompact = (v) => {
    const n = Math.abs(v || 0);
    if (n >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')} M`;
    if (n >= 1_000) return `${Math.round(v / 1000)} k`;
    return String(Math.round(v || 0));
};

export const formaterJours = (v) => {
    if (v === null) return '—';
    if (v < 1) return `${Math.round(v * 24)} h`;
    return `${v.toFixed(1).replace('.0', '').replace('.', ',')} j`;
};
