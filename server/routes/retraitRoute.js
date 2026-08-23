import express from 'express';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import { requirePermission, requireAnyPermission } from '../middlewares/permission.js';
import requireBoutiqueActive from '../middlewares/requireBoutiqueActive.js';
import {
    createRetrait,
    getMesRetraits,
    listOperateurs,
    listAllRetraits,
    traiterRetrait,
} from '../controllers/retraitController.js';

const retraitRouter = express.Router();

// Routes commerçant
retraitRouter.post('/', authStaff, requireRole('commercant'), requireBoutiqueActive, createRetrait);
retraitRouter.get('/moi', authStaff, requireRole('commercant'), getMesRetraits);
retraitRouter.get('/operateurs', authStaff, requireRole('commercant', 'admin', 'super_admin'), listOperateurs);

// Routes admin / finance
retraitRouter.get(
    '/',
    authStaff,
    requireAnyPermission(['withdrawals.view', 'wallet.view']),
    listAllRetraits
);
retraitRouter.patch(
    '/:id',
    authStaff,
    requireAnyPermission(['withdrawals.approve', 'wallet.adjust']),
    traiterRetrait
);

export default retraitRouter;