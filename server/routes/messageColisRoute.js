import express from 'express';
import authStaff from '../middlewares/authStaff.js';
import { requireAnyPermission } from '../middlewares/permission.js';
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
// [RAMCI §16] Ces routes listaient le rôle historique `admin` SANS
// `super_admin`. Migrer le compte principal vers super_admin — ce que le
// guide recommande — lui aurait donc fait perdre ces écrans du jour au
// lendemain. Elles vérifient désormais une permission : le Super Admin
// passe par admin.all, l'Assistant SHEIN par ses propres droits.
router.post('/:colisId', authStaff, requireAnyPermission(['shein.update', 'admin.all']), sendMessage);
router.get('/:colisId', authStaff, requireAnyPermission(['shein.view', 'admin.all']), getMessagesStaff);
router.patch('/:colisId/statut', authStaff, requireAnyPermission(['shein.update', 'admin.all']), updateColisStatut);
router.post('/:colisId/devis', authStaff, requireAnyPermission(['shein.update', 'admin.all']), sendDevis);

export default router;