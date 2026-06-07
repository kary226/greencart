import axios from 'axios';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

export const initiateGeniusPay = async (req, res) => {
    try {
        let { userId, items, address, amount } = req.body;

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
        };

        if (!completeAddress.phone) {
            return res.json({ success: false, message: "Téléphone manquant dans l'adresse" });
        }

        const finalAmount = Math.round(amount);
        if (finalAmount < 200) {
            return res.json({ success: false, message: "Montant minimum 200 FCFA" });
        }

        const formattedItems = items.map(item => ({
            product: item.product,
            quantity: item.quantity,
            color: item.selectedColor || null,
            size: item.selectedSize || null,
            priceAtOrder: item.offerPrice
        }));

        const order = await Order.create({
            userId,
            items: formattedItems,
            amount: finalAmount,
            address: completeAddress._id,
            paymentType: "GeniusPay",
            status: "pending_payment",
        });

        const user = await User.findById(userId);
        if (user?.email) {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), finalAmount);
            await sendAdminNotificationEmail(order._id.toString(), finalAmount, `${completeAddress.firstName} ${completeAddress.lastName}`, user.email);
        }

        let phone = completeAddress.phone.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = phone.substring(1);
        if (!phone.startsWith('225')) phone = `225${phone}`;
        phone = `+${phone}`;

        // ✅ Mode direct : paiement via Wave (plus fiable, pas de lien expiré)
        const geniusPayload = {
            amount: finalAmount,
            payment_method: "wave",
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
            // En mode direct, l'URL est dans payment_url
            const paymentUrl = response.data.data.payment_url;
            await Order.findByIdAndUpdate(order._id, { geniuspay_reference: response.data.data.reference });
            return res.json({ success: true, checkout_url: paymentUrl, orderId: order._id });
        } else {
            await Order.findByIdAndDelete(order._id);
            return res.json({ success: false, message: response.data.error?.message || "Erreur d'initiation" });
        }
    } catch (error) {
        console.error("Erreur GeniusPay:", error);
        res.json({ success: false, message: error.message });
    }
};

export const geniuspayWebhook = async (req, res) => {
    try {
        const { event, data } = req.body;
        if (event === 'payment.success') {
            const transaction = data.transaction || data;
            const metadata = transaction.metadata || data.metadata;
            const orderId = metadata?.order_id;
            const userId = metadata?.user_id;
            if (orderId) {
                const order = await Order.findById(orderId);
                if (order && !order.isPaid) {
                    order.isPaid = true;
                    order.status = "Confirmed";
                    if (transaction.reference) order.geniuspay_reference = transaction.reference;
                    await order.save();
                    if (userId) await User.findByIdAndUpdate(userId, { cartItems: {} });
                }
            }
        }
        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Webhook failed" });
    }
};