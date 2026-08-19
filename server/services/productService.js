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

// ---- Verrouillage des articles saisis par la plateforme --------------- //

// Ce que le commerçant ne peut PAS modifier sur un article que la plateforme
// a saisi puis rattaché à sa boutique. Il en gère les quantités et les
// caractéristiques (nom, description, catégories, couleurs, tailles) ; le
// prix et les médias restent la main de celui qui a créé la fiche.
//
// `purchasePrice` figure ici pour une autre raison : c'est le coût d'achat,
// une donnée interne de marge qui n'a jamais à transiter par le formulaire
// d'un commerçant.
const CHAMPS_VERROUILLES = [
    'price',
    'offerPrice',
    'purchasePrice',
    'image',
    'video',
    'videoPublicId',
];

/** Un article saisi par la plateforme et confié à une boutique. */
export const estArticlePlateforme = (produit) =>
    produit?.origine === 'plateforme' && Boolean(produit?.boutiqueId);

/**
 * Retire d'une mise à jour les champs qu'un commerçant n'a pas le droit de
 * toucher sur un article de la plateforme, et restaure les prix des
 * variantes existantes tout en laissant passer les quantités.
 *
 * Volontairement une fonction PURE qui renvoie une nouvelle mise à jour :
 * c'est la règle qui décide qui peut changer un prix, elle doit être
 * lisible et testable d'un seul coup d'œil.
 *
 * @param {object} miseAJour  données prêtes à être écrites
 * @param {object} existant   article tel qu'il est en base
 * @returns {{miseAJour: object, champsRefuses: string[]}}
 */
export const appliquerVerrouillagePlateforme = (miseAJour = {}, existant = {}) => {
    const resultat = { ...miseAJour };
    const champsRefuses = [];

    for (const champ of CHAMPS_VERROUILLES) {
        if (!(champ in resultat)) continue;

        // Ne signaler que les tentatives RÉELLES de changement : un
        // formulaire qui renvoie la valeur inchangée n'est pas une fraude,
        // et n'a pas à produire un avertissement.
        const avant = JSON.stringify(existant?.[champ] ?? null);
        const apres = JSON.stringify(resultat[champ] ?? null);
        if (avant !== apres) champsRefuses.push(champ);

        delete resultat[champ];
    }

    // Les variantes portent elles aussi des prix. On garde les quantités
    // envoyées, mais on réimpose les prix enregistrés.
    if (Array.isArray(resultat.variants) && Array.isArray(existant?.variants)) {
        const prixParCle = new Map(
            existant.variants.map((v) => [cleVariante(v), { price: v.price, offerPrice: v.offerPrice }])
        );

        resultat.variants = resultat.variants.map((v) => {
            const prix = prixParCle.get(cleVariante(v));
            if (!prix) return v; // variante nouvelle : rien à réimposer
            if (v.price !== prix.price || v.offerPrice !== prix.offerPrice) {
                if (!champsRefuses.includes('variants.price')) champsRefuses.push('variants.price');
            }
            return { ...v, price: prix.price, offerPrice: prix.offerPrice };
        });
    }

    return { miseAJour: resultat, champsRefuses };
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
