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
// Implémentation conforme au guide d'intégration officiel GeniusPay :
//   - Header signature : X-Webhook-Signature
//   - Header timestamp  : X-Webhook-Timestamp
//   - Donnée signée     : `${timestamp}.${json_payload}`
//   - Algorithme        : HMAC SHA-256, secret commençant par 'whsec_'
//
// 'rawBody' doit être le corps EXACT (octets bruts) reçu de GeniusPay,
// avant tout reparsing JSON — voir server.js qui monte ce webhook avec
// express.raw() pour préserver ce corps brut. Si on signait
// JSON.stringify(req.body) après un express.json(), un simple
// réordonnancement de clés ou changement d'espacement suffirait à
// faire échouer la vérification même avec le bon secret — ce qui
// correspond exactement au symptôme observé ("Invalid signature"
// alors que le paiement a bien été effectué).
//
// On vérifie aussi le timestamp (anti-replay) : un webhook de plus de
// 5 minutes est rejeté, comme recommandé par GeniusPay.
//
// Il faut définir GENIUSPAY_WEBHOOK_SECRET dans les variables
// d'environnement (valeur 'whsec_...' du dashboard GeniusPay, distincte
// de GENIUSPAY_API_KEY / GENIUSPAY_API_SECRET). Si GeniusPay expose des
// secrets distincts sandbox/live, adapter pour lire
// GENIUSPAY_WEBHOOK_SECRET_SANDBOX / _LIVE selon GENIUSPAY_MODE.
// ============================================================
const WEBHOOK_MAX_AGE_SECONDS = 5 * 60; // 5 minutes, comme recommandé par GeniusPay

function verifyGeniusPaySignature(req, rawBody) {
    const secret = process.env.GENIUSPAY_WEBHOOK_SECRET;
    if (!secret) {
        console.error("❌ GENIUSPAY_WEBHOOK_SECRET non configuré — webhook rejeté par défaut (fail-closed)");
        return { valid: false, reason: 'missing_secret' };
    }

    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    if (!signature || !timestamp) {
        console.error("❌ Headers X-Webhook-Signature / X-Webhook-Timestamp manquants");
        return { valid: false, reason: 'missing_headers' };
    }

    // Anti-replay : rejeter les webhooks trop anciens
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > WEBHOOK_MAX_AGE_SECONDS) {
        console.error(`❌ Timestamp webhook hors fenêtre acceptable (timestamp=${timestamp})`);
        return { valid: false, reason: 'timestamp_too_old' };
    }

    const data = `${timestamp}.${rawBody}`;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { valid: false, reason: 'signature_mismatch' };
    }

    return { valid: true };
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

// ============================================================
// [FIX déploiement Vercel] Lecture du corps brut de la requête.
//
// Sur Vercel (runtime @vercel/node), il arrive que le body soit déjà
// pré-parsé en objet JS avant même qu'Express/express.raw() ne le
// reçoive, ce qui rend req.body inutilisable comme source pour une
// vérification de signature bit-exacte (JSON.stringify(req.body) peut
// différer de l'original signé par GeniusPay : ordre des clés,
// espacement). On essaie donc, dans l'ordre :
//   1. req.body s'il est déjà un Buffer (cas standard avec express.raw())
//   2. req.rawBody si le runtime l'expose (certains wrappers Vercel le
//      font, ex. via micro ou un middleware custom)
//   3. Lecture manuelle du stream req lui-même
//   4. En dernier recours, JSON.stringify(req.body) si tout le reste a
//      échoué (req.body déjà un objet parsé et le stream déjà consommé)
//      — ce cas peut faire échouer la vérification de signature si
//      l'ordre des clés diffère, mais évite un crash et permet de le
//      diagnostiquer via les logs.
// ============================================================
function getRawBody(req) {
    if (Buffer.isBuffer(req.body)) {
        return Promise.resolve(req.body.toString('utf8'));
    }
    if (typeof req.rawBody === 'string') {
        return Promise.resolve(req.rawBody);
    }
    if (Buffer.isBuffer(req.rawBody)) {
        return Promise.resolve(req.rawBody.toString('utf8'));
    }

    return new Promise((resolve) => {
        let data = '';
        let resolved = false;

        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => {
            if (!resolved) {
                resolved = true;
                if (data.length > 0) {
                    resolve(data);
                } else {
                    // Stream vide : le body a probablement déjà été
                    // consommé en amont (pré-parsing Vercel). On retombe
                    // sur req.body en dernier recours.
                    console.warn("⚠️ Stream de requête vide — body probablement déjà pré-parsé par le runtime. Fallback sur JSON.stringify(req.body), la vérification de signature peut échouer si l'ordre des clés diffère de l'original.");
                    resolve(typeof req.body === 'object' ? JSON.stringify(req.body) : '');
                }
            }
        });
        req.on('error', () => {
            if (!resolved) {
                resolved = true;
                resolve(typeof req.body === 'object' ? JSON.stringify(req.body) : '');
            }
        });

        // Si le stream a déjà été entièrement consommé avant notre
        // attache des listeners, 'end' peut ne jamais se déclencher car
        // il a déjà eu lieu. Filet de sécurité court (le webhook doit de
        // toute façon répondre vite, donc ce délai reste négligeable).
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(typeof req.body === 'object' ? JSON.stringify(req.body) : data);
            }
        }, 2000);
    });
}

// Webhook pour confirmer les paiements et mettre à jour le stock
//
// IMPORTANT : cette route doit être montée dans server.js avec
// express.raw({ type: 'application/json' }) — comme le webhook Stripe —
// et NON express.json(), pour que req.body soit le Buffer brut exact
// envoyé par GeniusPay. C'est nécessaire pour que la vérification de
// signature (sur `${timestamp}.${rawBody}`) corresponde bit à bit à ce
// que GeniusPay a signé de son côté. Sur Vercel, voir getRawBody()
// ci-dessus pour la gestion du cas où le runtime pré-parse le body.
export const geniuspayWebhook = async (req, res) => {
    const rawBody = await getRawBody(req);

    // ============================================================
    // [FIX C1] Vérification de signature AVANT toute action.
    // Sans signature valide, le payload n'est jamais traité :
    // c'est ce qui empêche un attaquant de fabriquer un faux
    // "payment.success" pour obtenir une commande gratuite.
    // ============================================================
    const verification = verifyGeniusPaySignature(req, rawBody);
    if (!verification.valid) {
        console.error(`❌ Webhook GeniusPay rejeté (${verification.reason})`);
        return res.status(401).json({ error: "Invalid signature" });
    }

    try {
        const payload = JSON.parse(rawBody);
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