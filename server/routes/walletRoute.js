import express from 'express';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import { requirePermission } from '../middlewares/permission.js';
import {
    getMyWallet,
    getMyTransactions,
    getWalletByCommercial,
    adminAjustement,
} from '../controllers/walletController.js';

const walletRouter = express.Router();

// Routes commerçant
walletRouter.get('/moi', authStaff, requireRole('commercant'), getMyWallet);
walletRouter.get('/moi/transactions', authStaff, requireRole('commercant'), getMyTransactions);

// Routes admin / finance
walletRouter.get(
    '/admin/:commercialId',
    authStaff,
    requirePermission('wallet.view'),
    getWalletByCommercial
);
walletRouter.post(
    '/admin/ajustement',
    authStaff,
    requirePermission('wallet.adjust'),
    adminAjustement
);

export default walletRouter;