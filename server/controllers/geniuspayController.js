import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import DeliveryPrice from '../models/DeliveryPrice.js';
import DeliveryType from '../models/DeliveryType.js';
import Commune from '../models/Commune.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';

// ✅ Fonction pour calculer les dates de livraison estimées (7 jours ouvrés)
// Identique à celle de orderController.js, dupliquée ici pour éviter un
// couplage entre les deux contrôleurs. Le calcul démarre à la date passée
// en argument (ici : la date de confirmation du paiement, pas la date
// d'initiation, car une commande "pending_payment" peut être abandonnée
// et ne jamais aboutir — il serait incohérent de lui donner une date de
// livraison avant d'être sûr qu'elle est payée).
const calculateEstimatedDeliveryDates = (orderDate) => {
    const startDate = new Date(orderDate);

    let workingDaysAdded = 0;
    let daysAdded = 0;

    while (workingDaysAdded < 7) {
        daysAdded++;
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + daysAdded);
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            workingDaysAdded++;
        }
    }

    const deliveryStart = new Date(startDate);
    deliveryStart.setDate(startDate.getDate() + daysAdded);

    const deliveryEnd = new Date(deliveryStart);
    deliveryEnd.setDate(deliveryStart.getDate() + 3);

    return { deliveryStart, deliveryEnd };
};

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
        // [FIX M2] 'deliveryPrice' et 'discountAmount' envoyés par le client
        // ne sont plus utilisés non plus : seuls 'deliveryType' (le nom du
        // type choisi) et 'couponApplied' (le code) servent d'entrée, tout
        // le reste est recalculé côté serveur ci-dessous.
        let { userId, items, address, deliveryType, couponApplied } = req.body;

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
        // comme le fait déjà placeOrderCOD.
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

        // Sous-total des articles, avant livraison et remise.
        const itemsSubtotal = amount;

        // ============================================================
        // [FIX M2] Recalcul des frais de livraison côté serveur.
        // On ignore 'deliveryPrice' envoyé par le client : seul le nom
        // du type de livraison choisi ('deliveryType') sert d'entrée,
        // le tarif réel est retrouvé en base à partir de la commune de
        // l'adresse — même logique de fallback ville/commune que
        // deliveryController.getDeliveryPrice.
        // ============================================================
        let deliveryPrice = 0;
        if (deliveryType) {
            const deliveryTypeDoc = await DeliveryType.findOne({ name: deliveryType, isActive: true });
            if (deliveryTypeDoc && completeAddress.communeId) {
                let priceDoc = await DeliveryPrice.findOne({
                    communeId: completeAddress.communeId,
                    deliveryTypeId: deliveryTypeDoc._id,
                    isActive: true
                });

                if (!priceDoc) {
                    const commune = await Commune.findById(completeAddress.communeId);
                    if (commune) {
                        priceDoc = await DeliveryPrice.findOne({
                            cityId: commune.cityId,
                            communeId: null,
                            deliveryTypeId: deliveryTypeDoc._id,
                            isActive: true
                        });
                    }
                }

                if (priceDoc) {
                    deliveryPrice = priceDoc.price;
                }
                // Si aucun tarif n'est trouvé, deliveryPrice reste à 0 plutôt
                // que de bloquer la commande — comportement aligné sur
                // getDeliveryPrice qui renvoie price: null dans ce cas.
            }
        }

        // ============================================================
        // [FIX M2] Revalidation et recalcul de la remise coupon côté
        // serveur. On ignore 'discountAmount' envoyé par le client : seul
        // le code ('couponApplied') sert d'entrée, la remise réelle est
        // recalculée ici avec la même logique de validité/montant minimum
        // que couponController.validateCoupon, puis coupon.calculateDiscount().
        // Voir la note ci-dessous sur canUserUse().
        // ============================================================
        let discountAmount = 0;
        if (couponApplied) {
            const coupon = await Coupon.findOne({ code: String(couponApplied).toUpperCase() });
            if (!coupon) {
                return res.json({ success: false, message: "Code promo invalide" });
            }
            if (!coupon.isValid()) {
                return res.json({ success: false, message: "Code promo expiré ou désactivé" });
            }
            if (itemsSubtotal < coupon.minPurchase) {
                return res.json({ success: false, message: `Montant minimum d'achat: ${coupon.minPurchase} FCFA` });
            }
            // Note : on n'appelle pas coupon.canUserUse(userId) ici, car
            // POST /api/coupon/apply (appelé par le frontend juste avant
            // cette requête) a déjà incrémenté usedCount/usedBy pour cette
            // commande légitime — rappeler canUserUse() à ce stade
            // bloquerait à tort un utilisateur dont usagePerUser vaut 1.
            // La vérification d'éligibilité d'usage a donc déjà eu lieu à
            // l'étape /apply ; ici on se contente de revalider que le
            // coupon est toujours actif et la condition de montant minimum,
            // et de recalculer la remise depuis la base (jamais depuis la
            // valeur envoyée par le client).
            discountAmount = coupon.calculateDiscount(itemsSubtotal);
        }

        amount = itemsSubtotal + deliveryPrice - discountAmount;

        const finalAmount = Math.round(amount);
        if (finalAmount < 200) {
            return res.json({ success: false, message: "Le montant minimum est de 200 FCFA" });
        }

        // Créer la commande en base
        const order = await Order.create({
            userId,
            items: formattedItems,
            amount: finalAmount,
            // [FIX] Détail du calcul sauvegardé sur la commande, pour que
            // MyOrders.jsx et le reçu PDF puissent afficher la livraison et
            // le coupon réellement appliqués (valeurs déjà recalculées et
            // revalidées côté serveur ci-dessus, jamais celles du client).
            deliveryPrice,
            discountAmount,
            couponApplied: couponApplied ? String(couponApplied).toUpperCase() : null,
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
            // [FIX] Revérification best-effort auprès de l'API GeniusPay.
            //
            // ⚠️ L'endpoint exact pour relire une transaction GeniusPay
            // (GET /payments/:reference) n'est pas confirmé par la
            // documentation webhook fournie — c'était une hypothèse de
            // défense en profondeur. En pratique cet appel renvoie 404
            // (endpoint introuvable), ce qui bloquait à tort des paiements
            // réellement confirmés par signature.
            //
            // Tant que le bon endpoint n'est pas confirmé auprès du support
            // GeniusPay (support@genius.ci) ou de leur doc API, cette
            // vérification est best-effort : un échec d'appel (404, réseau,
            // timeout) est loggé mais NE bloque PAS la confirmation, car la
            // protection principale contre la fraude est déjà la signature
            // HMAC vérifiée plus haut (verifyGeniusPaySignature), qui prouve
            // que ce payload provient bien de GeniusPay. Seul un montant
            // explicitement confirmé et incohérent bloque la commande.
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

                    if (remoteStatus && remoteStatus !== 'success' && remoteStatus !== 'completed') {
                        console.error(`❌ Statut GeniusPay distant non confirmé pour ${reference}: ${remoteStatus}`);
                        return res.status(400).json({ error: "Payment not confirmed by provider" });
                    }
                    if (typeof remoteAmount === 'number' && remoteAmount !== order.amount) {
                        console.error(`❌ Montant GeniusPay distant (${remoteAmount}) ≠ montant commande (${order.amount}) pour ${reference}`);
                        return res.status(400).json({ error: "Amount mismatch" });
                    }
                } catch (verifyError) {
                    // Best-effort : on logue mais on NE bloque PAS la confirmation.
                    // La protection principale anti-fraude reste la signature HMAC
                    // déjà vérifiée plus haut. Un 404 ici signifie très probablement
                    // que l'endpoint /payments/:reference n'est pas le bon chemin
                    // GeniusPay — à confirmer avec leur support avant de durcir
                    // à nouveau cette vérification.
                    console.warn(`⚠️ Revérification GeniusPay impossible pour ${reference} (${verifyError.response?.status || verifyError.message}) — confirmation poursuivie sur la base de la signature HMAC déjà validée.`);
                }
            }

            // 3. Marquer la commande comme payée
            // ✅ Calculer les dates de livraison estimées au moment de la
            // confirmation du paiement (et non à l'initiation), puisque
            // c'est seulement maintenant qu'on sait que la commande est
            // réellement passée.
            const { deliveryStart, deliveryEnd } = calculateEstimatedDeliveryDates(new Date());

            order.isPaid = true;
            order.status = "Confirmed";
            order.estimatedDeliveryStart = deliveryStart;
            order.estimatedDeliveryEnd = deliveryEnd;
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
                        // [FIX] inStock n'était jamais recalculé ici : le stock
                        // baissait bien, mais le produit continuait d'apparaître
                        // "en stock" côté boutique tant que personne n'allait le
                        // resauvegarder manuellement dans le panneau admin.
                        product.inStock = product.variants.some(v => v.stock > 0);
                        await product.save();
                    } else {
                        console.warn(`⚠️ Variant (${item.color}/${item.size}) non trouvé pour produit ${product.name}`);
                    }
                } else {
                    product.stock = Math.max(0, (product.stock || 0) - item.quantity);
                    // [FIX] Même correctif pour les produits sans variantes.
                    product.inStock = product.stock > 0;
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
                        order.amount,
                        deliveryStart,
                        deliveryEnd
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