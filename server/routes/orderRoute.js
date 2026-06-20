import express from 'express';
import axios from 'axios';
import authUser from '../middlewares/authUser.js';
import {
    getAllOrders, getUserOrders, placeOrderCOD, placeOrderStripe,
    updateOrderStatus, getUserOrdersByAdmin
} from '../controllers/orderController.js';
import authSeller from '../middlewares/authSeller.js';
import { initiateGeniusPay } from '../controllers/geniuspayController.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

const orderRouter = express.Router();

orderRouter.post('/cod', authUser, placeOrderCOD);
orderRouter.get('/user', authUser, getUserOrders);
orderRouter.get('/seller', authSeller, getAllOrders);
orderRouter.post('/stripe', authUser, placeOrderStripe);
orderRouter.post('/status', authSeller, updateOrderStatus);
orderRouter.post('/geniuspay/initiate', authUser, initiateGeniusPay);
orderRouter.get('/admin/user/:userId', authSeller, getUserOrdersByAdmin);

// ✅ Consultation protégée d'une commande
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

// ✅ Vérification manuelle sécurisée (fallback sandbox)
orderRouter.post('/geniuspay/verify', authUser, async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.body.userId;

        const order = await Order.findById(orderId);
        if (!order || order.userId.toString() !== userId) {
            return res.json({ success: false, message: "Commande introuvable" });
        }

        if (order.isPaid && order.status === "Confirmed") {
            return res.json({ success: true, message: "Commande déjà confirmée", isPaid: true });
        }

        const reference = order.geniuspay_reference;
        if (!reference) {
            return res.json({ success: false, message: "Référence de paiement manquante" });
        }

        const response = await axios.get(
            `${process.env.GENIUSPAY_BASE_URL}/payments/${reference}`,
            {
                headers: {
                    'X-API-Key': process.env.GENIUSPAY_API_KEY,
                    'X-API-Secret': process.env.GENIUSPAY_API_SECRET
                }
            }
        );

        const paymentData = response.data;
        if (paymentData.success && paymentData.data.status === 'completed') {
            order.isPaid = true;
            order.status = "Confirmed";
            await order.save();

            for (const item of order.items) {
                const product = await Product.findById(item.product);
                if (!product) continue;
                if (product.variants?.length > 0) {
                    const variant = product.variants.find(v => v.color === item.color && v.size === item.size);
                    if (variant) {
                        variant.stock = Math.max(0, (variant.stock || 0) - item.quantity);
                        await product.save();
                    }
                } else {
                    product.stock = Math.max(0, (product.stock || 0) - item.quantity);
                    await product.save();
                }
            }

            await User.findByIdAndUpdate(userId, { cartItems: {} });

            const user = await User.findById(userId);
            const Address = (await import('mongoose')).model('address');
            const address = await Address.findById(order.address);
            if (user?.email && address) {
                try {
                    await sendOrderConfirmationEmail(user.email, order._id.toString(), order.amount);
                    await sendAdminNotificationEmail(order._id.toString(), order.amount, `${address.firstName} ${address.lastName}`, user.email);
                } catch (emailError) {
                    console.error("Erreur envoi emails:", emailError);
                }
            }

            return res.json({ success: true, message: "Commande confirmée", isPaid: true });
        } else {
            return res.json({ success: false, message: "Paiement non finalisé", isPaid: false });
        }
    } catch (error) {
        console.error("Erreur vérification GeniusPay:", error);
        res.json({ success: false, message: "Erreur lors de la vérification" });
    }
});

export default orderRouter;