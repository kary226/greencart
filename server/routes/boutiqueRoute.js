import express from 'express';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import {
    getMaBoutique,
    updateMaBoutique,
    getBoutiqueById,
    listAllBoutiques,
    createBoutiqueForCommercial,
} from '../controllers/boutiqueController.js';

const boutiqueRouter = express.Router();

// Routes publiques
boutiqueRouter.get('/:id', getBoutiqueById);

// Routes commerçant
boutiqueRouter.get('/moi', authStaff, requireRole('commercant'), getMaBoutique);
boutiqueRouter.patch('/moi', authStaff, requireRole('commercant'), updateMaBoutique);

// Routes admin
boutiqueRouter.get('/', authStaff, requireRole('admin'), listAllBoutiques);
boutiqueRouter.post('/', authStaff, requireRole('admin'), createBoutiqueForCommercial);

export default boutiqueRouter;