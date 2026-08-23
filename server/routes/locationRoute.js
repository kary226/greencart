import express from 'express';
import { 
    getCities, getAllCities, addCity, updateCity, deleteCity,
    getCommunesByCity, getAllCommunes, addCommune, updateCommune, deleteCommune
} from '../controllers/locationController.js';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission } from '../middlewares/permission.js';

const locationRouter = express.Router();

// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Seul appelant
// vivant pour ces 8 routes : pages/admin/Locations.jsx (+ le sélecteur de
// villes de pages/admin/Deliveries.jsx), sous SuperAdminLayout
// (staffToken). pages/seller/LocationManager.jsx (l'autre appelant
// historique) n'est routé nulle part dans App.jsx (mort). deliveries.
// configure est la même permission que celle déjà utilisée pour ce même
// contrôleur dans adminRoutes.js (/api/admin/locations/*, jamais appelé
// par le frontend) — les villes/communes y sont traitées comme une
// sous-partie de la configuration livraison, pas comme un module à part.
locationRouter.get('/cities', getCities);
locationRouter.get('/admin/cities', authStaff, requirePermission('deliveries.configure'), getAllCities);
locationRouter.post('/city/add', authStaff, requirePermission('deliveries.configure'), addCity);
locationRouter.post('/city/update', authStaff, requirePermission('deliveries.configure'), updateCity);
locationRouter.post('/city/delete', authStaff, requirePermission('deliveries.configure'), deleteCity);

// ==================== COMMUNES ====================
locationRouter.get('/communes/:cityId', getCommunesByCity);
locationRouter.get('/admin/communes', authStaff, requirePermission('deliveries.configure'), getAllCommunes);
locationRouter.post('/commune/add', authStaff, requirePermission('deliveries.configure'), addCommune);
locationRouter.post('/commune/update', authStaff, requirePermission('deliveries.configure'), updateCommune);
locationRouter.post('/commune/delete', authStaff, requirePermission('deliveries.configure'), deleteCommune);

export default locationRouter;