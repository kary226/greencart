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

const buildLimiter = (windowMs, max) => rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
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