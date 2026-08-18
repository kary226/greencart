import express from 'express';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import requireBoutiqueActive from '../middlewares/requireBoutiqueActive.js';
import {
    createRetrait,
    getMesRetraits,
    listAllRetraits,
    traiterRetrait,
} from '../controllers/retraitController.js';

const retraitRouter = express.Router();

// Routes commerçant
retraitRouter.post('/', authStaff, requireRole('commercant'), requireBoutiqueActive, createRetrait);
retraitRouter.get('/moi', authStaff, requireRole('commercant'), getMesRetraits);

// Routes admin
retraitRouter.get('/', authStaff, requireRole('admin'), listAllRetraits);
retraitRouter.patch('/:id', authStaff, requireRole('admin'), traiterRetrait);

export default retraitRouter;