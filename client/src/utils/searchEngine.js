// ---------------------------------------------------------------------------
// Moteur de recherche "tolérant" pour la boutique.
//
// Objectif : quel que soit ce que la personne tape (faute de frappe, accent
// oublié, mots dans le désordre, pluriel/singulier...), elle doit voir des
// résultats pertinents plutôt qu'un "Aucun article trouvé" décourageant.
//
// Stratégie :
//   1. On construit un "index" léger par produit (une seule fois, via
//      buildSearchIndex), pour ne pas re-normaliser le catalogue à chaque
//      frappe.
//   2. Pour une requête donnée, on score chaque produit sur plusieurs
//      niveaux : correspondance exacte > préfixe > sous-chaîne > proximité
//      (distance de Levenshtein, pour absorber les fautes de frappe).
//   3. Si strictement rien ne matche (score 0 partout), on relâche encore le
//      seuil pour renvoyer les produits les "moins éloignés" plutôt qu'une
//      liste vide — avec un flag `fuzzy: true` pour que l'UI puisse
//      prévenir l'utilisateur que ce sont des résultats approximatifs.
// ---------------------------------------------------------------------------

// Enlève les accents/diacritiques, met en minuscule, nettoie les espaces.
// "Café Rouge" -> "cafe rouge"
export const normalize = (str) => {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // diacritiques
        .toLowerCase()
        .replace(/<[^>]*>/g, ' ') // au cas où une description HTML (Quill) traîne
        .replace(/[^a-z0-9\s]/g, ' ') // ponctuation -> espace
        .replace(/\s+/g, ' ')
        .trim();
};

export const tokenize = (str) => normalize(str).split(' ').filter(Boolean);

// Distance de Levenshtein, avec sortie anticipée si la différence de
// longueur dépasse déjà le budget max — évite du calcul inutile pendant
// qu'on tape.
const levenshtein = (a, b, maxDistance = 3) => {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > maxDistance) return maxDistance + 1;
    if (la === 0) return lb;
    if (lb === 0) return la;

    let prev = new Array(lb + 1);
    let curr = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;

    for (let i = 1; i <= la; i++) {
        curr[0] = i;
        let rowMin = curr[0];
        for (let j = 1; j <= lb; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,      // suppression
                curr[j - 1] + 1,  // insertion
                prev[j - 1] + cost, // substitution
            );
            if (curr[j] < rowMin) rowMin = curr[j];
        }
        if (rowMin > maxDistance) return maxDistance + 1; // aucune chance de rester sous le budget
        [prev, curr] = [curr, prev];
    }
    return prev[lb];
};

// Tolérance de fautes de frappe proportionnelle à la longueur du mot :
// un mot court supporte moins d'erreurs qu'un mot long, sinon tout matche
// avec n'importe quoi.
const typoBudget = (len) => {
    if (len <= 3) return 0;
    if (len <= 5) return 1;
    if (len <= 8) return 2;
    return 3;
};

// Score la correspondance d'UN token de requête contre UN mot candidat.
// Retourne un nombre entre 0 (aucun rapport) et 1 (identique).
const matchWord = (queryToken, candidateWord) => {
    if (!queryToken || !candidateWord) return 0;
    if (candidateWord === queryToken) return 1;
    if (candidateWord.startsWith(queryToken)) return 0.9;
    if (queryToken.length >= 3 && candidateWord.includes(queryToken)) return 0.75;

    const budget = typoBudget(Math.max(queryToken.length, candidateWord.length));
    if (budget === 0) return 0;
    const dist = levenshtein(queryToken, candidateWord, budget);
    if (dist > budget) return 0;
    return Math.max(0, 0.65 - dist * 0.15);
};

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

// À construire une fois (ex. via useMemo) quand la liste de produits change,
// pas à chaque frappe.
export const buildSearchIndex = (products = []) => {
    return products.map((product) => {
        const nameNorm = normalize(product.name);
        const categories = product.categories?.length ? product.categories : (product.category ? [product.category] : []);
        return {
            product,
            nameNormalized: nameNorm,
            nameTokens: tokenize(product.name),
            categoryTokens: tokenize(categories.join(' ')),
            descNormalized: normalize(product.description).slice(0, 600), // suffisant pour un tie-break, pas besoin de tout
            variantTokens: tokenize((product.variants || []).map(v => `${v.color || ''} ${v.size || ''}`).join(' ')),
        };
    });
};

