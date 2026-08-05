import rateLimit from 'express-rate-limit';

// [PHASE 2 - PERF] Limiteurs de débit partagés.
//
// Certaines routes (auth) avaient déjà leur propre limiteur défini
// localement (userRoute.js, sellerRoute.js, staffRoute.js, reviewRoute.js).
// On les laisse tels quels pour ne rien casser, et on centralise ici les
// limiteurs pour les routes encore non protégées : création de commande,
// initiation de paiement, validation de coupon, et lecture publique du
// catalogue (recherche/listing).
//
// Le message et le format de réponse suivent la même convention que les
// limiteurs déjà en place ailleurs dans le code.

// [PHASE 3 - OBSERVABILITÉ] Dérogation pour les tests de charge.
//
// Un test k6 à 100-500 utilisateurs simultanés part d'une seule machine,
// donc d'une seule IP : sans dérogation, il se ferait limiter dès la
// première seconde et ne mesurerait plus que la vitesse du rate limiter.
//
// Deux verrous cumulatifs, tous deux explicites :
//   - LOADTEST_TOKEN doit être défini côté serveur (absent = aucune
//     dérogation possible, quoi qu'envoie le client) ;
//   - la requête doit porter l'en-tête `x-loadtest-token` avec cette valeur.
//
// ⚠️ Ne JAMAIS définir LOADTEST_TOKEN sur le projet Vercel de production :
// cette variable n'a de sens que sur un environnement de préproduction dédié
// aux tests. Ne s'applique volontairement pas aux limiteurs d'authentification
// (login, activation, mot de passe oublié), qui restent intouchables — les
// scripts k6 s'authentifient une seule fois dans leur phase `setup()`.
const isLoadTestRequest = (req) => {
    const configured = process.env.LOADTEST_TOKEN;
    if (!configured) return false;
    return req.get('x-loadtest-token') === configured;
};

const buildLimiter = (windowMs, max) => rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isLoadTestRequest,
    message: { success: false, message: 'Trop de tentatives, réessayez plus tard.' },
});

// Création de commande (COD) : une personne légitime ne passe pas des
// dizaines de commandes par minute. Protège contre le spam de commandes
// bidon et les abus de stock (réservation fictive).
export const orderCreationLimiter = buildLimiter(10 * 60 * 1000, 15); // 15 / 10 min / IP

// Initiation de paiement GeniusPay : chemin sensible, chaque appel déclenche
// un aller-retour vers le prestataire de paiement.
export const paymentLimiter = buildLimiter(10 * 60 * 1000, 15); // 15 / 10 min / IP

// Validation de code promo : cible classique de brute-force pour deviner
// des codes valides. Volontairement strict.
export const couponLimiter = buildLimiter(15 * 60 * 1000, 20); // 20 / 15 min / IP

// Lecture publique du catalogue (listing/recherche) : déjà soulagée par le
// Cache-Control (Phase 0), ce limiteur est une protection additionnelle
// contre le scraping agressif, avec une marge large pour ne pas gêner la
// navigation normale.
export const publicCatalogLimiter = buildLimiter(60 * 1000, 120); // 120 / min / IP

export default buildLimiter;