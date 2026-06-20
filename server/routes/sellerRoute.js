import express from 'express';
import rateLimit from 'express-rate-limit';
import { isSellerAuth, sellerLogin, sellerLogout } from '../controllers/sellerController.js';
import authSeller from '../middlewares/authSeller.js';

const sellerRouter = express.Router();

// [FIX H3] Limitation de débit sur le login vendeur — d'autant plus
// critique qu'il s'agit d'un compte admin UNIQUE (identifiants comparés
// à des variables d'environnement, pas de verrouillage de compte natif).
// 10 tentatives / 15 min / IP.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Trop de tentatives, réessayez plus tard." }
});

sellerRouter.post('/login', authLimiter, sellerLogin);
sellerRouter.get('/is-auth', authSeller, isSellerAuth);
sellerRouter.get('/logout', sellerLogout);

export default sellerRouter;