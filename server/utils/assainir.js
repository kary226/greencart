import sanitizeHtml from 'sanitize-html';

// Assainissement des contenus fournis par les utilisateurs, À L'ENTRÉE.
//
// Le rendu côté client était déjà protégé (React échappe le texte, DOMPurify
// nettoie la description). Mais cette protection ne vaut QUE pour ce client :
// le jour où une autre surface affiche ces champs — un e-mail, un PDF, une
// application native, un export — le contenu brut stocké redevient dangereux.
// On assainit donc aussi à la source : la donnée stockée est sûre en
// elle-même, quelle que soit la façon dont elle est ensuite affichée
// (défense en profondeur).

// --- Texte enrichi : la description produit (HTML produit par l'éditeur Quill).
//
// On garde une liste blanche de balises de mise en forme et on retire tout
// le reste — scripts, gestionnaires d'événements (onerror, onclick…),
// iframes, styles arbitraires. Le résultat reste du HTML affichable, mais
// débarrassé de tout ce qui peut exécuter du code.
const OPTIONS_RICHE = {
    allowedTags: [
        'p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
        'ul', 'ol', 'li', 'blockquote', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ],
    allowedAttributes: {
        a: ['href', 'target', 'rel'],
        span: ['style'],
        p: ['style'],
    },
    // Seules ces déclarations de style survivent, et uniquement avec des
    // valeurs attendues : `style` est un vecteur d'injection à part entière.
    allowedStyles: {
        '*': {
            'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
            'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/],
        },
    },
    // Seuls les liens http/https/mailto ; `javascript:` est écarté.
    allowedSchemes: ['http', 'https', 'mailto'],
    // Un lien ouvert dans un nouvel onglet ne doit pas donner accès à
    // `window.opener` — on force la protection.
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }, true),
    },
};

/**
 * Assainit un contenu HTML enrichi (description produit).
 * @param {unknown} valeur
 * @returns {string}
 */
export const assainirRiche = (valeur) => {
    if (typeof valeur !== 'string') return '';
    return sanitizeHtml(valeur, OPTIONS_RICHE).trim();
};

/**
 * Assainit un contenu qui doit rester du TEXTE PUR : commentaire d'avis, nom
 * de boutique, note libre. Toute balise est retirée (pas échappée : retirée),
 * puis les entités HTML sont ramenées à leur caractère lisible — un
 * commentaire « 3 < 5 » ne doit pas être mutilé.
 *
 * @param {unknown} valeur
 * @returns {string}
 */
export const assainirTexte = (valeur) => {
    if (typeof valeur !== 'string') return '';
    const sansBalises = sanitizeHtml(valeur, { allowedTags: [], allowedAttributes: {} });
    // sanitize-html encode `<` en `&lt;` etc. ; on les redécode pour du texte.
    return sansBalises
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
};

export default { assainirRiche, assainirTexte };
