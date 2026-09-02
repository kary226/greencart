import express from 'express';
import rateLimit from 'express-rate-limit';
import authStaff from '../middlewares/authStaff.js';
import { valider } from '../middlewares/valider.js';
import { requirePermission } from '../middlewares/permission.js';
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
staffRouter.post('/invitations', authStaff, requirePermission('admin.configure'), valider(schemaInvitation), createInvitation);
staffRouter.get('/invitations', authStaff, requirePermission('admin.configure'), listInvitations);
staffRouter.get('/comptes', authStaff, requirePermission('admin.configure'), listStaffAccounts);
staffRouter.patch('/comptes/:id/statut', authStaff, requirePermission('admin.configure'), valider(schemaStatutStaff), updateStaffStatus);
staffRouter.patch('/comptes/:id/role', authStaff, requirePermission('admin.configure'), valider(schemaRoleStaff), updateStaffRole);
staffRouter.get('/comptes/:id/suppression', authStaff, requirePermission('admin.configure'), getSuppressionApercu);
staffRouter.delete('/comptes/:id', authStaff, requirePermission('admin.configure'), deleteStaffAccount);

export default staffRouter;