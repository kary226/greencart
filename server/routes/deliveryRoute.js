import express from 'express';
import { 
    getAllDeliveryTypes, getActiveDeliveryTypes, addDeliveryType, updateDeliveryType, deleteDeliveryType,
    getAllDeliveryPrices, getDeliveryPrice, addDeliveryPrice, addBulkDeliveryPrices, updateDeliveryPrice, deleteDeliveryPrice
} from '../controllers/deliveryController.js';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission } from '../middlewares/permission.js';
import cacheControl from '../middlewares/cacheControl.js';

const deliveryRouter = express.Router();

// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Seul appelant
// vivant pour ces 9 routes : pages/admin/Deliveries.jsx, sous
// SuperAdminLayout (staffToken). pages/seller/DeliveryManager.jsx (l'autre
// appelant historique) n'est routé nulle part dans App.jsx (mort).
// deliveries.view / deliveries.configure sont les permissions déjà en
// usage pour ce même contrôleur dans adminRoutes.js (/api/admin/delivery/*,
// jamais appelé par le frontend). [NOTE] deliveries.configure n'est
// aujourd'hui accordée à aucun rôle dans seedRolePermissions.js /
// assignPermissions.js (seuls deliveries.view et deliveries.assign le
// sont) — sans effet pour un super_admin (bypass total), mais un futur
// rôle logistics_admin resterait bloqué sur ces routes tant que le seed
// n'est pas complété. Signalé, non corrigé ici : décision de droits, pas
// de migration d'authentification.

// ==================== TYPES DE LIVRAISON ====================
deliveryRouter.get('/types/admin', authStaff, requirePermission('deliveries.view'), getAllDeliveryTypes);
// [PHASE 0 - PERF] Types/tarifs de livraison publics, très peu volatils.
deliveryRouter.get('/types', cacheControl(300), getActiveDeliveryTypes);
deliveryRouter.post('/type/add', authStaff, requirePermission('deliveries.configure'), addDeliveryType);
deliveryRouter.post('/type/update', authStaff, requirePermission('deliveries.configure'), updateDeliveryType);
deliveryRouter.post('/type/delete', authStaff, requirePermission('deliveries.configure'), deleteDeliveryType);

// ==================== PRIX DE LIVRAISON ====================
deliveryRouter.get('/prices/admin', authStaff, requirePermission('deliveries.configure'), getAllDeliveryPrices);
deliveryRouter.get('/price/:communeId/:deliveryTypeId', cacheControl(300), getDeliveryPrice);
deliveryRouter.post('/price/add', authStaff, requirePermission('deliveries.configure'), addDeliveryPrice);
deliveryRouter.post('/price/bulk', authStaff, requirePermission('deliveries.configure'), addBulkDeliveryPrices);
deliveryRouter.post('/price/update', authStaff, requirePermission('deliveries.configure'), updateDeliveryPrice);
deliveryRouter.post('/price/delete', authStaff, requirePermission('deliveries.configure'), deleteDeliveryPrice);

export default deliveryRouter;