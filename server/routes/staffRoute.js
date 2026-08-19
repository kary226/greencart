import express from 'express';
import rateLimit from 'express-rate-limit';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import { valider } from '../middlewares/valider.js';
import {
    schemaInvitation,
    schemaConnexionStaff,
    schemaActivation,
    schemaStatutStaff,
    schemaRoleStaff,
} from '../schemas/index.js';
import {
    createInvitation,
    listInvitations,
    activateAccount,
    staffLogin,
    isStaffAuth,
    staffLogout,
    listStaffAccounts,
    updateStaffStatus,
    updateStaffRole,
    getSuppressionApercu,
    deleteStaffAccount,
} from '../controllers/staffController.js';

const staffRouter = express.Router();

// Même politique que le login vendeur existant : 10 tentatives / 15 min / IP.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Trop de tentatives, réessayez plus tard.' },
});

// Un peu plus permissif que le login : une invitation peut être ouverte
// plusieurs fois par erreur avant de remplir le formulaire correctement.
const activationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Trop de tentatives, réessayez plus tard.' },
});

// ---- Authentification (public) ----
staffRouter.post('/login', authLimiter, valider(schemaConnexionStaff), staffLogin);
staffRouter.post('/activation/:token', activationLimiter, valider(schemaActivation), activateAccount);
staffRouter.get('/is-auth', authStaff, isStaffAuth);
staffRouter.get('/logout', staffLogout);

// ---- Gestion des comptes (admin uniquement) ----
staffRouter.post('/invitations', authStaff, requireRole('admin'), valider(schemaInvitation), createInvitation);
staffRouter.get('/invitations', authStaff, requireRole('admin'), listInvitations);
staffRouter.get('/comptes', authStaff, requireRole('admin'), listStaffAccounts);
staffRouter.patch('/comptes/:id/statut', authStaff, requireRole('admin'), valider(schemaStatutStaff), updateStaffStatus);
staffRouter.patch('/comptes/:id/role', authStaff, requireRole('admin'), valider(schemaRoleStaff), updateStaffRole);
staffRouter.get('/comptes/:id/suppression', authStaff, requireRole('admin'), getSuppressionApercu);
staffRouter.delete('/comptes/:id', authStaff, requireRole('admin'), deleteStaffAccount);

export default staffRouter;