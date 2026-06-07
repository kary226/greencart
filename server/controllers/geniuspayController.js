import axios from 'axios';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

// Initier un paiement GeniusPay (mode checkout)
export const initiateGeniusPay = async (req, res) => {
    try {
        let { userId, items, address, amount } = req.body;

        console.log("📦 [GeniusPay] Initiation pour user:", userId);
        console.log("📦 [GeniusPay] Montant:", amount);

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

        if (!completeAddress.phone) {
            return res.json({ success: false, message: "Téléphone manquant dans l'adresse" });
        }

        const finalAmount = Math.round(amount);
        if (finalAmount < 200) {
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

        // Créer la commande en base
        const order = await Order.create({
            userId,
            items: formattedItems,
            amount: finalAmount,
            address: completeAddress._id,
            paymentType: "GeniusPay",
            status: "pending_payment",
        });

        console.log("✅ [GeniusPay] Commande créée:", order._id);

        // === ENVOI DES EMAILS ===
        const user = await User.findById(userId);
        if (user && user.email) {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), finalAmount);
            await sendAdminNotificationEmail(order._id.toString(), finalAmount, `${completeAddress.firstName} ${completeAddress.lastName}`, user.email);
        }

        // Formater le téléphone au format international (GENIUSPAY EXIGE +225XXXXXXXXX)
        let phone = completeAddress.phone;
        phone = phone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
            phone = phone.substring(1);
        }
        if (!phone.startsWith('225')) {
            phone = `225${phone}`;
        }
        phone = `+${phone}`;

        // Préparer la requête vers GeniusPay
        const geniusPayload = {
            amount: finalAmount,
            description: `Commande #${order._id.toString().slice(-8)}`,
            customer: {
                name: `${completeAddress.firstName} ${completeAddress.lastName}`.substring(0, 100),
                phone: phone,
            },
            success_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${order._id}`,
            error_url: `${process.env.FRONTEND_URL}/payment/error?orderId=${order._id}`,
            // ✅ AJOUT DU METADATA (indispensable pour le webhook)
            metadata: {
                order_id: order._id.toString(),
                user_id: userId.toString()
            }
        };

        console.log("🔗 [GeniusPay] Payload envoyé:", JSON.stringify(geniusPayload, null, 2));
        console.log("🔗 [GeniusPay] success_url:", geniusPayload.success_url);
        console.log("🔗 [GeniusPay] error_url:", geniusPayload.error_url);

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

        console.log("📡 [GeniusPay] Réponse API:", response.status, response.data.success);

        if (response.data.success) {
            const checkoutUrl = response.data.data.checkout_url;
            
            await Order.findByIdAndUpdate(order._id, {
                geniuspay_reference: response.data.data.reference,
            });

            console.log("🚀 [GeniusPay] Redirection vers:", checkoutUrl);

            return res.json({ success: true, checkout_url: checkoutUrl, orderId: order._id });
        } else {
            await Order.findByIdAndDelete(order._id);
            console.log("❌ [GeniusPay] Échec initiation:", response.data.error?.message);
            return res.json({ success: false, message: response.data.error?.message || "Erreur d'initiation GeniusPay" });
        }
    } catch (error) {
        console.error("❌ [GeniusPay] Erreur:", error.message);
        
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
        
        res.json({ success: false, message: error.message || "Erreur lors de l'initialisation du paiement" });
    }
};

// Webhook pour confirmer les paiements
export const geniuspayWebhook = async (req, res) => {
    console.log("🔔 [Webhook] Reçu:", JSON.stringify(req.body, null, 2));
    
    try {
        const payload = req.body;
        const event = payload.event;

        console.log(`🔔 [Webhook] Événement: ${event}`);

        if (event === 'payment.success') {
            // La structure peut varier selon la version de l'API
            const transactionData = payload.data?.transaction || payload.data;
            const metadata = transactionData?.metadata || payload.data?.metadata;
            const orderId = metadata?.order_id;
            const userId = metadata?.user_id;
            const reference = transactionData?.reference;

            console.log(`📦 [Webhook] orderId: ${orderId}, userId: ${userId}, reference: ${reference}`);

            if (orderId) {
                const order = await Order.findById(orderId);
                
                if (order && !order.isPaid) {
                    order.isPaid = true;
                    order.status = "Confirmed";
                    if (reference) {
                        order.geniuspay_reference = reference;
                    }
                    await order.save();
                    
                    console.log(`✅ [Webhook] Commande ${orderId} confirmée`);

                    // Vider le panier
                    if (userId) {
                        await User.findByIdAndUpdate(userId, { cartItems: {} });
                        console.log(`✅ [Webhook] Panier vidé pour user ${userId}`);
                    }
                } else if (order && order.isPaid) {
                    console.log(`ℹ️ [Webhook] Commande ${orderId} déjà payée`);
                } else {
                    console.log(`⚠️ [Webhook] Commande ${orderId} non trouvée`);
                }
            } else {
                console.log("⚠️ [Webhook] Pas d'orderId dans metadata");
            }
        } else if (event === 'payment.failed') {
            console.log("❌ [Webhook] Paiement échoué");
        } else {
            console.log(`ℹ️ [Webhook] Événement non traité: ${event}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("❌ [Webhook] Erreur:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};