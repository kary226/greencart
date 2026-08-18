import express from 'express';
import { upload } from '../configs/multer.js';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import {
    getMaBoutique,
    updateMaBoutique,
    updateMesZonesLivraison,
    getBoutiqueById,
    listAllBoutiques,
    createBoutiqueForCommercial,
    updateBoutiqueStatut,
} from '../controllers/boutiqueController.js';

const boutiqueRouter = express.Router();

// ✅ Routes COMMERCANT (spécifiques) — DOIVENT être AVANT la route avec :id
boutiqueRouter.get('/moi', authStaff, requireRole('commercant'), getMaBoutique);
boutiqueRouter.patch('/moi', authStaff, requireRole('commercant'), upload.single('logo'), updateMaBoutique);
boutiqueRouter.patch('/moi/zones-livraison', authStaff, requireRole('commercant'), updateMesZonesLivraison);

// ✅ Routes ADMIN
boutiqueRouter.get('/', authStaff, requireRole('admin'), listAllBoutiques);
boutiqueRouter.post('/', authStaff, requireRole('admin'), createBoutiqueForCommercial);
boutiqueRouter.patch('/:id/statut', authStaff, requireRole('admin'), updateBoutiqueStatut);

// ✅ Routes PUBLIQUES (avec paramètre :id) — DOIVENT être EN DERNIER
boutiqueRouter.get('/:id', getBoutiqueById);

export default boutiqueRouter;