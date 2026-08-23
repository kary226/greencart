import express from 'express';
import { upload } from '../configs/multer.js';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import { requirePermission } from '../middlewares/permission.js';
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

// ✅ [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Sélecteur de
// boutique du formulaire produit. Montée AVANT /:id pour ne pas être
// avalée par elle.
//
// Cette route était protégée par authSeller (cookie sellerToken), mais son
// seul appelant réel — pages/seller/AddProduct.jsx — est monté sous
// /admin/products/add et /admin/products/edit/:id dans SuperAdminLayout,
// qui authentifie exclusivement via /api/staff/is-auth (cookie staffToken).
// pages/seller/ProductList.jsx, l'autre appelant historique, n'est routé
// nulle part dans App.jsx (mort). authSeller était donc déjà inopérant
// pour le seul consommateur vivant de cette route ; catalog.view est la
// permission qui gate déjà l'accès au menu Catalogue côté frontend
// (SuperAdminLayout.jsx).
boutiqueRouter.get('/options', authStaff, requirePermission('catalog.view'), listBoutiqueOptions);

// ✅ Routes ADMIN
boutiqueRouter.get('/', authStaff, requireRole('admin', 'super_admin'), listAllBoutiques);
boutiqueRouter.post('/', authStaff, requireRole('admin', 'super_admin'), createBoutiqueForCommercial);
boutiqueRouter.patch('/:id/statut', authStaff, requireRole('admin', 'super_admin'), valider(schemaStatutBoutique), updateBoutiqueStatut);
boutiqueRouter.patch('/:id/autorisations', authStaff, requireRole('admin', 'super_admin'), valider(schemaAutorisationsBoutique), updateAutorisationsBoutique);

// ✅ Routes PUBLIQUES (avec paramètre :id) — DOIVENT être EN DERNIER
boutiqueRouter.get('/:id/apercu', getBoutiqueApercu);
boutiqueRouter.get('/:id', getBoutiqueById);

export default boutiqueRouter;