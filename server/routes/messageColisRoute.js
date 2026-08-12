import express from 'express';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import {
    sendMessage,
    getMessagesStaff,
    updateColisStatut,
    sendDevis,
} from '../controllers/messageColisController.js';

const router = express.Router();

// =============================================================
// [SÉCURITÉ] Les trois routes client qui vivaient ici —
//   GET  /:id/messages
//   POST /:id/messages
//   POST /:id/typing
// — ont été SUPPRIMÉES : elles étaient montées SANS `authUser`.
//
// Or leurs contrôleurs filtrent le colis sur `req.body.userId`, une valeur
// normalement posée par `authUser` depuis le JWT. Sans ce middleware, le
// champ venait directement du corps de la requête : n'importe qui pouvait
// lire la conversation d'un client, ou écrire en se faisant passer pour
// lui, en envoyant simplement {"userId": "<id de la victime>"}.
//
// Ces routes faisaient doublon : les mêmes contrôleurs sont déjà exposés,
// correctement protégés, dans sheinCartRoute.js —
//   sheinCartRouter.get("/:id/messages", authUser, getMessages)
//   sheinCartRouter.post("/:id/messages", ..., authUser, sendMessageClient)
//   sheinCartRouter.post("/:id/typing", authUser, setClientTyping)
// et c'est bien /api/shein-cart/... que le client appelle
// (ColisSheinConversation.jsx). Aucune perte de fonctionnalité.
// =============================================================
// ✅ PHASE 5 : ROUTES STAFF (Assistant/Admin)
// =============================================================
router.post('/:colisId', authStaff, requireRole('admin', 'assistant_shein'), sendMessage);
router.get('/:colisId', authStaff, requireRole('admin', 'assistant_shein'), getMessagesStaff);
router.patch('/:colisId/statut', authStaff, requireRole('admin', 'assistant_shein'), updateColisStatut);
router.post('/:colisId/devis', authStaff, requireRole('admin', 'assistant_shein'), sendDevis);

export default router;