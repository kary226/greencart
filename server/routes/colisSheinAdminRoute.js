import express from 'express';
import authStaff from '../middlewares/authStaff.js';
import {
    getAllColisAdmin,
    getColisAdminById,
    validateColis,
    updateStatutColis,
    definirEstimationArrivee,
    getMessagesAdmin,
    sendMessageAgent,
    setAgentTyping,
    getConversations,
    getConversationDetail,
    assignerConversation,
    getAssistantsDisponibles,
    getConversationStats,
    createConversation,
    deleteConversation,
    updateConversationStatut,
} from '../controllers/colisSheinAdminController.js';
// [CORRECTIF AUDIT — 23 août 2026] demanderAvis et getStatsAvis existaient
// déjà dans sheinCartRoute.js (protégées par authSeller) mais n'avaient
// jamais rejoint ce routeur RBAC lors de la Phase 0bis. Comme
// colisSheinAdminRouter est monté avant sheinCartRouter dans server.js,
// ces deux fonctions restaient de fait accessibles UNIQUEMENT via le
// compte technique seller — un compte assistant_shein ou admin (StaffUser)
// ne pouvait ni demander un avis client ni consulter les statistiques
// d'avis. Voir Rapport d'audit d'implémentation, section 5.
import { demanderAvis, getStatsAvis } from '../controllers/avisController.js';
import { requireAnyPermission, requirePermission } from '../middlewares/permission.js';

const router = express.Router();

// =============================================================
// ROUTES EXISTANTES (admin uniquement)
// =============================================================
// [FIX 23 août 2026] Préfixe /admin retiré : ce routeur est déjà monté sur
// /api/shein-cart/admin dans server.js. Le garder ici doublait le segment
// (/api/shein-cart/admin/admin/all) et cassait toutes ces routes en 404 —
// contrairement au bloc PHASE 5 plus bas, écrit après le montage actuel et
// donc jamais affecté par ce doublon.
router.get('/all', authStaff, requirePermission('shein.view'), getAllColisAdmin);
// [CORRECTIF AUDIT] Doit être déclarée AVANT /:id, sinon
// "/avis/stats" est interprétée comme /:id avec id="avis" —
// même piège déjà documenté et évité plus bas dans sheinCartRoute.js.
router.get('/avis/stats', authStaff, requirePermission('shein.view'), getStatsAvis);

// =============================================================
// ✅ PHASE 5 : NOUVELLES ROUTES (Assistant/Admin)
// =============================================================
// [FIX 23 août 2026] Ce bloc doit rester déclaré AVANT /:id ci-dessous :
// /conversations, /stats et /assistants-disponibles sont des routes GET à
// un seul segment, tout comme /:id. Express matche dans l'ordre de
// déclaration — si /:id passait en premier, il absorberait ces trois
// routes (ex. GET /stats interprété comme GET /:id avec id="stats").

// Routes Assistant/Admin
// [RAMCI §16] Ces routes listaient le rôle historique `admin` SANS
// `super_admin`. Migrer le compte principal vers super_admin — ce que le
// guide recommande — lui aurait donc fait perdre ces écrans du jour au
// lendemain. Elles vérifient désormais une permission : le Super Admin
// passe par admin.all, l'Assistant SHEIN par ses propres droits.
router.get('/conversations', authStaff, requireAnyPermission(['shein.view', 'admin.all']), getConversations);
router.get('/conversations/:id', authStaff, requireAnyPermission(['shein.view', 'admin.all']), getConversationDetail);
router.get('/stats', authStaff, requirePermission('shein.view'), getConversationStats);

// Routes Admin uniquement
router.patch('/assigner', authStaff, requirePermission('admin.configure'), assignerConversation);
router.get('/assistants-disponibles', authStaff, requirePermission('admin.configure'), getAssistantsDisponibles);
router.post('/conversations', authStaff, requirePermission('shein.update'), createConversation);
router.delete('/conversations/:id', authStaff, requirePermission('admin.configure'), deleteConversation);
router.patch('/conversations/:id/statut', authStaff, requireAnyPermission(['shein.update', 'admin.all']), updateConversationStatut);

// =============================================================
// Routes génériques /:id — doivent rester déclarées APRÈS toutes les
// routes littérales ci-dessus, pour la même raison.
// =============================================================
router.get('/:id', authStaff, requirePermission('shein.view'), getColisAdminById);
router.post('/:id/validate', authStaff, requirePermission('shein.update'), validateColis);
router.post('/:id/statut', authStaff, requirePermission('shein.update'), updateStatutColis);
router.post('/:id/estimation-arrivee', authStaff, requirePermission('shein.update'), definirEstimationArrivee);
// [CORRECTIF AUDIT] Équivalent RBAC de l'ancienne route authSeller.
router.post('/:id/demander-avis', authStaff, requirePermission('shein.update'), demanderAvis);
router.get('/:id/messages', authStaff, requirePermission('shein.view'), getMessagesAdmin);
router.post('/:id/messages', authStaff, requirePermission('shein.update'), sendMessageAgent);
router.post('/:id/typing', authStaff, requirePermission('shein.update'), setAgentTyping);

export default router;