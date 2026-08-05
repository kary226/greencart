// [PHASE 3 - OBSERVABILITÉ] Mesure du temps de réponse de chaque requête API.
//
// Objectif : arrêter de deviner l'impact des optimisations. Sans mesure,
// impossible de dire si le cache Redis (Phase 2) ou les corrections N+1
// (Phase 0) ont réellement changé quelque chose sur les vrais parcours.
//
// Deux sorties complémentaires, volontairement sans dépendance externe :
//
//   1. Un log structuré (JSON une ligne) par requête. Sur Vercel, ces lignes
//      remontent telles quelles dans les logs de la fonction et sont donc
//      filtrables/agrégeables a posteriori, même si l'instance qui les a
//      produites a disparu depuis longtemps. C'est la source de vérité en
//      production.
//
//   2. Un agrégat en mémoire (P50/P95/P99 par route), exposé par
//      routes/metricsRoute.js. ATTENTION : en serverless, cet agrégat ne
//      couvre QUE l'instance qui répond à la requête /api/metrics — chaque
//      invocation Vercel a sa propre mémoire. Il est donc fiable :
//        - en local (`npm run server`, un seul process qui vit),
//        - pendant un test de charge k6 visant un serveur unique,
//      et purement indicatif sur un déploiement Vercel multi-instances.
//
// Aucune donnée personnelle n'est journalisée : ni IP, ni identifiant
// utilisateur, ni corps de requête. Uniquement méthode, route, statut, durée.

// Nombre de durées conservées par route pour le calcul des percentiles.
// 1000 échantillons suffisent largement pour un P95 stable et bornent la
// mémoire (~8 Ko par route) même sous un test de charge long.
const MAX_SAMPLES_PER_ROUTE = 1000;

// Au-delà de ce seuil, la requête est journalisée en `warn` plutôt qu'en
// `info` : ça rend les lenteurs visibles d'un coup d'œil dans les logs Vercel.
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS) || 1000;

// Le log par requête peut être coupé (METRICS_LOG=off) si le volume devient
// gênant : l'agrégat en mémoire, lui, continue de tourner.
const LOG_ENABLED = process.env.METRICS_LOG !== 'off';

/** @type {Map<string, {count:number, errors:number, samples:number[], cursor:number, totalMs:number, maxMs:number}>} */
const store = new Map();
let startedAt = Date.now();

/**
 * Réduit une URL concrète à un libellé de route stable.
 *
 * Sans ça, `/api/delivery/price/64f.../65a...` créerait une entrée de
 * métrique par couple commune/type de livraison — des milliers de lignes
 * inutilisables. On préfère toujours le motif Express (`req.route`), qui
 * donne directement `/price/:communeId/:deliveryTypeId`, et on ne retombe
 * sur une normalisation manuelle que si aucune route n'a matché (404).
 */
const routeLabel = (req) => {
    if (req.route?.path) {
        const base = req.baseUrl || '';
        const path = req.route.path === '/' ? '' : req.route.path;
        return `${base}${path}` || '/';
    }

    // Pas de route matchée (404, ou erreur avant le routage) : on normalise
    // les segments qui ressemblent à un identifiant pour éviter l'explosion
    // de cardinalité.
    return (req.path || req.originalUrl || '/')
        .split('?')[0]
        .split('/')
        .map((segment) => {
            if (/^[0-9a-fA-F]{24}$/.test(segment)) return ':id';   // ObjectId Mongo
            if (/^\d+$/.test(segment)) return ':n';
            return segment;
        })
        .join('/');
};

const percentile = (sortedAsc, p) => {
    if (sortedAsc.length === 0) return 0;
    // Méthode "nearest rank" : simple, sans interpolation, et suffisante
    // pour comparer un avant/après sur les mêmes scénarios.
    const rank = Math.ceil((p / 100) * sortedAsc.length);
    return sortedAsc[Math.min(rank, sortedAsc.length) - 1];
};

