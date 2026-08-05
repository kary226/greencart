import express from 'express';
import authUser from '../middlewares/authUser.js';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import { orderCreationLimiter, paymentLimiter } from '../middlewares/rateLimiters.js';
import { 
    getAllOrders, 
    getUserOrders, 
    placeOrderCOD, 
    updateOrderStatus, 
    getUserOrdersByAdmin,
    assignerLivreur,
    getLivraisonsLivreur,
    updateLivraisonStatus,
    getMesVentesCommercant
} from '../controllers/orderController.js';
import authSeller from '../middlewares/authSeller.js';
import { initiateGeniusPay } from '../controllers/geniuspayController.js';
import Order from '../models/Order.js';

const orderRouter = express.Router();

// Routes client
orderRouter.post('/cod', authUser, orderCreationLimiter, placeOrderCOD);
orderRouter.get('/user', authUser, getUserOrders);
orderRouter.post('/geniuspay/initiate', authUser, paymentLimiter, initiateGeniusPay);

// Routes admin (seller)
orderRouter.get('/seller', authSeller, getAllOrders);
orderRouter.post('/status', authSeller, updateOrderStatus);
orderRouter.get('/admin/user/:userId', authSeller, getUserOrdersByAdmin);

// ✅ PHASE 4 : Route pour assigner un livreur (admin)
orderRouter.post('/admin/assigner-livreur', authStaff, requireRole('admin'), assignerLivreur);

// ✅ PHASE 4 : Routes pour livreur
orderRouter.get('/livreur/mes-livraisons', authStaff, requireRole('livreur'), getLivraisonsLivreur);
orderRouter.patch('/livreur/statut', authStaff, requireRole('livreur'), updateLivraisonStatus);

// ✅ Commerçant : ses ventes uniquement (scopées à sa boutique)
orderRouter.get('/commercant/mes-ventes', authStaff, requireRole('commercant'), getMesVentesCommercant);

// Récupérer une commande par son ID (client)
orderRouter.get('/:orderId', authUser, async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.body.userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Commande non trouvée" });
        }
        res.json({ success: true, order });
    } catch (error) {
        console.error("Erreur récupération commande:", error);
        res.status(400).json({ success: false, message: error.message });
    }
});

export default orderRouter;