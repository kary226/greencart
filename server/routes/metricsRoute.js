import express from 'express';
import jwt from 'jsonwebtoken';
import { getMetricsSnapshot, resetMetrics } from '../middlewares/requestMetrics.js';
import { TYPE_VENDEUR, verifierType } from '../utils/jwtTypes.js';

// [PHASE 3 - OBSERVABILITÉ] Endpoint de lecture des métriques de latence.
//
// Volontairement non public : les temps de réponse par route renseignent sur
// la structure interne de l'API et sur les endpoints coûteux (donc sur les
// bonnes cibles d'un déni de service). Deux façons d'y accéder :
//
//   - en-tête `x-metrics-token` correspondant à la variable d'environnement
//     METRICS_TOKEN → pour les scripts (k6, CI, cron de collecte) ;
//   - cookie/Bearer `sellerToken` valide → pour une consultation manuelle
//     depuis un navigateur déjà connecté à l'espace admin.
//
// Si METRICS_TOKEN n'est pas défini, seule la seconde voie fonctionne.

const metricsRouter = express.Router();

const isValidSellerToken = (token) => {
    if (!token) return false;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // [SÉCURITÉ] Même contrôle de type que authSeller — voir
        // utils/jwtTypes.js.
        if (!verifierType(decoded, TYPE_VENDEUR)) return false;
        return decoded.email === process.env.SELLER_EMAIL;
    } catch {
        return false;
    }
};

const authMetrics = (req, res, next) => {
    const configuredToken = process.env.METRICS_TOKEN;
    const providedToken = req.get('x-metrics-token');

    // Comparaison uniquement si le token est configuré : sans ce garde-fou,
    // un METRICS_TOKEN absent rendrait l'endpoint ouvert à quiconque envoie
    // un en-tête vide.
    //
    if (configuredToken && providedToken && providedToken === configuredToken) {
        return next();
    }

    const sellerToken = req.cookies?.sellerToken
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    if (isValidSellerToken(sellerToken)) return next();

    return res.status(401).json({ success: false, message: 'Accès non autorisé aux métriques' });
};

// `no-store` explicite : ces chiffres changent à chaque requête, il ne faut
// surtout pas qu'ils soient mis en cache par le edge Vercel.
const noStore = (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
};

// GET /api/metrics — instantané P50/P95/P99 par route
metricsRouter.get('/', noStore, authMetrics, (req, res) => {
    res.json({ success: true, metrics: getMetricsSnapshot() });
});

// POST /api/metrics/reset — remise à zéro entre deux runs de test de charge
metricsRouter.post('/reset', noStore, authMetrics, (req, res) => {
    resetMetrics();
    res.json({ success: true, message: 'Métriques réinitialisées' });
});

export default metricsRouter;
