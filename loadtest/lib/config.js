// [PHASE 3 - OBSERVABILITÉ] Configuration partagée des tests de charge k6.
//
// Tout est piloté par variables d'environnement pour qu'un même script serve
// aussi bien au smoke test local qu'au stress test sur préproduction, sans
// avoir à éditer le code entre deux runs (ce qui rendrait les comparaisons
// avant/après douteuses).

// Cible du test. Par défaut le serveur local : viser accidentellement la
// production doit demander un geste explicite.
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// Hôtes considérés comme la production réelle. Les scénarios qui écrivent en
// base (panier, commande) refusent de démarrer contre l'un d'eux.
const PRODUCTION_HOSTS = ['ramci.ci', 'www.ramci.ci', 'ramci.vercel.app'];

export const isProductionTarget = () =>
    PRODUCTION_HOSTS.some((host) => BASE_URL.includes(host));

// Profils de charge. L'audit demandait 100 à 500 utilisateurs simultanés sur
// les parcours critiques : c'est `load` et `stress`.
//
//   smoke  : vérifie que le scénario fonctionne (à lancer en premier, toujours)
//   load   : 100 VU — charge nominale d'un jour de forte affluence
//   stress : 500 VU — cherche le point de rupture
const PROFILES = {
    smoke: [
        { duration: '20s', target: 5 },
    ],
    load: [
        { duration: '1m', target: 50 },   // montée progressive
        { duration: '2m', target: 100 },  // palier
        { duration: '3m', target: 100 },  // maintien : c'est ici qu'on lit les chiffres
        { duration: '30s', target: 0 },   // descente
    ],
    stress: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 300 },
        { duration: '2m', target: 500 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 0 },
    ],
};

export const PROFILE = __ENV.PROFILE || 'smoke';

export const stages = () => {
    const stages = PROFILES[PROFILE];
    if (!stages) {
        throw new Error(
            `PROFILE inconnu : "${PROFILE}". Valeurs possibles : ${Object.keys(PROFILES).join(', ')}`
        );
    }
    return stages;
};

// Seuils d'échec du test. Un run qui les dépasse sort en code 1, ce qui
// permet de brancher les tests de charge sur une CI plus tard.
//
// 800 ms de P95 est un objectif volontairement atteignable sur une API
// serverless avec cold starts ; à resserrer une fois la référence établie.
export const thresholds = (extra = {}) => ({
    http_req_failed: ['rate<0.01'],          // moins de 1 % de requêtes en échec
    http_req_duration: ['p(95)<800'],        // P95 global sous 800 ms
    checks: ['rate>0.99'],                   // 99 % des assertions métier passent
    ...extra,
});

// En-têtes communs. `x-loadtest-token` fait sauter les limiteurs de débit
// applicatifs (voir server/middlewares/rateLimiters.js) : sans lui, un test
// à 100 VU depuis une seule IP ne mesurerait que le rate limiter.
export const headers = () => {
    const base = { 'Content-Type': 'application/json' };
    if (__ENV.LOADTEST_TOKEN) base['x-loadtest-token'] = __ENV.LOADTEST_TOKEN;
    return base;
};

/**
 * Remet les métriques serveur à zéro avant le run, pour que les P50/P95 lus
 * ensuite sur /api/metrics ne soient pas pollués par le trafic précédent.
 * Silencieux si METRICS_TOKEN n'est pas fourni — l'absence de reset ne doit
 * pas empêcher le test de tourner.
 */
export const resetServerMetrics = (http) => {
    if (!__ENV.METRICS_TOKEN) return;
    const res = http.post(`${BASE_URL}/api/metrics/reset`, null, {
        headers: { 'x-metrics-token': __ENV.METRICS_TOKEN },
    });
    console.log(
        res.status === 200
            ? '→ Métriques serveur réinitialisées'
            : `→ Reset des métriques ignoré (HTTP ${res.status})`
    );
};

/**
 * Récupère l'instantané serveur en fin de run et l'affiche trié par P95.
 * C'est la vue côté serveur, complémentaire des chiffres k6 (qui incluent,
 * eux, la latence réseau depuis la machine de test).
 */
export const printServerMetrics = (http) => {
    if (!__ENV.METRICS_TOKEN) {
        console.log('→ METRICS_TOKEN non fourni : pas de relevé serveur (chiffres k6 uniquement)');
        return;
    }

    const res = http.get(`${BASE_URL}/api/metrics`, {
        headers: { 'x-metrics-token': __ENV.METRICS_TOKEN },
    });

    if (res.status !== 200) {
        console.log(`→ Lecture de /api/metrics impossible (HTTP ${res.status})`);
        return;
    }

    const { metrics } = res.json();
    console.log(`\n=== Vue serveur (${metrics.scope}) ===`);
    console.log(`Requêtes : ${metrics.totalRequests} — erreurs 5xx : ${metrics.totalErrors}`);
    for (const r of metrics.routes.slice(0, 15)) {
        console.log(
            `  ${r.route.padEnd(42)} n=${String(r.count).padStart(6)}  ` +
            `p50=${String(r.p50Ms).padStart(7)}ms  p95=${String(r.p95Ms).padStart(7)}ms  ` +
            `p99=${String(r.p99Ms).padStart(7)}ms  err=${r.errorRate}%`
        );
    }
};

/**
 * Authentification unique, à appeler depuis `setup()` et non depuis le corps
 * du test : le limiteur de connexion (10 tentatives / 15 min) n'est
 * volontairement pas contournable, et un test réaliste n'a de toute façon pas
 * besoin de reconnecter chaque utilisateur virtuel à chaque itération.
 *
 * Retourne le cookie de session à réinjecter dans les requêtes des VUs.
 */
export const loginOnce = (http, check) => {
    const email = __ENV.TEST_EMAIL;
    const password = __ENV.TEST_PASSWORD;

    if (!email || !password) {
        throw new Error(
            'TEST_EMAIL et TEST_PASSWORD sont requis pour ce scénario.\n' +
            'Utilisez un compte de test dédié, jamais un compte client réel.'
        );
    }

    const res = http.post(
        `${BASE_URL}/api/user/login`,
        JSON.stringify({ email, password }),
        { headers: headers() }
    );

    const ok = check(res, {
        'login: HTTP 200': (r) => r.status === 200,
        'login: succès': (r) => r.json('success') === true,
    });

    if (!ok) {
        throw new Error(`Connexion impossible (HTTP ${res.status}) : ${res.body}`);
    }

    const token = res.cookies?.token?.[0]?.value;
    if (!token) {
        throw new Error("Le cookie 'token' est absent de la réponse de login.");
    }

    return token;
};

/** En-têtes d'une requête authentifiée, à partir du token issu de loginOnce. */
export const authHeaders = (token) => ({
    ...headers(),
    Cookie: `token=${token}`,
});
