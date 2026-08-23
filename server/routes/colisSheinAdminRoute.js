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
router.get('/admin/all', authStaff, requireRole('admin', 'super_admin'), getAllColisAdmin);
// [CORRECTIF AUDIT] Doit être déclarée AVANT /admin/:id, sinon
// "/admin/avis/stats" est interprétée comme /admin/:id avec id="avis" —
// même piège déjà documenté et évité plus bas dans sheinCartRoute.js.
router.get('/admin/avis/stats', authStaff, requireRole('admin', 'super_admin'), getStatsAvis);
router.get('/admin/:id', authStaff, requireRole('admin', 'super_admin'), getColisAdminById);
router.post('/admin/:id/validate', authStaff, requireRole('admin', 'super_admin'), validateColis);
router.post('/admin/:id/statut', authStaff, requireRole('admin', 'super_admin'), updateStatutColis);
router.post('/admin/:id/estimation-arrivee', authStaff, requireRole('admin', 'super_admin'), definirEstimationArrivee);
// [CORRECTIF AUDIT] Équivalent RBAC de l'ancienne route authSeller.
router.post('/admin/:id/demander-avis', authStaff, requireRole('admin', 'super_admin'), demanderAvis);
router.get('/admin/:id/messages', authStaff, requireRole('admin', 'super_admin'), getMessagesAdmin);
router.post('/admin/:id/messages', authStaff, requireRole('admin', 'super_admin'), sendMessageAgent);
router.post('/admin/:id/typing', authStaff, requireRole('admin', 'super_admin'), setAgentTyping);

// =============================================================
// ✅ PHASE 5 : NOUVELLES ROUTES (Assistant/Admin)
// =============================================================

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

export default router;