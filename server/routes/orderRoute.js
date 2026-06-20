import express from 'express';
import authUser from '../middlewares/authUser.js';
import { getAllOrders, getUserOrders, placeOrderCOD, placeOrderStripe, updateOrderStatus, getUserOrdersByAdmin } from '../controllers/orderController.js';
import authSeller from '../middlewares/authSeller.js';
import { initiateGeniusPay } from '../controllers/geniuspayController.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';

const orderRouter = express.Router();

orderRouter.post('/cod', authUser, placeOrderCOD);
orderRouter.get('/user', authUser, getUserOrders);
orderRouter.get('/seller', authSeller, getAllOrders);
orderRouter.post('/stripe', authUser, placeOrderStripe);
orderRouter.post('/status', authSeller, updateOrderStatus);
orderRouter.post('/geniuspay/initiate', authUser, initiateGeniusPay);
orderRouter.get('/admin/user/:userId', authSeller, getUserOrdersByAdmin);

// ============================================================
// ROUTE POUR RÉCUPÉRER UNE COMMANDE PAR SON ID (sans auth)
// ============================================================
orderRouter.get('/:orderId', async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.json({ success: false, message: "Commande non trouvée" });
        }
        res.json({ success: true, order });
    } catch (error) {
        console.error("Erreur récupération commande:", error);
        res.json({ success: false, message: error.message });
    }
});

// ============================================================
// CONFIRMATION MANUELLE (redirection après paiement)
// ============================================================
orderRouter.post('/geniuspay/confirm', async (req, res) => {
    try {
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.json({ success: false, message: "orderId requis" });
        }
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.json({ success: false, message: "Commande non trouvée" });
        }
        
        if (order.isPaid && order.status === "Confirmed") {
            return res.json({ success: true, message: "Commande déjà confirmée" });
        }
        
        order.isPaid = true;
        order.status = "Confirmed";
        await order.save();
        
        // Réduire le stock
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                if (product.variants && product.variants.length > 0) {
                    const variant = product.variants.find(v => 
                        v.color === item.color && v.size === item.size
                    );
                    if (variant) {
                        variant.stock = Math.max(0, variant.stock - item.quantity);
                        await product.save();
                    }
                } else {
                    product.stock = Math.max(0, (product.stock || 0) - item.quantity);
                    await product.save();
                }
            }
        }
        
        await User.findByIdAndUpdate(order.userId, { cartItems: {} });
        
        res.json({ success: true, message: "Commande confirmée et stock mis à jour" });
    } catch (error) {
        console.error("Erreur confirmation GeniusPay:", error);
        res.json({ success: false, message: error.message });
    }
});

// ============================================================
// WEBHOOK GENIUSPAY (appelé automatiquement par GeniusPay)
// ============================================================
orderRouter.post('/geniuspay/webhook', async (req, res) => {
    console.log("🔔 Webhook GeniusPay reçu:", JSON.stringify(req.body, null, 2));
    
    try {
        const payload = req.body;
        const event = payload.event;

        if (event === 'payment.success') {
            const transactionData = payload.data?.transaction || payload.data;
            const metadata = transactionData?.metadata || payload.data?.metadata;
            const orderId = metadata?.order_id;
            const userId = metadata?.user_id;
            const reference = transactionData?.reference;

            console.log(`📦 Webhook - orderId: ${orderId}, userId: ${userId}, reference: ${reference}`);

            if (orderId) {
                const order = await Order.findById(orderId);
                
                if (order && !order.isPaid) {
                    // Mettre à jour la commande
                    order.isPaid = true;
                    order.status = "Confirmed";
                    if (reference) {
                        order.geniuspay_reference = reference;
                    }
                    await order.save();

                    // Réduire le stock
                    for (const item of order.items) {
                        const product = await Product.findById(item.product);
                        if (product) {
                            if (product.variants && product.variants.length > 0) {
                                const variant = product.variants.find(v => 
                                    v.color === item.color && v.size === item.size
                                );
                                if (variant) {
                                    variant.stock = Math.max(0, variant.stock - item.quantity);
                                    await product.save();
                                }
                            } else {
                                product.stock = Math.max(0, (product.stock || 0) - item.quantity);
                                await product.save();
                            }
                        }
                    }

                    // ✅ VIDER LE PANIER DE L'UTILISATEUR (AJOUTÉ)
                    if (userId) {
                        await User.findByIdAndUpdate(userId, { cartItems: {} });
                        console.log(`✅ Panier vidé pour l'utilisateur ${userId}`);
                    }
                    
                    console.log(`✅ Commande ${orderId} confirmée par webhook`);
                } else if (order && order.isPaid) {
                    console.log(`ℹ️ Commande ${orderId} déjà payée`);
                } else {
                    console.log(`⚠️ Commande ${orderId} non trouvée`);
                }
            } else {
                console.log("⚠️ Webhook reçu mais pas d'orderId dans metadata");
            }
        } else if (event === 'payment.failed') {
            console.log("❌ Paiement échoué:", payload.data);
        } else {
            console.log(`ℹ️ Événement non traité: ${event}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});

export default orderRouter;