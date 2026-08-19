import { authenticator } from 'otplib';

// Vérification de bout en bout contre la base LOCALE, serveur démarré
// (« npm run local » dans un autre terminal).
//
//   node scripts/verifierLocal.js
//
// Chaque contrôle rejoue un comportement qu'on a corrigé ou ajouté : si l'un
// d'eux repasse au rouge, c'est une régression, pas une curiosité.
// Contrairement aux tests unitaires, celui-ci traverse le vrai serveur, les
// vrais middlewares et la vraie base.

const BASE = process.argv[2] || 'http://localhost:4000';
const MOT_DE_PASSE = 'MotDePasseLocal123';

let ok = 0;
let ko = 0;

const verifier = (libelle, condition, detail = '') => {
    if (condition) {
        console.log(`✅ ${libelle}`);
        ok += 1;
    } else {
        console.log(`❌ ${libelle}${detail ? ' — ' + detail : ''}`);
        ko += 1;
    }
};

// Client HTTP qui conserve les cookies, comme un navigateur.
const client = () => {
    const cookies = new Map();
    return async (chemin, options = {}) => {
        const entete = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
        const res = await fetch(`${BASE}${chemin}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(entete ? { Cookie: entete } : {}),
                ...(options.headers || {}),
            },
        });
        const brut = res.headers.getSetCookie?.() || [];
        for (const c of brut) {
            const [paire] = c.split(';');
            const [nom, valeur] = paire.split('=');
            cookies.set(nom, valeur);
        }
        let data = {};
        try { data = await res.json(); } catch { /* réponse non JSON */ }
        return { status: res.status, data };
    };
};

const connecterStaff = async (email, secret) => {
    const c = client();
    const r = await c('/api/staff/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: MOT_DE_PASSE, totpCode: authenticator.generate(secret) }),
    });
    return { c, r };
};

const run = async () => {
    try {
        await fetch(BASE);
    } catch {
        console.log(`❌ ${BASE} injoignable — lancez « npm run local » dans un autre terminal.`);
        process.exit(1);
    }

    const anonyme = client();

    // ---- Catalogue : le défaut d'origine ----
    const cat = await anonyme('/api/product/catalogue');
    const liste = await anonyme('/api/product/list');
    verifier('Le catalogue complet renvoie plus que la page par défaut',
        cat.data.products?.length > liste.data.products?.length,
        `catalogue ${cat.data.products?.length} vs liste ${liste.data.products?.length}`);
    verifier("Le catalogue n'expose ni description ni prix d'achat",
        !('description' in (cat.data.products?.[0] || {}))
        && !('purchasePrice' in (cat.data.products?.[0] || {})));

    // ---- Fiche produit accessible par lien direct ----
    const dernier = cat.data.products?.[cat.data.products.length - 1];
    const fiche = await anonyme(`/api/product/id?id=${dernier?._id}`);
    verifier('Un article hors première page reste accessible par son identifiant',
        fiche.data.success && fiche.data.product?._id === dernier?._id);

    // ---- Recherche côté serveur ----
    const recherche = await anonyme('/api/product/list?search=Sandales');
    verifier('La recherche serveur filtre réellement',
        recherche.data.products?.length > 0
        && recherche.data.products.every((p) => /sandales/i.test(p.name)),
        JSON.stringify(recherche.data.products?.map((p) => p.name)));

    const redos = await anonyme('/api/product/list?search=' + encodeURIComponent('(a+)+$'));
    verifier('Un motif ReDoS est traité comme du texte, sans blocage',
        redos.status === 200);

    // ---- Comptes de démonstration ----
    const { default: mongooseIgnore } = { default: null }; // pas de base ici
    const admin = await connecterStaff('admin@local.test', 'JBSWY3DPEHPK3PXP');
    verifier('Connexion admin staff', admin.r.data.success === true, JSON.stringify(admin.r.data));

    const boutiques = await admin.c('/api/boutiques');
    verifier("L'admin voit les boutiques et leurs droits",
        boutiques.data.success && boutiques.data.boutiques?.length >= 2);

    const ouverte = boutiques.data.boutiques?.find((b) => b.peutCreerProduits);
    const fermee = boutiques.data.boutiques?.find((b) => !b.peutCreerProduits);
    verifier('Une boutique autorisée et une non autorisée sont distinguées',
        Boolean(ouverte && fermee));

    // ---- Droit de création ----
    const secretFerme = process.env.SECRET_FERME;
    if (secretFerme) {
        const commercant = await connecterStaff('boutique-fermee@local.test', secretFerme);
        const tentative = await commercant.c('/api/product/staff/add', { method: 'POST', body: '{}' });
        verifier("Une boutique sans droit de création se voit refuser l'ajout",
            tentative.status === 403,
            JSON.stringify(tentative.data));
    }

    // ---- Journal ----
    const journal = await admin.c('/api/journal');
    verifier('Le journal des actions est consultable par l_admin',
        journal.data.success === true, JSON.stringify(journal.data).slice(0, 120));

    const journalCommercant = client();
    const refus = await journalCommercant('/api/journal');
    verifier('Le journal est refusé à qui n_est pas connecté', refus.status === 401);

    // ---- 404 JSON ----
    const inconnu = await anonyme('/api/nexiste-pas');
    verifier('Une route d_API inconnue répond en JSON, pas en HTML',
        inconnu.status === 404 && inconnu.data.success === false);

    console.log('\n─────────────────────────────────────────');
    console.log(`Résultat : ${ok} réussi(s), ${ko} échoué(s)`);
    console.log('─────────────────────────────────────────');
    process.exit(ko > 0 ? 1 : 0);
};

run();
