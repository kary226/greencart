import Order from "../models/Order.js";
import Product from "../models/Product.js";
import stripe from "stripe";
import User from "../models/User.js";
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

// ✅ Réduction du stock de façon ATOMIQUE (évite la race condition)
const reduceVariantStock = async (items) => {
    for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) continue;

        if (product.variants?.length > 0) {
            const variantIndex = product.variants.findIndex(v =>
                (item.color ? v.color === item.color : !v.color) &&
                (item.size ? v.size === item.size : !v.size)
            );
            if (variantIndex !== -1) {
                // ✅ Mise à jour atomique avec $inc pour éviter les race conditions
                await Product.findOneAndUpdate(
                    { _id: item.product, [`variants.${variantIndex}.stock`]: { $gte: item.quantity } },
                    {
                        $inc: { [`variants.${variantIndex}.stock`]: -item.quantity }
                    }
                );
                // Mettre à jour inStock
                const updated = await Product.findById(item.product);
                if (updated) {
                    updated.inStock = updated.variants.some(v => v.stock > 0);
                    await updated.save();
                }
            }
        } else if (product.stock !== null && product.stock !== undefined) {
            // ✅ Mise à jour atomique du stock simple
            await Product.findOneAndUpdate(
                { _id: item.product, stock: { $gte: item.quantity } },
                {
                    $inc: { stock: -item.quantity },
                    $set: { inStock: product.stock - item.quantity > 0 }
                }
            );
        }
    }
};

// ✅ Récupérer tous les produits en UNE seule requête (au lieu d'une par produit)
const buildItemsWithPrice = async (items) => {
    const productIds = items.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    let amount = 0;
    const itemsWithPrice = items.map(item => {
        const product = productMap.get(item.product.toString());
        if (!product) throw new Error(`Produit introuvable: ${item.product}`);
        const priceAtOrder = product.offerPrice;
        amount += priceAtOrder * item.quantity;
        return {
            product: item.product,
            quantity: item.quantity,
            color: item.selectedColor || null,
            size: item.selectedSize || null,
            priceAtOrder
        };
    });

    return { itemsWithPrice, amount };
};

// Place Order COD : /api/order/cod
export const placeOrderCOD = async (req, res) => {
    try {
        const { userId, items, address } = req.body;
        if (!address || items.length === 0) {
            return res.json({ success: false, message: "Invalid data" });
        }

        // ✅ Une seule requête DB pour tous les produits
        const { itemsWithPrice, amount: baseAmount } = await buildItemsWithPrice(items);
        const tax = Math.floor(baseAmount * 0.02);
        const amount = baseAmount + tax;

        const order = await Order.create({
            userId,
            items: itemsWithPrice,
            amount,
            address,
            paymentType: "COD",
            status: "Order Placed",
            isPaid: true
        });

        await reduceVariantStock(itemsWithPrice);
        await User.findByIdAndUpdate(userId, { cartItems: {} });

        const user = await User.findById(userId);
        if (user?.email) {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), amount);
            await sendAdminNotificationEmail(order._id.toString(), amount, user.name, user.email);
        }

        return res.json({ success: true, message: "Order Placed Successfully" });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

// Place Order Stripe : /api/order/stripe
export const placeOrderStripe = async (req, res) => {
    try {
        const { userId, items, address } = req.body;
        const { origin } = req.headers;

        if (!address || items.length === 0) {
            return res.json({ success: false, message: "Invalid data" });
        }

        // ✅ Une seule requête DB pour tous les produits
        const productIds = items.map(item => item.product);
        const products = await Product.find({ _id: { $in: productIds } });
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        let amount = 0;
        const itemsWithPrice = [];
        const productData = [];

        for (const item of items) {
            const product = productMap.get(item.product.toString());
            if (!product) return res.json({ success: false, message: `Produit introuvable` });
            const priceAtOrder = product.offerPrice;
            amount += priceAtOrder * item.quantity;
            itemsWithPrice.push({
                product: item.product,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null,
                priceAtOrder
            });
            productData.push({
                name: product.name,
                price: priceAtOrder,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null
            });
        }

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

        const line_items = productData.map(item => ({
            price_data: {
                currency: "usd",
                product_data: {
                    name: `${item.name}${item.color ? ` (${item.color})` : ''}${item.size ? ` - ${item.size}` : ''}`
                },
                unit_amount: Math.floor(item.price + item.price * 0.02) * 100
            },
            quantity: item.quantity,
        }));

        const session = await stripeInstance.checkout.sessions.create({
            line_items,
            mode: "payment",
            success_url: `${origin}/loader?next=my-orders`,
            cancel_url: `${origin}/cart`,
            metadata: { orderId: order._id.toString(), userId }
        });

        const user = await User.findById(userId);
        if (user?.email) {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), amount);
            await sendAdminNotificationEmail(order._id.toString(), amount, user.name, user.email);
        }

        return res.json({ success: true, url: session.url });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

// Stripe Webhooks : /stripe
export const stripeWebhooks = async (request, response) => {
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];
    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(
            request.body, sig, process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        return response.status(400).send(`Webhook Error: ${error.message}`);
    }

    switch (event.type) {
        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object;
            const session = await stripeInstance.checkout.sessions.list({
                payment_intent: paymentIntent.id,
            });
            const { orderId, userId } = session.data[0].metadata;
            await Order.findByIdAndUpdate(orderId, { isPaid: true });
            const order = await Order.findById(orderId);
            if (order) {
                await reduceVariantStock(order.items);
                await User.findByIdAndUpdate(userId, { cartItems: {} });
            }
            break;
        }
        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object;
            const session = await stripeInstance.checkout.sessions.list({
                payment_intent: paymentIntent.id,
            });
            const { orderId } = session.data[0].metadata;
            await Order.findByIdAndDelete(orderId);
            break;
        }
        default:
            console.error(`Unhandled event type ${event.type}`);
            break;
    }
    response.json({ received: true });
};

// Update Order Status : /api/order/status
export const updateOrderStatus = async (req, res) => {
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
export const getUserOrders = async (req, res) => {
    try {
        const { userId } = req.body;
        const orders = await Order.find({
            userId,
            $or: [{ paymentType: "COD" }, { isPaid: true }]
        }).populate("items.product address").sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ✅ Get All Orders avec PAGINATION : /api/order/seller
export const getAllOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = { $or: [{ paymentType: "COD" }, { isPaid: true }] };

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate("items.product address")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Order.countDocuments(query)
        ]);

        res.json({
            success: true,
            orders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get Orders d'un client spécifique (admin)
export const getUserOrdersByAdmin = async (req, res) => {
    try {
        const { userId } = req.params;
        const [orders, user] = await Promise.all([
            Order.find({
                userId,
                $or: [{ paymentType: "COD" }, { isPaid: true }]
            }).populate("items.product address").sort({ createdAt: -1 }),
            User.findById(userId).select("-password")
        ]);

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
        res.json({ success: false, message: error.message });
    }
};
