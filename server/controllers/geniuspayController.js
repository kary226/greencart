import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

// ============================================================
// [FIX C1] Vérification de la signature du webhook GeniusPay.
//
// ⚠️ À AJUSTER : le nom de l'en-tête ('x-geniuspay-signature') et
// l'algorithme (HMAC SHA-256 sur le corps brut) sont une structure
// standard, mais GeniusPay peut utiliser un nom d'en-tête ou un
// format différent. Vérifie leur documentation / dashboard
// développeur et ajuste si besoin.
//
// Il faut définir GENIUSPAY_WEBHOOK_SECRET dans les variables
// d'environnement (valeur fournie par GeniusPay, distincte de
// GENIUSPAY_API_KEY / GENIUSPAY_API_SECRET).
//
// Important : pour que la signature soit vérifiable sur le corps EXACT
// envoyé par GeniusPay, idéalement le webhook devrait utiliser
// express.raw() plutôt que express.json() (comme c'est déjà le cas
// pour le webhook Stripe dans server.js), puis parser le JSON
// manuellement après vérification. Tant que GENIUSPAY_WEBHOOK_SECRET
// n'est pas configuré, la vérification ci-dessous rejette tout appel
// (fail-closed) plutôt que de l'accepter par défaut.
// ============================================================
function verifyGeniusPaySignature(req) {
    const secret = process.env.GENIUSPAY_WEBHOOK_SECRET;
    if (!secret) {
        console.error("❌ GENIUSPAY_WEBHOOK_SECRET non configuré — webhook rejeté par défaut (fail-closed)");
        return false;
    }

    const signature = req.headers['x-geniuspay-signature'];
    if (!signature) {
        console.error("❌ En-tête de signature GeniusPay manquant");
        return false;
    }

    const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);

    if (sigBuf.length !== expectedBuf.length) {
        return false;
    }

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

