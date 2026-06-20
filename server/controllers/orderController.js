import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js"
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

// Fonction pour réduire le stock des VARIANTS après commande
const reduceVariantStock = async (items) => {
    for (const item of items) {
        const product = await Product.findById(item.product)
        if (product && product.variants?.length > 0) {
            const variant = product.variants.find(v => 
                (item.color ? v.color === item.color : !v.color) &&
                (item.size ? v.size === item.size : !v.size)
            );
            
            if (variant) {
                variant.stock = Math.max(0, variant.stock - item.quantity);
                product.inStock = product.variants.some(v => v.stock > 0);
                await product.save();
            }
        } else if (product && product.stock !== null && product.stock !== undefined) {
            const newStock = Math.max(0, product.stock - item.quantity);
            const inStock = newStock > 0;
            await Product.findByIdAndUpdate(item.product, {
                stock: newStock,
                inStock
            });
        }
    }
};

// Place Order COD : /api/order/cod
//
// NOTE : cette fonction présente le même défaut M2 identifié dans l'audit
// (frais de livraison et remise coupon envoyés par le client mais jamais
// recalculés/déduits du montant final, contrairement à ce qui a été corrigé
// pour GeniusPay dans geniuspayController.js). Non corrigé ici : périmètre
// limité au retrait de Stripe pour cette passe. Dis-le si tu veux que ce
// même correctif (recalcul livraison + coupon côté serveur) soit appliqué
// ici aussi.
export const placeOrderCOD = async (req, res)=>{
    try {
        const { userId, items, address } = req.body;
        if(!address || items.length === 0){
            return res.json({success: false, message: "Invalid data"});
        }

        let amount = 0;
        const itemsWithPrice = await Promise.all(items.map(async (item) => {
            const product = await Product.findById(item.product);
            const priceAtOrder = product.offerPrice;
            amount += priceAtOrder * item.quantity;
            return {
                product: item.product,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null,
                priceAtOrder: priceAtOrder
            };
        }));

        const tax = Math.floor(amount * 0.02);
        amount += tax;

        const order = await Order.create({
            userId,
            items: itemsWithPrice,
            amount,
            address,
            paymentType: "COD",
            status: "Order Placed"
        });

        await reduceVariantStock(itemsWithPrice);
        await User.findByIdAndUpdate(userId, {cartItems: {}});

        // === ENVOI DES EMAILS ===
        const user = await User.findById(userId);
        if (user && user.email) {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), amount);
            await sendAdminNotificationEmail(order._id.toString(), amount, `${user.name}`, user.email);
        }

        return res.json({success: true, message: "Order Placed Successfully" });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

// [FIX] Stripe retiré : GreenCart n'utilise que GeniusPay et COD comme
// moyens de paiement. Les fonctions placeOrderStripe et stripeWebhooks
// (anciennement définies ici, route POST /stripe) ont été supprimées,
// ainsi que l'import du SDK 'stripe'.

// Update Order Status : /api/order/status
export const updateOrderStatus = async (req, res)=>{
    try {
        const { orderId, status } = req.body;
        const validStatuses = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.json({ success: false, message: "Statut invalide" });
        }
        
        await Order.findByIdAndUpdate(orderId, { status });
        res.json({ success: true, message: "Statut mis à jour" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get Orders by User ID : /api/order/user
export const getUserOrders = async (req, res)=>{
    try {
        const { userId } = req.body;
        const orders = await Order.find({
            userId,
            $or: [{paymentType: "COD"}, {isPaid: true}]
        }).populate("items.product address").sort({createdAt: -1});
        res.json({ success: true, orders });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get All Orders ( for seller / admin) : /api/order/seller
export const getAllOrders = async (req, res)=>{
    try {
        const orders = await Order.find({
            $or: [{paymentType: "COD"}, {isPaid: true}]
        }).populate("items.product address").sort({createdAt: -1});
        res.json({ success: true, orders });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ==================== ADMIN : Récupérer les commandes d'un client spécifique ====================

export const getUserOrdersByAdmin = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const orders = await Order.find({
            userId,
            $or: [{paymentType: "COD"}, {isPaid: true}]
        }).populate("items.product address").sort({createdAt: -1});
        
        const user = await User.findById(userId).select("-password");
        
        res.json({ 
            success: true, 
            orders,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};