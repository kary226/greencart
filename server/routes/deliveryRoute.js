import express from 'express';
import { 
    getAllDeliveryTypes, getActiveDeliveryTypes, addDeliveryType, updateDeliveryType, deleteDeliveryType,
    getAllDeliveryPrices, getDeliveryPrice, addDeliveryPrice, addBulkDeliveryPrices, updateDeliveryPrice, deleteDeliveryPrice
} from '../controllers/deliveryController.js';
import authSeller from '../middlewares/authSeller.js';

const deliveryRouter = express.Router();

// ==================== TYPES DE LIVRAISON ====================
deliveryRouter.get('/types/admin', authSeller, getAllDeliveryTypes);
deliveryRouter.get('/types', getActiveDeliveryTypes);
deliveryRouter.post('/type/add', authSeller, addDeliveryType);
deliveryRouter.post('/type/update', authSeller, updateDeliveryType);
deliveryRouter.post('/type/delete', authSeller, deleteDeliveryType);

// ==================== PRIX DE LIVRAISON ====================
deliveryRouter.get('/prices/admin', authSeller, getAllDeliveryPrices);
deliveryRouter.get('/price/:communeId/:deliveryTypeId', getDeliveryPrice);
deliveryRouter.post('/price/add', authSeller, addDeliveryPrice);
deliveryRouter.post('/price/bulk', authSeller, addBulkDeliveryPrices);
deliveryRouter.post('/price/update', authSeller, updateDeliveryPrice);
deliveryRouter.post('/price/delete', authSeller, deleteDeliveryPrice);

export default deliveryRouter;