import express from 'express';
import { upload } from '../configs/multer.js';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission, requireAnyPermission } from '../middlewares/permission.js';

// ─── Contrôleurs Phase 4 (Entrepôt & Retours) ──────────────────────────

import {
    createWarehouseScan,
    getWarehouseScans,
    listWarehouseScans,
} from '../controllers/warehouseController.js';

import {
    listReturns,
    getReturnById,
    openReturn,
    receiveReturn,
    inspectReturn,
    resolveReturn,
    rejectReturn,
    escalateReturn,
} from '../controllers/returnController.js';

// ─── Contrôleurs Phase 5 (Remboursements) ──────────────────────────────

import {
    listRefunds,
    getRefundById,
    createRefund,
    approveRefund,
    rejectRefund,
    completeRefund,
} from '../controllers/refundController.js';

// ─── Contrôleurs RCOINS ─────────────────────────────────────────────────

import {
    listRcoinsBalances,
    listRcoinsTransactions,
} from '../controllers/rcoinsController.js';

// ─── Contrôleurs Phase 6 (Rapprochement & KPIs) ─────────────────────────

import {
    runReconciliation,
    listEcards,
    resolveEcart,
    getReconciliationStatsController,
} from '../controllers/reconciliationController.js';

import {
    getDashboardStats,
    getAdvancedKPIs,
} from '../controllers/dashboardController.js';

// ─── Approbations (double validation) ───────────────────────────────────

import {
    listApprovals,
    approuverApproval,
    rejeterApproval,
} from '../controllers/approvalController.js';

// =============================================================
// ROUTEUR ADMIN UNIFIÉ
//
// NOTE (nettoyage 2026-08-31) : ce fichier contenait auparavant ~80 routes
// dupliquant produits / catégories / coupons / bannières / livraison /
// localisations / comptes staff / boutiques / retraits / wallet / audit /
// commandes déjà exposées par leurs routeurs dédiés (productRoute.js,
// categoryRoute.js, staffRoute.js, boutiqueRoute.js, retraitRoute.js,
// walletRoute.js, journalRoute.js, etc.) — routes JAMAIS appelées par le
// frontend, qui utilise exclusivement ces routeurs dédiés.
// Elles ont été supprimées. Seules restent ici les routes réellement
// consommées par les pages client/src/pages/admin/{Dashboard,Approvals,
// Refunds,Returns,Rcoins,RcoinsTransactions,Reconciliation,Warehouse}.jsx.
// La sauvegarde de l'ancienne version se trouve dans l'historique git.
// =============================================================

const adminRouter = express.Router();

// =============================================================
// 1. TABLEAU DE BORD
// =============================================================

adminRouter.get(
    '/dashboard/stats',
    authStaff,
    requirePermission('admin.dashboard'),
    getDashboardStats
);

adminRouter.get(
    '/dashboard/kpis',
    authStaff,
    requirePermission('admin.dashboard'),
    getAdvancedKPIs
);

// =============================================================
// 2. APPROBATIONS (double validation des opérations sensibles)
// =============================================================

adminRouter.get(
    '/approvals',
    authStaff,
    requirePermission('wallet.view'),
    listApprovals
);

adminRouter.post(
    '/approvals/:id/approuver',
    authStaff,
    requirePermission('wallet.adjust'),
    approuverApproval
);

adminRouter.post(
    '/approvals/:id/rejeter',
    authStaff,
    requirePermission('wallet.adjust'),
    rejeterApproval
);

// =============================================================
// 3. ENTREPÔT & RETOURS (PHASE 4)
// =============================================================

adminRouter.post(
    '/warehouse/scan',
    authStaff,
    requirePermission('warehouse.scan'),
    upload.array('photos', 5),
    createWarehouseScan
);

adminRouter.get(
    '/warehouse/scans/:orderId',
    authStaff,
    requirePermission('warehouse.scan'),
    getWarehouseScans
);

adminRouter.get(
    '/warehouse/scans',
    authStaff,
    requirePermission('warehouse.scan'),
    listWarehouseScans
);

adminRouter.get(
    '/returns',
    authStaff,
    requirePermission('returns.view'),
    listReturns
);

adminRouter.get(
    '/returns/:id',
    authStaff,
    requirePermission('returns.view'),
    getReturnById
);

// [RAMCI §10] Ouverture d'un retour par Support — étape absente jusqu'ici :
// le ReturnCase n'était créé par aucune route staff, alors que §10 place
// Support en tête du flux.
adminRouter.post(
    '/returns',
    authStaff,
    requireAnyPermission(['disputes.open', 'returns.view', 'clients.edit']),
    openReturn
);

// [RAMCI §10] Réception physique du colis retourné — Opérations.
adminRouter.post(
    '/returns/:id/receive',
    authStaff,
    requireAnyPermission(['returns.inspect', 'warehouse.scan']),
    receiveReturn
);

adminRouter.post(
    '/returns/:id/inspect',
    authStaff,
    requirePermission('returns.inspect'),
    inspectReturn
);

// [RAMCI §10, §12, §19 cas C] Escalade d'un retour contesté au Super Admin.
// Tout domaine qui voit le dossier peut le remonter ; seul le Super Admin
// tranche (voir approvalRoute).
adminRouter.post(
    '/returns/:id/escalader',
    authStaff,
    requireAnyPermission(['exceptions.request', 'returns.view']),
    escalateReturn
);

adminRouter.post(
    '/returns/:id/resolve',
    authStaff,
    requirePermission('returns.decide'),
    resolveReturn
);

adminRouter.post(
    '/returns/:id/reject',
    authStaff,
    requirePermission('returns.decide'),
    rejectReturn
);

// =============================================================
// 4. REMBOURSEMENTS (PHASE 5)
// =============================================================

adminRouter.get(
    '/refunds',
    authStaff,
    requirePermission('refunds.view'),
    listRefunds
);

adminRouter.get(
    '/refunds/:id',
    authStaff,
    requirePermission('refunds.view'),
    getRefundById
);

adminRouter.post(
    '/refunds',
    authStaff,
    requirePermission('refunds.create'),
    createRefund
);

adminRouter.post(
    '/refunds/:id/approve',
    authStaff,
    requirePermission('refunds.approve'),
    approveRefund
);

adminRouter.post(
    '/refunds/:id/reject',
    authStaff,
    requirePermission('refunds.approve'),
    rejectRefund
);

adminRouter.post(
    '/refunds/:id/complete',
    authStaff,
    requirePermission('refunds.approve'),
    completeRefund
);

// =============================================================
// 5. RCOINS
// =============================================================

adminRouter.get(
    '/rcoins',
    authStaff,
    requirePermission('rcoins.view'),
    listRcoinsBalances
);

adminRouter.get(
    '/rcoins/transactions',
    authStaff,
    requirePermission('rcoins.view'),
    listRcoinsTransactions
);

// =============================================================
// 6. RAPPROCHEMENT & KPI (PHASE 6)
// =============================================================

adminRouter.post(
    '/reconciliation/run',
    authStaff,
    requirePermission('finance.reconcile'),
    runReconciliation
);

adminRouter.get(
    '/reconciliation/ecarts',
    authStaff,
    requirePermission('finance.reconcile'),
    listEcards
);

adminRouter.post(
    '/reconciliation/ecarts/:id/resoudre',
    authStaff,
    requirePermission('finance.reconcile'),
    resolveEcart
);

adminRouter.get(
    '/reconciliation/stats',
    authStaff,
    requirePermission('finance.reconcile'),
    getReconciliationStatsController
);

export default adminRouter;