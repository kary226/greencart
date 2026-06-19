import express from 'express';
import rateLimit from 'express-rate-limit';
import { isAuth, login, logout, register, updateUser, forgotPassword, resetPassword, getAllClients, googleAuth } from '../controllers/userController.js';
import authUser from '../middlewares/authUser.js';
import authSeller from '../middlewares/authSeller.js';

const userRouter = express.Router();

// Limiteur commun pour les routes d'authentification
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // max 10 tentatives par IP
    message: { success: false, message: "Trop de tentatives, réessayez plus tard." }
});

userRouter.post('/register', authLimiter, register);
userRouter.post('/login', authLimiter, login);
userRouter.post('/google', googleAuth);              // ← Google OAuth (moins sensible)
userRouter.get('/is-auth', authUser, isAuth);
userRouter.post('/logout', authUser, logout);
userRouter.post('/update', authUser, updateUser);
userRouter.post('/forgot-password', authLimiter, forgotPassword);
userRouter.post('/reset-password', resetPassword);   // pourrait aussi être limité si besoin
userRouter.get('/admin/clients', authSeller, getAllClients);

export default userRouter;