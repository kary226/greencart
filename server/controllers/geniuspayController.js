import axios from 'axios';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

// Initier un paiement GeniusPay (mode checkout)
export const initiateGeniusPay = async (req, res) => {
    try {
        let { userId, items, address, amount } = req.body;

        console.log("=== INITIATION GENIUSPAY ===");
        console.log("Montant:", amount);
        console.log("Adresse reçue:", address);
        console.log("Clé API présente:", !!process.env.GENIUSPAY_API_KEY);
        console.log("Base URL:", process.env.GENIUSPAY_BASE_URL);

        // Si address est un ID, récupérer l'adresse complète
        let addressDoc = address;
        if (typeof address === 'string') {
            const Address = mongoose.model('address');
            addressDoc = await Address.findById(address);
            if (!addressDoc) {
                return res.json({ success: false, message: "Adresse non trouvée" });
            }
        }

        // Compléter les champs manquants de l'adresse
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

        console.log("Adresse complétée:", completeAddress);

        if (!completeAddress.phone) {
            return res.json({ success: false, message: "Téléphone manquant dans l'adresse" });
        }

        if (Math.round(amount) < 200) {
            return res.json({ success: false, message: "Le montant minimum est de 200 FCFA" });
        }

        // Formater les items avec priceAtOrder
        const formattedItems = items.map(item => ({
            product: item.product,
            quantity: item.quantity,
            color: item.selectedColor || null,
            size: item.selectedSize || null,
            priceAtOrder: item.offerPrice
        }));

        console.log("Items formatés:", JSON.stringify(formattedItems, null, 2));

        // Créer la commande en base
        const order = await Order.create({
            userId,
            items: formattedItems,
            amount: Math.round(amount),
            address: completeAddress._id,
            paymentType: "GeniusPay",
            status: "pending_payment",
        });

        // === ENVOI DES EMAILS ===
        const user = await User.findById(userId);
        if (user && user.email) {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), Math.round(amount));
            await sendAdminNotificationEmail(order._id.toString(), Math.round(amount), `${completeAddress.firstName} ${completeAddress.lastName}`, user.email);
        }

        // Formater le téléphone au format international
        let phone = completeAddress.phone;
        if (phone && !phone.startsWith('+')) {
            phone = phone.replace(/\s/g, '').replace(/-/g, '');
            if (phone.startsWith('0')) {
                phone = phone.substring(1);
            }
            phone = `+225${phone}`;
        }
        console.log("Téléphone formaté:", phone);

        // Préparer la requête vers GeniusPay
        const geniusPayload = {
            amount: Math.round(amount),
            description: `Commande #${order._id.toString().slice(-8)}`,
            customer: {
                name: `${completeAddress.firstName} ${completeAddress.lastName}`,
                phone: phone,
            },
            success_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${order._id}`,
            error_url: `${process.env.FRONTEND_URL}/payment/error?orderId=${order._id}`,
            metadata: {
                order_id: order._id.toString(),
                user_id: userId,
            },
        };

        console.log("Payload envoyé à GeniusPay:", JSON.stringify(geniusPayload, null, 2));

        // Appel à l'API GeniusPay
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

        console.log("Réponse GeniusPay:", response.data);

        if (response.data.success) {
            const checkoutUrl = response.data.data.checkout_url;
            
            await Order.findByIdAndUpdate(order._id, {
                geniuspay_reference: response.data.data.reference,
            });

            return res.json({ success: true, checkout_url: checkoutUrl, orderId: order._id });
        } else {
            await Order.findByIdAndDelete(order._id);
            return res.json({ success: false, message: response.data.error?.message || "Erreur d'initiation GeniusPay" });
        }
    } catch (error) {
        console.error("=== ERREUR GENIUSPAY ===");
        console.error("Message:", error.message);
        
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
        
        res.json({ success: false, message: error.message || "Erreur lors de l'initialisation du paiement" });
    }
};

// Webhook pour confirmer les paiements
export const geniuspayWebhook = async (req, res) => {
    try {
        const payload = req.body;
        const event = payload.event;

        console.log("=== WEBHOOK GENIUSPAY ===");
        console.log("Événement:", event);

        if (event === 'payment.success') {
            const transactionData = payload.data;
            const metadata = transactionData.metadata;
            const orderId = metadata.order_id;
            const userId = metadata.user_id;

            await Order.findByIdAndUpdate(orderId, {
                isPaid: true,
                status: "Confirmed",
                geniuspay_reference: transactionData.reference,
            });

            await User.findByIdAndUpdate(userId, { cartItems: {} });
            
            console.log(`Commande ${orderId} marquée comme payée`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};