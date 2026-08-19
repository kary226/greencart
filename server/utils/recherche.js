// Construction des filtres de recherche du catalogue.
//
// Isolé du contrôleur pour deux raisons : c'est de la logique pure, donc
// testable sans base ni serveur (voir tests/recherche.test.js), et c'est un
// point sensible côté sécurité — une saisie utilisateur qui finit dans une
// expression régulière exécutée par MongoDB.

/**
 * Neutralise les métacaractères d'une expression régulière : la saisie
 * devient une recherche de sous-chaîne littérale, jamais un motif
 * exécutable.
 *
 * Sans ça, une entrée comme « (a+)+$ » est compilée telle quelle par le
 * moteur : c'est un motif à explosion combinatoire (ReDoS), déclenchable
 * par une simple requête publique non authentifiée.
 */
export const echapperRegex = (valeur) =>
    String(valeur).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Au-delà, la recherche n'apporte rien et allonge le motif pour rien.
const LONGUEUR_MAX_RECHERCHE = 100;

/**
 * Traduit les paramètres publics de recherche en fragment de filtre Mongo.
 * Chaque critère est optionnel ; un critère absent, vide ou non numérique
 * n'ajoute rien plutôt que de produire un filtre incohérent.
 *
 * @param {object} query - req.query
 * @returns {object} fragment de filtre à fusionner
 */
export const construireFiltreRecherche = (query = {}) => {
    const filtre = {};

    const recherche = typeof query.search === 'string'
        ? query.search.trim().slice(0, LONGUEUR_MAX_RECHERCHE)
        : '';

    if (recherche) {
        const motif = echapperRegex(recherche);
        // Le code article est cherché en même temps que le nom : c'est ce que
        // tape quelqu'un qui connaît déjà sa référence.
        filtre.$or = [
            { name: { $regex: motif, $options: 'i' } },
            { sku: { $regex: motif, $options: 'i' } },
        ];
    }

    if (typeof query.category === 'string' && query.category.trim()) {
        filtre.categories = query.category.trim();
    }

    const prix = {};
    if (query.minPrice !== undefined && query.minPrice !== '') {
        const min = Number(query.minPrice);
        if (Number.isFinite(min) && min >= 0) prix.$gte = min;
    }
    if (query.maxPrice !== undefined && query.maxPrice !== '') {
        const max = Number(query.maxPrice);
        if (Number.isFinite(max) && max >= 0) prix.$lte = max;
    }
    if (Object.keys(prix).length > 0) filtre.offerPrice = prix;

    return filtre;
};
