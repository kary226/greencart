import express from 'express';
import authUser from '../middlewares/authUser.js';
import { getAllOrders, getUserOrders, placeOrderCOD, placeOrderStripe, updateOrderStatus, getUserOrdersByAdmin } from '../controllers/orderController.js';
import authSeller from '../middlewares/authSeller.js';
import { initiateGeniusPay } from '../controllers/geniuspayController.js';
import Order from '../models/Order.js';

const orderRouter = express.Router();

// ✅ Routes existantes conservées
orderRouter.post('/cod', authUser, placeOrderCOD);
orderRouter.get('/user', authUser, getUserOrders);
orderRouter.get('/seller', authSeller, getAllOrders);
orderRouter.post('/stripe', authUser, placeOrderStripe);
orderRouter.post('/status', authSeller, updateOrderStatus);
orderRouter.post('/geniuspay/initiate', authUser, initiateGeniusPay);
orderRouter.get('/admin/user/:userId', authSeller, getUserOrdersByAdmin);

// ✅ Route protégée : seul le propriétaire peut voir sa commande
orderRouter.get('/:orderId', authUser, async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.body.userId });
        if (!order) {
            return res.json({ success: false, message: "Commande non trouvée" });
        }
        res.json({ success: true, order });
    } catch (error) {
        console.error("Erreur récupération commande:", error);
        res.json({ success: false, message: error.message });
    }
});

export default orderRouter;