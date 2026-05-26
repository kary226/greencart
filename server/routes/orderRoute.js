import express from 'express';
import authUser from '../middlewares/authUser.js';
import { getAllOrders, getUserOrders, placeOrderCOD, placeOrderStripe, updateOrderStatus, getUserOrdersByAdmin } from '../controllers/orderController.js';
import authSeller from '../middlewares/authSeller.js';
import { initiateGeniusPay } from '../controllers/geniuspayController.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';

const orderRouter = express.Router();

orderRouter.post('/cod', authUser, placeOrderCOD)
orderRouter.get('/user', authUser, getUserOrders)
orderRouter.get('/seller', authSeller, getAllOrders)
orderRouter.post('/stripe', authUser, placeOrderStripe)
orderRouter.post('/status', authSeller, updateOrderStatus)
orderRouter.post('/geniuspay/initiate', authUser, initiateGeniusPay)

// Admin : Récupérer les commandes d'un client spécifique
orderRouter.get('/admin/user/:userId', authSeller, getUserOrdersByAdmin)

// Route de confirmation sécurisée pour GeniusPay
orderRouter.post('/geniuspay/confirm', authUser, async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.body.userId || req.user?.id;
        
        // Récupérer la commande
        const order = await Order.findById(orderId);
        if (!order) {
            return res.json({ success: false, message: "Commande non trouvée" });
        }
        
        // Mettre à jour le statut
        await Order.findByIdAndUpdate(orderId, {
            isPaid: true,
            status: "Confirmed"
        });
        
        // Réduire le stock pour chaque produit
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                // Chercher la variante correspondante
                if (product.variants && product.variants.length > 0) {
                    const variant = product.variants.find(v => 
                        v.color === item.color && v.size === item.size
                    );
                    if (variant) {
                        variant.stock = Math.max(0, variant.stock - item.quantity);
                        await product.save();
                    }
                } else {
                    // Stock simple
                    product.stock = Math.max(0, (product.stock || 0) - item.quantity);
                    await product.save();
                }
            }
        }
        
        // Vider le panier
        await User.findByIdAndUpdate(userId, { cartItems: {} });
        
        res.json({ success: true, message: "Commande confirmée et stock mis à jour" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
});

export default orderRouter;