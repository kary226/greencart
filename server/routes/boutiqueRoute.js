import express from 'express';
import { upload } from '../configs/multer.js';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import authSeller from '../middlewares/authSeller.js';
import { valider } from '../middlewares/valider.js';
import { schemaStatutBoutique, schemaAutorisationsBoutique } from '../schemas/index.js';
import {
    getMaBoutique,
    updateMaBoutique,
    updateMesZonesLivraison,
    getBoutiqueById,
    listAllBoutiques,
    createBoutiqueForCommercial,
    updateBoutiqueStatut,
    listBoutiqueOptions,
    getBoutiqueApercu,
    updateAutorisationsBoutique,
} from '../controllers/boutiqueController.js';

const boutiqueRouter = express.Router();

// ✅ Routes COMMERCANT (spécifiques) — DOIVENT être AVANT la route avec :id
boutiqueRouter.get('/moi', authStaff, requireRole('commercant'), getMaBoutique);
boutiqueRouter.patch('/moi', authStaff, requireRole('commercant'), upload.single('logo'), updateMaBoutique);
boutiqueRouter.patch('/moi/zones-livraison', authStaff, requireRole('commercant'), updateMesZonesLivraison);

// ✅ Route VENDEUR (compte technique) — sélecteur de boutique des
// formulaires produit. Montée AVANT /:id pour ne pas être avalée par elle.
boutiqueRouter.get('/options', authSeller, listBoutiqueOptions);

// ✅ Routes ADMIN
boutiqueRouter.get('/', authStaff, requireRole('admin'), listAllBoutiques);
boutiqueRouter.post('/', authStaff, requireRole('admin'), createBoutiqueForCommercial);
boutiqueRouter.patch('/:id/statut', authStaff, requireRole('admin'), valider(schemaStatutBoutique), updateBoutiqueStatut);
boutiqueRouter.patch('/:id/autorisations', authStaff, requireRole('admin'), valider(schemaAutorisationsBoutique), updateAutorisationsBoutique);

// ✅ Routes PUBLIQUES (avec paramètre :id) — DOIVENT être EN DERNIER
boutiqueRouter.get('/:id/apercu', getBoutiqueApercu);
boutiqueRouter.get('/:id', getBoutiqueById);

export default boutiqueRouter;