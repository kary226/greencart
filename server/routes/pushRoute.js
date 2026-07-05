import express from 'express';
import { subscribePush, unsubscribePush } from '../controllers/pushController.js';

const pushRouter = express.Router();

pushRouter.post('/subscribe', subscribePush);
pushRouter.post('/unsubscribe', unsubscribePush);

export default pushRouter;