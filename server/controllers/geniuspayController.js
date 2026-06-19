import crypto from 'crypto';
import axios from 'axios';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

// --- Vérification signature HMAC du webhook GeniusPay (corrigée) ---
const verifyGeniusPaySignature = (req) => {
    const secret = process.env.GENIUSPAY_WEBHOOK_SECRET;
    if (!secret) {
        console.error("❌ GENIUSPAY_WEBHOOK_SECRET non défini");
        return false;
    }

    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    if (!signature || !timestamp) {
        console.warn("⚠️ Webhook GeniusPay reçu sans signature ou timestamp");
        return false;
    }

    const payload = JSON.stringify(req.body);
    const dataToSign = timestamp + '.' + payload;
    const expected = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
};

// --- Initier un paiement (inchangé) ---
export const initiateGeniusPay = async (req, res) => {
    try {
        const { userId, items, address } = req.body;

        let recalculatedAmount = 0;
        const formattedItems = [];
        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.json({ success: false, message: `Produit introuvable` });
            }
            const priceAtOrder = product.offerPrice ?? product.price;
            recalculatedAmount += priceAtOrder * item.quantity;

            formattedItems.push({
                product: item.product,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null,
                priceAtOrder: priceAtOrder
            });
        }

        const finalAmount = Math.round(recalculatedAmount);
        if (finalAmount < 200) {
            return res.json({ success: false, message: "Le montant minimum est de 200 FCFA" });
        }

        let addressDoc = address;
        if (typeof address === 'string') {
            const Address = mongoose.model('address');
            addressDoc = await Address.findById(address);
            if (!addressDoc) {
                return res.json({ success: false, message: "Adresse non trouvée" });
            }
        }
        const completeAddress = {
            _id: addressDoc._id,
            firstName: addressDoc.firstName,
            lastName: addressDoc.lastName,
            phone: addressDoc.phone,
            street: addressDoc.street || addressDoc.address || '',
            city: addressDoc.city || addressDoc.communeId?.name || 'Abidjan',
            state: addressDoc.state || addressDoc.communeId?.name || 'Cocody',
            zipcode: addressDoc.zipcode || '00000',
            country: addressDoc.country || "Côte d'Ivoire",
            email: addressDoc.email || `${addressDoc.phone}@client.com`,
            communeId: addressDoc.communeId,
            cityId: addressDoc.cityId
        };
        if (!completeAddress.phone) {
            return res.json({ success: false, message: "Téléphone manquant" });
        }

        const order = await Order.create({
            userId,
            items: formattedItems,
            amount: finalAmount,
            address: completeAddress._id,
            paymentType: "GeniusPay",
            status: "pending_payment",
        });

        let phone = completeAddress.phone.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = phone.substring(1);
        if (!phone.startsWith('225')) phone = `225${phone}`;
        phone = `+${phone}`;

        const geniusPayload = {
            amount: finalAmount,
            description: `Commande #${order._id.toString().slice(-8)}`,
            customer: {
                name: `${completeAddress.firstName} ${completeAddress.lastName}`.substring(0, 100),
                phone: phone,
            },
            success_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${order._id}`,
            error_url: `${process.env.FRONTEND_URL}/payment/error?orderId=${order._id}`,
            metadata: {
                order_id: order._id.toString(),
                user_id: userId.toString()
            }
        };

        const response = await axios.post(
            `${process.env.GENIUSPAY_BASE_URL}/payments`,
            geniusPayload,
            {
                headers: {
                    'X-API-Key': process.env.GENIUSPAY_API_KEY,
                    'X-API-Secret': process.env.GENIUSPAY_API_SECRET,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.success) {
            await Order.findByIdAndUpdate(order._id, {
                geniuspay_reference: response.data.data.reference,
            });
            return res.json({ success: true, checkout_url: response.data.data.checkout_url, orderId: order._id });
        } else {
            await Order.findByIdAndDelete(order._id);
            return res.json({ success: false, message: response.data.error?.message || "Erreur d'initiation" });
        }
    } catch (error) {
        console.error("Erreur GeniusPay:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status, "Data:", error.response.data);
        }
        res.json({ success: false, message: error.message || "Erreur lors de l'initialisation du paiement" });
    }
};

// --- Webhook GeniusPay (vérification corrigée) ---
export const geniuspayWebhook = async (req, res) => {
    if (!verifyGeniusPaySignature(req)) {
        console.warn("⛔ Webhook GeniusPay rejeté (signature invalide)");
        return res.status(401).json({ error: "Invalid signature" });
    }

    try {
        const payload = req.body;
        const event = payload.event;
        console.log("=== WEBHOOK GENIUSPAY VÉRIFIÉ ===");

        if (event === 'payment.success') {
            const transactionData = payload.data;
            const metadata = transactionData.metadata;
            const orderId = metadata?.order_id;
            const userId = metadata?.user_id;
            const reference = transactionData.reference;

            if (!orderId) {
                return res.status(400).json({ error: "orderId missing" });
            }

            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ error: "Order not found" });
            }
            if (order.isPaid && order.status === "Confirmed") {
                return res.status(200).json({ received: true, alreadyProcessed: true });
            }

            order.isPaid = true;
            order.status = "Confirmed";
            if (reference) order.geniuspay_reference = reference;
            await order.save();

            const ProductModel = mongoose.model('product');
            for (const item of order.items) {
                const product = await ProductModel.findById(item.product);
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
            const Address = mongoose.model('address');
            const address = await Address.findById(order.address);
            if (user?.email && address) {
                try {
                    await sendOrderConfirmationEmail(user.email, order._id.toString(), order.amount);
                    await sendAdminNotificationEmail(order._id.toString(), order.amount, `${address.firstName} ${address.lastName}`, user.email);
                } catch (emailError) {
                    console.error("Erreur envoi emails:", emailError);
                }
            }
        } else if (event === 'payment.failed') {
            console.log("Paiement échoué:", payload.data);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};