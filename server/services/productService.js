// Règles métier du produit — couche « domaine » au sens de la pratique 1.2
// de nodebestpractices (séparer point d'entrée / domaine / accès données).
//
// Ces fonctions sont volontairement PURES : elles ne touchent ni à req/res,
// ni à Mongoose, ni à Cloudinary. C'est ce qui les rend testables sans base
// de données ni serveur (voir tests/productService.test.js) — or ce sont
// précisément les règles où une erreur coûte cher : un stock mal recalculé
// vend un article qui n'existe plus.

/**
 * Met une liste de variantes reçue du client sous la forme attendue par le
 * modèle : types normalisés, valeurs par défaut explicites, aucune clé
 * surnuméraire recopiée telle quelle.
 */
export const normaliserVariantes = (variantes = []) =>
    (variantes || []).map((v) => ({
        color: v.color ?? null,
        colorCode: v.colorCode ?? '#000000',
        size: v.size || null,
        price: Number(v.price) || 0,
        offerPrice: Number(v.offerPrice) || 0,
        stock: Math.max(0, Number(v.stock) || 0),
        startImageIndex: Number(v.startImageIndex) || 0,
    }));

/**
 * Stock total d'un article.
 * Avec variantes, le stock du produit est la SOMME des variantes — le champ
 * `stock` du produit n'est jamais saisi directement dans ce cas, sinon les
 * deux valeurs divergent silencieusement.
 */
export const calculerStockTotal = ({ variants = [], stock = 0 } = {}) => {
    if (variants && variants.length > 0) {
        return variants.reduce((somme, v) => somme + (Math.max(0, Number(v.stock) || 0)), 0);
    }
    return Math.max(0, Number(stock) || 0);
};

/**
 * Disponibilité à la vente.
 *
 * `forcerRupture` permet de retirer de la vente un article qui a encore du
 * stock théorique (souci fournisseur, article réservé). Sans ce paramètre, la
 * disponibilité découle strictement des quantités.
 */
export const determinerDisponibilite = (stockTotal, forcerRupture = false) => {
    if (forcerRupture) return false;
    return stockTotal > 0;
};

/** Clé d'identification d'une variante : couleur + taille. */
export const cleVariante = (v) => `${v?.color ?? ''}|${v?.size ?? ''}`;

/**
 * Applique de nouvelles quantités à des variantes existantes.
 *
 * Ne remplace PAS le tableau : seules les quantités des variantes reconnues
 * changent. Prix, code couleur et image de départ restent la main de celui
 * qui a créé l'article — c'est ce qui permet à un commerçant d'ajuster le
 * stock d'un article créé par le vendeur sans en écraser la fiche.
 *
 * @returns {{variantes: Array, appliquees: number, ignorees: number}}
 */
export const appliquerQuantites = (variantesExistantes = [], quantitesRecues = []) => {
    const parCle = new Map(
        (quantitesRecues || []).map((v) => [cleVariante(v), Math.max(0, Number(v.stock) || 0)])
    );

    let appliquees = 0;
    const variantes = (variantesExistantes || []).map((variante) => {
        const nouvelle = parCle.get(cleVariante(variante));
        if (nouvelle === undefined) return variante;
        appliquees += 1;
        // Mutation volontaire : sur un sous-document Mongoose, remplacer
        // l'objet ferait perdre le suivi des modifications.
        variante.stock = nouvelle;
        return variante;
    });

    return {
        variantes,
        appliquees,
        ignorees: parCle.size - appliquees,
    };
};
