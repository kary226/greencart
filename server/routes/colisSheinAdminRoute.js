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

const router = express.Router();

// =============================================================
// ROUTES EXISTANTES (admin uniquement)
// =============================================================
router.get('/admin/all', authStaff, requireRole('admin'), getAllColisAdmin);
router.get('/admin/:id', authStaff, requireRole('admin'), getColisAdminById);
router.post('/admin/:id/validate', authStaff, requireRole('admin'), validateColis);
router.post('/admin/:id/statut', authStaff, requireRole('admin'), updateStatutColis);
router.post('/admin/:id/estimation-arrivee', authStaff, requireRole('admin'), definirEstimationArrivee);
router.get('/admin/:id/messages', authStaff, requireRole('admin'), getMessagesAdmin);
router.post('/admin/:id/messages', authStaff, requireRole('admin'), sendMessageAgent);
router.post('/admin/:id/typing', authStaff, requireRole('admin'), setAgentTyping);

// =============================================================
// ✅ PHASE 5 : NOUVELLES ROUTES (Assistant/Admin)
// =============================================================

// Routes Assistant/Admin
router.get('/conversations', authStaff, requireRole('admin', 'assistant_shein'), getConversations);
router.get('/conversations/:id', authStaff, requireRole('admin', 'assistant_shein'), getConversationDetail);
router.get('/stats', authStaff, requireRole('admin'), getConversationStats);

// Routes Admin uniquement
router.patch('/assigner', authStaff, requireRole('admin'), assignerConversation);
router.get('/assistants-disponibles', authStaff, requireRole('admin'), getAssistantsDisponibles);
router.post('/conversations', authStaff, requireRole('admin'), createConversation);
router.delete('/conversations/:id', authStaff, requireRole('admin'), deleteConversation);
router.patch('/conversations/:id/statut', authStaff, requireRole('admin', 'assistant_shein'), updateConversationStatut);

export default router;