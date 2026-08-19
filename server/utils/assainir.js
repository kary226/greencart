// Assainissement des contenus fournis par les utilisateurs, À L'ENTRÉE.
//
// [IMPORTANT] Implémentation SANS AUCUNE DÉPENDANCE, en JavaScript pur.
// La version précédente s'appuyait sur `sanitize-html`, qui fait en interne
// un require() d'un module ES (htmlparser2) : cela fonctionne en local mais
// FAIT PLANTER le serveur au démarrage sur Vercel (ERR_REQUIRE_ESM), donc
// coupe tout le backend. On n'introduit plus jamais cette classe de risque
// ici : le fichier ne dépend que du langage.
//
// Le rendu côté client reste la protection PRINCIPALE (React échappe le
// texte, DOMPurify nettoie la description au rendu). Ce module ajoute une
// couche à la SOURCE — défense en profondeur — pour que la donnée stockée
// soit déjà sûre si une autre surface (e-mail, PDF, app native) l'affiche
// sans repasser par ces protections.

// Entités HTML → caractère lisible, pour ne pas mutiler un texte légitime
// (« 3 < 5 » doit rester « 3 < 5 »).
const decoderEntites = (s) => s
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&'); // en dernier, sinon &amp;lt; se décode mal

/**
 * Contenu qui doit rester du TEXTE PUR : commentaire d'avis, nom et
 * description de boutique, note libre. Toute balise est retirée.
 *
 * @param {unknown} valeur
 * @returns {string}
 */
export const assainirTexte = (valeur) => {
    if (typeof valeur !== 'string') return '';
    let s = valeur;

    // Contenu des balises à exécution (script/style…) retiré en entier, pas
    // seulement leurs chevrons, pour ne pas laisser traîner « alert(1) ».
    for (const balise of BALISES_AVEC_CONTENU) {
        s = s.replace(new RegExp(`<${balise}\\b[\\s\\S]*?<\\/${balise}\\s*>`, 'gi'), '');
    }

    // Balises : uniquement ce qui a la FORME d'une balise (« < » suivi d'une
    // lettre, d'un « / » ou d'un « ! »). Ainsi « 3 < 5 » n'est pas amputé.
    s = s.replace(/<[/!]?[a-zA-Z][^>]*>/g, '');
    // Balise ouverte en fin de chaîne, jamais refermée.
    s = s.replace(/<[/!]?[a-zA-Z][^>]*$/g, '');

    return decoderEntites(s).replace(/\s+/g, ' ').trim();
};

// --- Texte enrichi : la description produit (HTML de l'éditeur Quill).
//
// Approche par DENYLIST ciblée : on garde la mise en forme (gras, listes,
// titres, liens) et on neutralise les vecteurs d'exécution connus. C'est
// volontairement combiné avec le DOMPurify du client, qui reste la barrière
// à liste blanche : cette couche serveur n'a pas à être parfaite, elle doit
// être SÛRE À DÉPLOYER et strictement meilleure que rien.

// Balises dont le contenu entier doit disparaître (pas seulement la balise).
const BALISES_AVEC_CONTENU = ['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math'];
// Balises structurellement dangereuses, retirées mais leur contenu textuel
// éventuel est conservé.
const BALISES_INTERDITES = ['link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'img', 'video', 'audio', 'source'];

/**
 * @param {unknown} valeur
 * @returns {string}
 */
export const assainirRiche = (valeur) => {
    if (typeof valeur !== 'string') return '';
    let html = valeur;

    // 1. Balises + contenu (script, style, iframe…) entièrement supprimés.
    for (const balise of BALISES_AVEC_CONTENU) {
        const bloc = new RegExp(`<${balise}\\b[\\s\\S]*?<\\/${balise}\\s*>`, 'gi');
        html = html.replace(bloc, '');
        // Variante auto-fermante ou non refermée.
        html = html.replace(new RegExp(`<${balise}\\b[^>]*\\/?>`, 'gi'), '');
    }

    // 2. Balises interdites (la balise seule, le texte autour reste).
    for (const balise of BALISES_INTERDITES) {
        html = html.replace(new RegExp(`<\\/?${balise}\\b[^>]*>`, 'gi'), '');
    }

    // 3. Attributs gestionnaires d'événements : onerror, onclick, onload…
    html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
    html = html.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
    html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

    // 4. Schémas d'URL exécutables dans href/src/style.
    html = html.replace(/(href|src|xlink:href)\s*=\s*"(?:javascript|vbscript|data):[^"]*"/gi, '$1="#"');
    html = html.replace(/(href|src|xlink:href)\s*=\s*'(?:javascript|vbscript|data):[^']*'/gi, "$1='#'");
    html = html.replace(/(href|src|xlink:href)\s*=\s*(?:javascript|vbscript|data):[^\s>]+/gi, '$1="#"');

    // 5. `style` inline : porte d'injection (expression(), url(javascript:)).
    html = html.replace(/\sstyle\s*=\s*"[^"]*"/gi, '');
    html = html.replace(/\sstyle\s*=\s*'[^']*'/gi, '');

    // 6. Tout lien conservé s'ouvre sans donner accès à window.opener.
    html = html.replace(/<a\b([^>]*)>/gi, (balise, attrs) => {
        const sansRel = attrs.replace(/\srel\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
        return `<a${sansRel} rel="noopener noreferrer nofollow">`;
    });

    return html.trim();
};

export default { assainirRiche, assainirTexte };
