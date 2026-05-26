import express from 'express';
import { isAuth, login, logout, register, updateUser, forgotPassword, resetPassword } from '../controllers/userController.js';
import authUser from '../middlewares/authUser.js';

const userRouter = express.Router();

userRouter.post('/register', register);
userRouter.post('/login', login);
userRouter.get('/is-auth', authUser, isAuth);
userRouter.post('/logout', authUser, logout);  // ← POST au lieu de GET
userRouter.post('/update', authUser, updateUser);  // ← POST au lieu de PUT
userRouter.post('/forgot-password', forgotPassword);
userRouter.post('/reset-password', resetPassword);

export default userRouter;