// Initier un paiement GeniusPay (mode checkout)
export const initiateGeniusPay = async (req, res) => {
    try {
        // [FIX C2] 'amount' n'est plus extrait du corps de la requête :
        // il est désormais entièrement recalculé côté serveur ci-dessous,
        // jamais fait confiance à une valeur envoyée par le client.
        let { userId, items, address } = req.body;

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

        if (!Array.isArray(items) || items.length === 0) {
            return res.json({ success: false, message: "Panier vide" });
        }

        // ============================================================
        // [FIX C2] Recalcul intégral du montant et des prix unitaires
        // côté serveur, à partir de la base de données — exactement
        // comme le font déjà placeOrderCOD / placeOrderStripe.
        // On ne fait JAMAIS confiance à un prix ou un montant envoyé
        // par le client.
        // ============================================================
        let amount = 0;
        const formattedItems = [];

        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.json({ success: false, message: "Produit introuvable" });
            }

            let priceAtOrder = product.offerPrice;

            // [FIX bug "montant minimum 200 FCFA"] Gestion des variantes
            // (couleur/taille) : utiliser le prix de la variante UNIQUEMENT
            // s'il est strictement positif. Certaines variantes n'ont pas
            // de prix propre renseigné en base (offerPrice: 0 par défaut
            // dans le schéma) ; dans ce cas le prix du produit parent fait
            // foi. Sans ce garde-fou, une variante à offerPrice: 0 ramenait
            // priceAtOrder à 0 pour tout le panier, donc amount = 0, d'où
            // le rejet systématique "montant minimum 200 FCFA" même avec
            // des articles chers dans le panier.
            // selectedColor/selectedSize peuvent valoir null (produit simple)
            // ou undefined (champ absent) selon le frontend : on normalise
            // avec '== null' pour traiter les deux pareil.
            if (product.variants && product.variants.length > 0) {
                const variant = product.variants.find(v =>
                    (item.selectedColor == null ? v.color == null : v.color === item.selectedColor) &&
                    (item.selectedSize == null ? v.size == null : v.size === item.selectedSize)
                );
                if (variant && variant.offerPrice > 0) {
                    priceAtOrder = variant.offerPrice;
                }
            }

            if (!priceAtOrder || priceAtOrder <= 0) {
                console.error(`❌ Prix invalide (${priceAtOrder}) pour le produit ${product._id} (${product.name})`);
                return res.json({ success: false, message: `Prix indisponible pour "${product.name}", veuillez réessayer ou contacter le support` });
            }

            const quantity = Number(item.quantity);
            if (!Number.isInteger(quantity) || quantity <= 0) {
                return res.json({ success: false, message: "Quantité invalide" });
            }

            amount += priceAtOrder * quantity;

            formattedItems.push({
                product: item.product,
                quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null,
                priceAtOrder
            });
        }

        // NOTE: si des frais de livraison et/ou une remise coupon doivent
        // s'appliquer (cf. M2 de l'audit), ils doivent être recalculés et
        // revalidés ici côté serveur (jamais lus depuis req.body) avant
        // d'être ajoutés/déduits de 'amount'. Non traité dans ce correctif
        // car hors périmètre des failles critiques C1/C2/C3.

        const finalAmount = Math.round(amount);
        if (finalAmount < 200) {
            return res.json({ success: false, message: "Le montant minimum est de 200 FCFA" });
        }

        // Créer la commande en base
        const order = await Order.create({
            userId,
            items: formattedItems,
            amount: finalAmount,
            address: completeAddress._id,
            paymentType: "GeniusPay",
            status: "pending_payment",
        });

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
    // ============================================================
    // [FIX C1] Vérification de signature AVANT toute action.
    // Sans signature valide, le payload n'est jamais traité :
    // c'est ce qui empêche un attaquant de fabriquer un faux
    // "payment.success" pour obtenir une commande gratuite.
    // ============================================================
    if (!verifyGeniusPaySignature(req)) {
        console.error("❌ Signature GeniusPay invalide ou absente — webhook rejeté");
        return res.status(401).json({ error: "Invalid signature" });
    }

    try {
        const payload = req.body;
        const event = payload.event;

        console.log("=== WEBHOOK GENIUSPAY RECU (signature vérifiée) ===");
        console.log("Événement:", event);

        if (event === 'payment.success') {
            const transactionData = payload.data;
            const metadata = transactionData.metadata;
            const orderId = metadata?.order_id;
            const userId = metadata?.user_id;
            const reference = transactionData.reference;

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

            // 2. Vérifier si déjà traitée (idempotence)
            if (order.isPaid && order.status === "Confirmed") {
                console.log(`ℹ️ Commande ${orderId} déjà confirmée, ignorer`);
                return res.status(200).json({ received: true, alreadyProcessed: true });
            }

            // ============================================================
            // [FIX C1 - défense en profondeur] Avant de marquer la commande
            // comme payée, on revérifie le montant auprès de l'API GeniusPay
            // plutôt que de faire confiance aveuglément au payload reçu.
            // Si GENIUSPAY_BASE_URL/clé API ne sont pas configurés pour ce
            // type de vérification, ce bloc peut être adapté selon
            // l'endpoint exact exposé par GeniusPay pour relire un paiement
            // (ex: GET /payments/:reference).
            // ============================================================
            if (reference) {
                try {
                    const verifyResponse = await axios.get(
                        `${process.env.GENIUSPAY_BASE_URL}/payments/${reference}`,
                        {
                            headers: {
                                'X-API-Key': process.env.GENIUSPAY_API_KEY,
                                'X-API-Secret': process.env.GENIUSPAY_API_SECRET,
                            },
                        }
                    );
                    const remoteStatus = verifyResponse.data?.data?.status;
                    const remoteAmount = verifyResponse.data?.data?.amount;

                    if (remoteStatus !== 'success' && remoteStatus !== 'completed') {
                        console.error(`❌ Statut GeniusPay distant non confirmé pour ${reference}: ${remoteStatus}`);
                        return res.status(400).json({ error: "Payment not confirmed by provider" });
                    }
                    if (typeof remoteAmount === 'number' && remoteAmount !== order.amount) {
                        console.error(`❌ Montant GeniusPay distant (${remoteAmount}) ≠ montant commande (${order.amount}) pour ${reference}`);
                        return res.status(400).json({ error: "Amount mismatch" });
                    }
                } catch (verifyError) {
                    console.error("❌ Échec de la revérification auprès de GeniusPay:", verifyError.message);
                    return res.status(502).json({ error: "Unable to verify payment with provider" });
                }
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

                if (product.variants && product.variants.length > 0) {
                    const variant = product.variants.find(v =>
                        v.color === item.color && v.size === item.size
                    );
                    if (variant) {
                        variant.stock = Math.max(0, (variant.stock || 0) - item.quantity);
                        await product.save();
                    } else {
                        console.warn(`⚠️ Variant (${item.color}/${item.size}) non trouvé pour produit ${product.name}`);
                    }
                } else {
                    product.stock = Math.max(0, (product.stock || 0) - item.quantity);
                    await product.save();
                }
            }

            // 5. Vider le panier de l'utilisateur
            if (userId) {
                await User.findByIdAndUpdate(userId, { cartItems: {} });
                console.log(`🗑️ Panier vidé pour l'utilisateur ${userId}`);
            }

            // 6. Envoi des emails après confirmation
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
                    await sendAdminNotificationEmail(
                        order._id.toString(),
                        order.amount,
                        `${address.firstName} ${address.lastName}`,
                        user.email
                    );
                } catch (emailError) {
                    console.error("❌ Erreur envoi emails:", emailError);
                }
            } else {
                console.warn("⚠️ Impossible d'envoyer les emails: utilisateur ou adresse manquant");
            }

            console.log(`✅ Commande ${orderId} finalisée avec succès`);
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