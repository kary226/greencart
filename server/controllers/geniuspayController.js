import axios from 'axios';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

// Initier un paiement GeniusPay (mode checkout)
export const initiateGeniusPay = async (req, res) => {
    try {
        let { userId, items, address, amount } = req.body;

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

        // ✅ SUPPRESSION DES EMAILS ICI (déplacés dans le webhook)

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
            metadata: {
                order_id: order._id.toString(),
                user_id: userId.toString()
            }
        };

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
        console.error("Erreur GeniusPay:", error.message);
        
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
        
        res.json({ success: false, message: error.message || "Erreur lors de l'initialisation du paiement" });
    }
};

// Webhook pour confirmer les paiements et mettre à jour le stock
export const geniuspayWebhook = async (req, res) => {
    try {
        const payload = req.body;
        const event = payload.event;

        console.log("=== WEBHOOK GENIUSPAY RECU ===");
        console.log("Événement:", event);
        console.log("Payload:", JSON.stringify(payload, null, 2));

        if (event === 'payment.success') {
            const transactionData = payload.data;
            const metadata = transactionData.metadata;
            const orderId = metadata?.order_id;
            const userId = metadata?.user_id;
            const reference = transactionData.reference;

            console.log(`📦 Traitement de la commande: ${orderId}`);
            console.log(`👤 Utilisateur: ${userId}`);
            console.log(`🔖 Référence: ${reference}`);

            if (!orderId) {
                console.error("❌ orderId manquant dans le webhook");
                return res.status(400).json({ error: "orderId missing" });
            }

            // 1. Récupérer la commande
            const order = await Order.findById(orderId);
            if (!order) {
                console.error(`❌ Commande ${orderId} non trouvée`);
                return res.status(404).json({ error: "Order not found" });
            }

            // 2. Vérifier si déjà traitée
            if (order.isPaid && order.status === "Confirmed") {
                console.log(`ℹ️ Commande ${orderId} déjà confirmée, ignorer`);
                return res.status(200).json({ received: true, alreadyProcessed: true });
            }

            // 3. Marquer la commande comme payée
            order.isPaid = true;
            order.status = "Confirmed";
            if (reference) {
                order.geniuspay_reference = reference;
            }
            await order.save();
            console.log(`✅ Commande ${orderId} marquée comme payée`);

            // 4. Mettre à jour le stock pour chaque produit
            const ProductModel = mongoose.model('product');
            for (const item of order.items) {
                const product = await ProductModel.findById(item.product);
                if (!product) {
                    console.warn(`⚠️ Produit ${item.product} non trouvé, stock non mis à jour`);
                    continue;
                }

                // Gestion des variantes (couleur, taille)
                if (product.variants && product.variants.length > 0) {
                    const variant = product.variants.find(v => 
                        v.color === item.color && v.size === item.size
                    );
                    if (variant) {
                        const ancienStock = variant.stock;
                        variant.stock = Math.max(0, (variant.stock || 0) - item.quantity);
                        await product.save();
                        console.log(`📦 Stock mis à jour pour variant ${item.color}/${item.size}: ${ancienStock} → ${variant.stock}`);
                    } else {
                        console.warn(`⚠️ Variant (${item.color}/${item.size}) non trouvé pour produit ${product.name}`);
                    }
                } else {
                    // Stock simple (sans variantes)
                    const ancienStock = product.stock || 0;
                    product.stock = Math.max(0, ancienStock - item.quantity);
                    await product.save();
                    console.log(`📦 Stock mis à jour pour produit ${product.name}: ${ancienStock} → ${product.stock}`);
                }
            }

            // 5. Vider le panier de l'utilisateur
            await User.findByIdAndUpdate(userId, { cartItems: {} });
            console.log(`🗑️ Panier vidé pour l'utilisateur ${userId}`);

            // 6. ✅ ENVOI DES EMAILS APRÈS CONFIRMATION
            const user = await User.findById(userId);
            const Address = mongoose.model('address');
            const address = await Address.findById(order.address);
            
            if (user && user.email && address) {
                try {
                    await sendOrderConfirmationEmail(
                        user.email, 
                        order._id.toString(), 
                        order.amount
                    );
                    console.log(`📧 Email de confirmation envoyé à ${user.email}`);
                    
                    await sendAdminNotificationEmail(
                        order._id.toString(), 
                        order.amount, 
                        `${address.firstName} ${address.lastName}`, 
                        user.email
                    );
                    console.log(`📧 Email admin envoyé pour commande ${order._id.toString().slice(-8)}`);
                } catch (emailError) {
                    console.error("❌ Erreur envoi emails:", emailError);
                }
            } else {
                console.warn("⚠️ Impossible d'envoyer les emails: utilisateur ou adresse manquant");
            }

            console.log(`✅✅✅ Commande ${orderId} finalisée avec succès ✅✅✅`);
        } else if (event === 'payment.failed') {
            console.log("❌ Paiement échoué:", payload.data);
        } else {
            console.log(`ℹ️ Événement non traité: ${event}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("❌ Webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};