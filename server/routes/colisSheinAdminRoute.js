import express from 'express';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
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

const router = express.Router();

// =============================================================
// ROUTES EXISTANTES (admin uniquement)
// =============================================================
// [FIX 23 août 2026] Préfixe /admin retiré : ce routeur est déjà monté sur
// /api/shein-cart/admin dans server.js. Le garder ici doublait le segment
// (/api/shein-cart/admin/admin/all) et cassait toutes ces routes en 404 —
// contrairement au bloc PHASE 5 plus bas, écrit après le montage actuel et
// donc jamais affecté par ce doublon.
router.get('/all', authStaff, requireRole('admin', 'super_admin'), getAllColisAdmin);
// [CORRECTIF AUDIT] Doit être déclarée AVANT /:id, sinon
// "/avis/stats" est interprétée comme /:id avec id="avis" —
// même piège déjà documenté et évité plus bas dans sheinCartRoute.js.
router.get('/avis/stats', authStaff, requireRole('admin', 'super_admin'), getStatsAvis);

// =============================================================
// ✅ PHASE 5 : NOUVELLES ROUTES (Assistant/Admin)
// =============================================================
// [FIX 23 août 2026] Ce bloc doit rester déclaré AVANT /:id ci-dessous :
// /conversations, /stats et /assistants-disponibles sont des routes GET à
// un seul segment, tout comme /:id. Express matche dans l'ordre de
// déclaration — si /:id passait en premier, il absorberait ces trois
// routes (ex. GET /stats interprété comme GET /:id avec id="stats").

// Routes Assistant/Admin
router.get('/conversations', authStaff, requireRole('admin', 'assistant_shein'), getConversations);
router.get('/conversations/:id', authStaff, requireRole('admin', 'assistant_shein'), getConversationDetail);
router.get('/stats', authStaff, requireRole('admin', 'super_admin'), getConversationStats);

// Routes Admin uniquement
router.patch('/assigner', authStaff, requireRole('admin', 'super_admin'), assignerConversation);
router.get('/assistants-disponibles', authStaff, requireRole('admin', 'super_admin'), getAssistantsDisponibles);
router.post('/conversations', authStaff, requireRole('admin', 'super_admin'), createConversation);
router.delete('/conversations/:id', authStaff, requireRole('admin', 'super_admin'), deleteConversation);
router.patch('/conversations/:id/statut', authStaff, requireRole('admin', 'assistant_shein'), updateConversationStatut);

// =============================================================
// Routes génériques /:id — doivent rester déclarées APRÈS toutes les
// routes littérales ci-dessus, pour la même raison.
// =============================================================
router.get('/:id', authStaff, requireRole('admin', 'super_admin'), getColisAdminById);
router.post('/:id/validate', authStaff, requireRole('admin', 'super_admin'), validateColis);
router.post('/:id/statut', authStaff, requireRole('admin', 'super_admin'), updateStatutColis);
router.post('/:id/estimation-arrivee', authStaff, requireRole('admin', 'super_admin'), definirEstimationArrivee);
// [CORRECTIF AUDIT] Équivalent RBAC de l'ancienne route authSeller.
router.post('/:id/demander-avis', authStaff, requireRole('admin', 'super_admin'), demanderAvis);
router.get('/:id/messages', authStaff, requireRole('admin', 'super_admin'), getMessagesAdmin);
router.post('/:id/messages', authStaff, requireRole('admin', 'super_admin'), sendMessageAgent);
router.post('/:id/typing', authStaff, requireRole('admin', 'super_admin'), setAgentTyping);

export default router;