// Score un produit indexé pour une liste de tokens de requête déjà normalisés.
const scoreEntry = (entry, queryTokens, fullQueryNormalized) => {
    let score = 0;
    let matchedTokens = 0;

    if (fullQueryNormalized.length >= 2) {
        if (entry.nameNormalized === fullQueryNormalized) score += 1000;
        else if (entry.nameNormalized.startsWith(fullQueryNormalized)) score += 500;
        else if (entry.nameNormalized.includes(fullQueryNormalized)) score += 300;
    }

    for (const token of queryTokens) {
        let bestForToken = 0;

        for (const word of entry.nameTokens) {
            const m = matchWord(token, word);
            if (m > bestForToken) bestForToken = m * 100;
        }
        for (const word of entry.categoryTokens) {
            const m = matchWord(token, word);
            if (m * 80 > bestForToken) bestForToken = m * 80;
        }
        for (const word of entry.variantTokens) {
            const m = matchWord(token, word);
            if (m * 60 > bestForToken) bestForToken = m * 60;
        }
        if (bestForToken === 0 && token.length >= 3 && entry.descNormalized.includes(token)) {
            bestForToken = 15;
        }

        if (bestForToken > 0) matchedTokens += 1;
        score += bestForToken;
    }

    // Bonus de couverture : un produit qui matche TOUS les mots tapés doit
    // sortir devant un produit qui n'en matche qu'un seul par hasard.
    if (queryTokens.length > 0) {
        score += (matchedTokens / queryTokens.length) * 60;
    }

    return score;
};

/**
 * Recherche floue sur un index construit par buildSearchIndex.
 *
 * @returns {{ results: Array, fuzzy: boolean }}
 *   results : produits triés par pertinence (jamais vide si `products`
 *             contient au moins un élément — voir stratégie de repli).
 *   fuzzy   : true si aucun résultat "sérieux" n'a été trouvé et qu'on
 *             renvoie les produits les plus proches malgré tout, pour que
 *             l'UI puisse afficher "résultats approximatifs" plutôt que de
 *             faire croire à une correspondance exacte.
 */
export const searchProducts = (index, rawQuery, { limit } = {}) => {
    const fullQueryNormalized = normalize(rawQuery);
    if (!fullQueryNormalized) {
        const results = index.map(e => e.product);
        return { results: limit ? results.slice(0, limit) : results, fuzzy: false };
    }

    const queryTokens = tokenize(rawQuery);

    let scored = index
        .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens, fullQueryNormalized) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);

    let fuzzy = false;

    // Repli : rien n'a matché du tout (faute de frappe trop importante,
    // requête très éloignée du catalogue...). Plutôt qu'une liste vide, on
    // renvoie les produits dont le nom est "le moins loin" de la requête.
    if (scored.length === 0 && index.length > 0) {
        fuzzy = true;
        const relaxedBudget = 4;
        scored = index
            .map((entry) => {
                let best = Infinity;
                for (const token of queryTokens.length ? queryTokens : [fullQueryNormalized]) {
                    for (const word of entry.nameTokens.length ? entry.nameTokens : [entry.nameNormalized]) {
                        const d = levenshtein(token, word, relaxedBudget + 2);
                        if (d < best) best = d;
                    }
                }
                return { entry, score: -best }; // score négatif = trié du plus proche au plus loin
            })
            .sort((a, b) => b.score - a.score);
    }

    const results = scored.map(({ entry }) => entry.product);
    return { results: limit ? results.slice(0, limit) : results, fuzzy };
};

// Variante pratique pour les suggestions de la barre de recherche : combine
// produits ET catégories dans un seul classement.
export const searchProductsAndCategories = (index, categories, rawQuery, { limit = 10 } = {}) => {
    const fullQueryNormalized = normalize(rawQuery);
    if (!fullQueryNormalized) return [];

    const queryTokens = tokenize(rawQuery);

    const catScored = (categories || [])
        .map((c) => {
            const nameNorm = normalize(c.name);
            const nameTokens = tokenize(c.name);
            let score = 0;
            if (nameNorm === fullQueryNormalized) score = 1100;
            else if (nameNorm.startsWith(fullQueryNormalized)) score = 550;
            else if (nameNorm.includes(fullQueryNormalized)) score = 330;
            else {
                let matched = 0;
                for (const token of queryTokens) {
                    let best = 0;
                    for (const word of nameTokens) {
                        const m = matchWord(token, word);
                        if (m > best) best = m;
                    }
                    if (best > 0) { matched += 1; score += best * 90; }
                }
                if (matched === 0) score = 0;
            }
            return { _type: 'category', text: c.name, slug: c.slug || c.name, score };
        })
        .filter(c => c.score > 0);

    const { results: prodResults, fuzzy } = searchProducts(index, rawQuery, {});
    const prodScored = prodResults
        .filter(p => !fuzzy) // en mode "repli flou", on ne pollue pas les suggestions rapides — l'utilisateur verra le fallback en page résultats
        .slice(0, limit)
        .map((p) => ({ _type: 'product', text: p.name, image: p.image?.[0] }));

    return [...catScored.sort((a, b) => b.score - a.score).slice(0, 4), ...prodScored].slice(0, limit);
};