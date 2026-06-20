import express from 'express';
import rateLimit from 'express-rate-limit';
import { isAuth, login, logout, register, updateUser, forgotPassword, resetPassword, getAllClients, googleAuth } from '../controllers/userController.js';
import authUser from '../middlewares/authUser.js';
import authSeller from '../middlewares/authSeller.js';

const userRouter = express.Router();

// [FIX H3] Limitation de débit sur les routes sensibles à la force brute
// et au credential stuffing. 10 tentatives / 15 min / IP.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Trop de tentatives, réessayez plus tard." }
});

userRouter.post('/register', authLimiter, register);
userRouter.post('/login', authLimiter, login);
userRouter.post('/google', googleAuth);
userRouter.get('/is-auth', authUser, isAuth);
userRouter.post('/logout', authUser, logout);
userRouter.post('/update', authUser, updateUser);
userRouter.post('/forgot-password', authLimiter, forgotPassword);
userRouter.post('/reset-password', authLimiter, resetPassword);
userRouter.get('/admin/clients', authSeller, getAllClients);

export default userRouter;