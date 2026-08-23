import express from 'express';
import { getMetricsSnapshot, resetMetrics } from '../middlewares/requestMetrics.js';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission } from '../middlewares/permission.js';

// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Dernier des 12
// fichiers du périmètre à basculer (voir RAMCI_Plan_Actions_Phases_MAJ8,
// section 3.0 — proposé comme galop d'essai, le plus petit : 1 route
// authentifiée sur 2).
//
// [PHASE 3 - OBSERVABILITÉ] Endpoint de lecture des métriques de latence.
//
// Volontairement non public : les temps de réponse par route renseignent sur
// la structure interne de l'API et sur les endpoints coûteux (donc sur les
// bonnes cibles d'un déni de service). Deux façons d'y accéder :
//
//   - en-tête `x-metrics-token` correspondant à la variable d'environnement
//     METRICS_TOKEN → pour les scripts (k6, CI, cron de collecte). Seul
//     appelant vivant : loadtest/lib/config.js. Chemin inchangé par cette
//     migration ;
//   - session staff authentifiée (cookie/Bearer `staffToken`) avec la
//     permission `admin.dashboard` → pour une consultation manuelle depuis
//     le panel admin. Remplace l'ancien chemin `sellerToken` (compte
//     technique unique) : aucun appelant frontend vivant ne s'authentifiait
//     ainsi (le panel admin utilise déjà staffToken partout ailleurs), et
//     `admin.dashboard` est la permission déjà utilisée pour les endpoints
//     d'observabilité voisins (voir routes/adminRoutes.js, /dashboard/*).
//
// Si METRICS_TOKEN n'est pas défini, seule la seconde voie fonctionne.

const metricsRouter = express.Router();

export const authMetrics = (req, res, next) => {
    const configuredToken = process.env.METRICS_TOKEN;
    const providedToken = req.get('x-metrics-token');

    // Comparaison uniquement si le token est configuré : sans ce garde-fou,
    // un METRICS_TOKEN absent rendrait l'endpoint ouvert à quiconque envoie
    // un en-tête vide.
    //
    if (configuredToken && providedToken && providedToken === configuredToken) {
        return next();
    }

    // Pas de token machine valide : on retombe sur une session staff RBAC.
    // authStaff n'appelle son callback (`next`) qu'en cas de succès — en
    // cas d'échec il répond directement (401/403), donc rien d'autre à
    // gérer ici pour ce cas.
    return authStaff(req, res, (err) => {
        if (err) return next(err);
        return requirePermission('admin.dashboard')(req, res, next);
    });
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