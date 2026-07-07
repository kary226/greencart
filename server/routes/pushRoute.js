import express from 'express';
import { subscribePush, unsubscribePush } from '../controllers/pushController.js';
import authUser from '../middlewares/authUser.js';

const pushRouter = express.Router();

// [FIX] Routes protégées : userId vient du token vérifié (authUser),
// jamais du body envoyé par le client.
pushRouter.post('/subscribe', authUser, subscribePush);
pushRouter.post('/unsubscribe', authUser, unsubscribePush);

export default pushRouter;