const record = (key, durationMs, isError) => {
    let entry = store.get(key);
    if (!entry) {
        entry = { count: 0, errors: 0, samples: [], cursor: 0, totalMs: 0, maxMs: 0 };
        store.set(key, entry);
    }

    entry.count += 1;
    if (isError) entry.errors += 1;
    entry.totalMs += durationMs;
    if (durationMs > entry.maxMs) entry.maxMs = durationMs;

    // Buffer circulaire : une fois plein, on écrase le plus ancien
    // échantillon. Les percentiles reflètent donc toujours les 1000
    // dernières requêtes, ce qui est le comportement souhaité pendant un
    // test de charge (on veut l'état sous charge, pas le démarrage à froid).
    if (entry.samples.length < MAX_SAMPLES_PER_ROUTE) {
        entry.samples.push(durationMs);
    } else {
        entry.samples[entry.cursor] = durationMs;
        entry.cursor = (entry.cursor + 1) % MAX_SAMPLES_PER_ROUTE;
    }
};

/**
 * Middleware Express à monter AVANT les routes.
 * Il ne fait rien de synchrone sur le chemin critique : tout le travail
 * (calcul + log) a lieu dans le callback `finish`, une fois la réponse
 * entièrement envoyée au client.
 */
export const requestMetrics = () => (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const label = routeLabel(req);
        const key = `${req.method} ${label}`;
        const isError = res.statusCode >= 500;

        record(key, durationMs, isError);

        if (LOG_ENABLED) {
            const line = JSON.stringify({
                type: 'http',
                ts: new Date().toISOString(),
                method: req.method,
                route: label,
                status: res.statusCode,
                ms: Math.round(durationMs * 10) / 10,
                // Permet de repérer ce qui vient du edge/navigateur (cache HIT)
                // vs ce qui a réellement atteint la fonction.
                cache: res.getHeader('Cache-Control') ? 'cacheable' : 'no-store',
            });

            if (durationMs >= SLOW_REQUEST_MS) console.warn(line);
            else console.log(line);
        }
    });

    next();
};

/**
 * Instantané agrégé, trié par P95 décroissant : les routes les plus lentes
 * pour l'utilisateur apparaissent en premier, ce qui est l'ordre dans lequel
 * on veut les traiter.
 */
export const getMetricsSnapshot = () => {
    const routes = [];
    let totalRequests = 0;
    let totalErrors = 0;

    for (const [key, entry] of store.entries()) {
        const sorted = [...entry.samples].sort((a, b) => a - b);
        const round = (n) => Math.round(n * 10) / 10;

        totalRequests += entry.count;
        totalErrors += entry.errors;

        routes.push({
            route: key,
            count: entry.count,
            errors: entry.errors,
            errorRate: round((entry.errors / entry.count) * 100),
            avgMs: round(entry.totalMs / entry.count),
            p50Ms: round(percentile(sorted, 50)),
            p95Ms: round(percentile(sorted, 95)),
            p99Ms: round(percentile(sorted, 99)),
            maxMs: round(entry.maxMs),
            sampled: sorted.length,
        });
    }

    routes.sort((a, b) => b.p95Ms - a.p95Ms);

    return {
        // Rappel explicite dans la réponse elle-même : évite de tirer des
        // conclusions fausses d'un /metrics lu sur un déploiement Vercel.
        scope: process.env.VERCEL
            ? 'instance-serverless-unique (partiel : voir les logs Vercel pour la vue complète)'
            : 'process-unique',
        collectedSince: new Date(startedAt).toISOString(),
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        totalRequests,
        totalErrors,
        routes,
    };
};

/**
 * Remet les compteurs à zéro. Utilisé entre deux runs k6 pour comparer des
 * mesures propres (sinon le warm-up du run précédent pollue les percentiles).
 */
export const resetMetrics = () => {
    store.clear();
    startedAt = Date.now();
};

export default requestMetrics;
