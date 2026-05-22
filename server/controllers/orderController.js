import Order from "../models/Order.js";
import Product from "../models/Product.js";
import stripe from "stripe"
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

// Place Order Stripe : /api/order/stripe
export const placeOrderStripe = async (req, res)=>{
    try {
        const { userId, items, address } = req.body;
        const {origin} = req.headers;

        if(!address || items.length === 0){
            return res.json({success: false, message: "Invalid data"});
        }

        let productData = [];
        let amount = 0;
        const itemsWithPrice = await Promise.all(items.map(async (item) => {
            const product = await Product.findById(item.product);
            const priceAtOrder = product.offerPrice;
            amount += priceAtOrder * item.quantity;
            
            productData.push({
                name: product.name,
                price: priceAtOrder,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null
            });
            
            return {
                product: item.product,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null,
                priceAtOrder: priceAtOrder
            };
        }));

        amount += Math.floor(amount * 0.02);

        const order = await Order.create({
            userId,
            items: itemsWithPrice,
            amount,
            address,
            paymentType: "Online",
            status: "Order Placed"
        });

        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

        const line_items = productData.map((item)=>{
            return {
                price_data: {
                    currency: "usd",
                    product_data: { 
                        name: `${item.name}${item.color ? ` (${item.color})` : ''}${item.size ? ` - ${item.size}` : ''}` 
                    },
                    unit_amount: Math.floor(item.price + item.price * 0.02) * 100
                },
                quantity: item.quantity,
            };
        });

        const session = await stripeInstance.checkout.sessions.create({
            line_items,
            mode: "payment",
            success_url: `${origin}/loader?next=my-orders`,
            cancel_url: `${origin}/cart`,
            metadata: {
                orderId: order._id.toString(),
                userId,
            }
        });

        // === ENVOI DES EMAILS ===
        const user = await User.findById(userId);
        if (user && user.email) {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), amount);
            await sendAdminNotificationEmail(order._id.toString(), amount, `${user.name}`, user.email);
        }

        return res.json({success: true, url: session.url });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

// Stripe Webhooks : /stripe
export const stripeWebhooks = async (request, response)=>{
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];
    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(
            request.body, sig, process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        response.status(400).send(`Webhook Error: ${error.message}`);
    }

    switch (event.type) {
        case "payment_intent.succeeded":{
            const paymentIntent = event.data.object;
            const paymentIntentId = paymentIntent.id;
            const session = await stripeInstance.checkout.sessions.list({
                payment_intent: paymentIntentId,
            });
            const { orderId, userId } = session.data[0].metadata;

            await Order.findByIdAndUpdate(orderId, {isPaid: true});
            const order = await Order.findById(orderId);
            await reduceVariantStock(order.items);
            await User.findByIdAndUpdate(userId, {cartItems: {}});
            break;
        }
        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object;
            const paymentIntentId = paymentIntent.id;
            const session = await stripeInstance.checkout.sessions.list({
                payment_intent: paymentIntentId,
            });
            const { orderId } = session.data[0].metadata;
            await Order.findByIdAndDelete(orderId);
            break;
        }
        default:
            console.error(`Unhandled event type ${event.type}`);
            break;
    }
    response.json({received: true});
};

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