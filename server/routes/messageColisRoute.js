import express from 'express';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import {
    getMessages,
    sendMessageClient,
    setClientTyping,
    sendMessage,
    getMessagesStaff,
    updateColisStatut,
    sendDevis,
} from '../controllers/messageColisController.js';

const router = express.Router();

// =============================================================
// ROUTES CLIENT (existantes)
// =============================================================
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessageClient);
router.post('/:id/typing', setClientTyping);

// =============================================================
// ✅ PHASE 5 : ROUTES STAFF (Assistant/Admin)
// =============================================================
router.post('/:colisId', authStaff, requireRole('admin', 'assistant_shein'), sendMessage);
router.get('/:colisId', authStaff, requireRole('admin', 'assistant_shein'), getMessagesStaff);
router.patch('/:colisId/statut', authStaff, requireRole('admin', 'assistant_shein'), updateColisStatut);
router.post('/:colisId/devis', authStaff, requireRole('admin', 'assistant_shein'), sendDevis);

export default router;