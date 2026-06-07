import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Address from '../models/Address.js';
import Coupon from '../models/Coupon.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';
import { authUser } from '../middlewares/authUser.js';

const router = express.Router();

// ==================== COMMANDES UTILISATEUR ====================

// Obtenir les commandes de l'utilisateur connecté
router.get('/user-orders', authUser, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .populate('items.product');
        
        res.json({ success: true, orders });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Obtenir une commande spécifique
router.get('/:orderId', authUser, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('items.product')
            .populate('address');
        
        if (!order) {
            return res.json({ success: false, message: "Commande non trouvée" });
        }
        
        if (order.userId !== req.user._id.toString()) {
            return res.json({ success: false, message: "Accès non autorisé" });
        }
        
        res.json({ success: true, order });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ==================== COMMANDE CASH ON DELIVERY ====================

router.post('/cod', authUser, async (req, res) => {
    try {
        const { items, address, couponApplied, discountAmount, deliveryPrice, deliveryType } = req.body;
        
        const totalAmount = items.reduce((sum, item) => sum + (item.offerPrice * item.quantity), 0);
        const finalAmount = totalAmount - (discountAmount || 0) + (deliveryPrice || 0);
        
        const order = await Order.create({
            userId: req.user._id,
            items: items.map(item => ({
                product: item.product,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null,
                priceAtOrder: item.offerPrice
            })),
            amount: finalAmount,
            address,
            paymentType: "COD",
            status: "Order Placed",
            isPaid: true
        });
        
        if (couponApplied) {
            await Coupon.findOneAndUpdate(
                { code: couponApplied },
                { $inc: { usageCount: 1 } }
            );
        }
        
        await User.findByIdAndUpdate(req.user._id, { cartItems: {} });
        
        // Envoi des emails
        const user = await User.findById(req.user._id);
        const addressDoc = await Address.findById(address);
        
        if (user && user.email) {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), finalAmount);
            await sendAdminNotificationEmail(order._id.toString(), finalAmount, `${addressDoc?.firstName || ''} ${addressDoc?.lastName || ''}`, user.email);
        }
        
        res.json({ success: true, message: "Commande créée avec succès", orderId: order._id });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ==================== COMMANDE STRIPE ====================

router.post('/stripe', authUser, async (req, res) => {
    try {
        const { items, address, couponApplied, discountAmount, deliveryPrice, deliveryType } = req.body;
        
        const totalAmount = items.reduce((sum, item) => sum + (item.offerPrice * item.quantity), 0);
        const finalAmount = totalAmount - (discountAmount || 0) + (deliveryPrice || 0);
        
        const order = await Order.create({
            userId: req.user._id,
            items: items.map(item => ({
                product: item.product,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null,
                priceAtOrder: item.offerPrice
            })),
            amount: finalAmount,
            address,
            paymentType: "Stripe",
            status: "pending_payment"
        });
        
        if (couponApplied) {
            await Coupon.findOneAndUpdate(
                { code: couponApplied },
                { $inc: { usageCount: 1 } }
            );
        }
        
        // Ici, intégration Stripe
        // const stripeSession = await stripe.checkout.sessions.create({...});
        
        res.json({ success: true, url: "stripe_checkout_url" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ==================== COMMANDE GENIUSPAY ====================

// Initier un paiement GeniusPay
router.post('/geniuspay/initiate', authUser, async (req, res) => {
    try {
        const { items, address, amount, deliveryPrice, deliveryType, couponApplied, discountAmount } = req.body;
        
        const finalAmount = Math.round(amount);
        
        if (finalAmount < 200) {
            return res.json({ success: false, message: "Le montant minimum est de 200 FCFA" });
        }
        
        // Récupérer l'adresse complète
        const addressDoc = await Address.findById(address);
        if (!addressDoc) {
            return res.json({ success: false, message: "Adresse non trouvée" });
        }
        
        // Créer la commande
        const order = await Order.create({
            userId: req.user._id,
            items: items.map(item => ({
                product: item.product,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null,
                priceAtOrder: item.offerPrice
            })),
            amount: finalAmount,
            address,
            paymentType: "GeniusPay",
            status: "pending_payment"
        });
        
        if (couponApplied) {
            await Coupon.findOneAndUpdate(
                { code: couponApplied },
                { $inc: { usageCount: 1 } }
            );
        }
        
        // Formater le téléphone
        let phone = addressDoc.phone || '';
        phone = phone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
            phone = phone.substring(1);
        }
        if (!phone.startsWith('225')) {
            phone = `225${phone}`;
        }
        phone = `+${phone}`;
        
        // Envoi des emails
        const user = await User.findById(req.user._id);
        if (user && user.email) {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), finalAmount);
            await sendAdminNotificationEmail(order._id.toString(), finalAmount, `${addressDoc.firstName || ''} ${addressDoc.lastName || ''}`, user.email);
        }
        
        // Simuler une réponse GeniusPay (à remplacer par l'appel réel)
        // Dans un environnement réel, vous appelleriez l'API GeniusPay ici
        
        res.json({ 
            success: true, 
            checkout_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${order._id}`,
            orderId: order._id 
        });
        
    } catch (error) {
        console.error("Erreur GeniusPay:", error);
        res.json({ success: false, message: error.message });
    }
});

// ==================== CONFIRMATION GENIUSPAY (NOUVEAU) ====================

router.post('/geniuspay/confirm', async (req, res) => {
    try {
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.json({ success: false, message: "orderId requis" });
        }
        
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.json({ success: false, message: "Commande non trouvée" });
        }
        
        // Vérifier si la commande est déjà confirmée
        if (order.isPaid && order.status === "Confirmed") {
            return res.json({ success: true, message: "Commande déjà confirmée" });
        }
        
        // Mettre à jour la commande
        order.isPaid = true;
        order.status = "Confirmed";
        await order.save();
        
        // Vider le panier de l'utilisateur
        await User.findByIdAndUpdate(order.userId, { cartItems: {} });
        
        return res.json({ success: true, message: "Commande confirmée avec succès" });
        
    } catch (error) {
        console.error("Erreur confirmation GeniusPay:", error);
        return res.json({ success: false, message: error.message });
    }
});

// ==================== WEBHOOK GENIUSPAY ====================

router.post('/geniuspay/webhook', async (req, res) => {
    try {
        const payload = req.body;
        const event = payload.event;
        
        if (event === 'payment.success') {
            const transactionData = payload.data;
            const orderId = transactionData.metadata?.order_id;
            
            if (orderId) {
                await Order.findByIdAndUpdate(orderId, {
                    isPaid: true,
                    status: "Confirmed",
                    geniuspay_reference: transactionData.reference
                });
                
                const order = await Order.findById(orderId);
                if (order) {
                    await User.findByIdAndUpdate(order.userId, { cartItems: {} });
                }
            }
        }
        
        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});

export default router;