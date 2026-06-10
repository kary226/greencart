import express from 'express';
import { isAuth, login, logout, register, updateUser, forgotPassword, resetPassword, getAllClients } from '../controllers/userController.js';
import authUser from '../middlewares/authUser.js';
import authSeller from '../middlewares/authSeller.js';

const userRouter = express.Router();

userRouter.post('/register', register);
userRouter.post('/login', login);
userRouter.get('/is-auth', authUser, isAuth);
userRouter.post('/logout', authUser, logout);
userRouter.post('/update', authUser, updateUser);
userRouter.post('/forgot-password', forgotPassword);
userRouter.post('/reset-password', resetPassword);
userRouter.get('/admin/clients', authSeller, getAllClients);

export default userRouter;