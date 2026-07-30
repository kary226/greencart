import express from 'express';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
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

// Routes admin
walletRouter.get('/admin/:commercialId', authStaff, requireRole('admin'), getWalletByCommercial);
walletRouter.post('/admin/ajustement', authStaff, requireRole('admin'), adminAjustement);

export default walletRouter;