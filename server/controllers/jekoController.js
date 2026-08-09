import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import DeliveryPrice from '../models/DeliveryPrice.js';
import DeliveryType from '../models/DeliveryType.js';
import Commune from '../models/Commune.js';
import { confirmerCommandePayee, getRawBody } from './geniuspayController.js';

// ============================================================================
// Intégration Jèko — initiation ET webhook écrits contre leur doc technique
// officielle (POST /partner_api/payment_requests, type "redirect") et contre
// les infos confirmées de ton compte (header Jeko-Signature, HMAC-SHA256).
//
// Seul point encore incertain : les noms de champs exacts du PAYLOAD du
// webhook (status/reference/amount) sont déduits par analogie avec le schéma
// de réponse de création, pas confirmés sur un vrai webhook reçu. Le premier
// paiement de test réel loggera le payload brut complet (voir
// handleJekoWebhook) — si la commande n'est pas marquée payée après un
// paiement réussi, regarder ce log en premier.
// ============================================================================

// Initier un paiement Jèko (mode redirection, opérateur choisi côté RAMCI)
export const initiateJeko = async (req, res) => {
    // [DEBUG PERF - TEMPORAIRE] Même instrumentation que GeniusPay, utile
    // pour mesurer où passe le temps le jour où l'intégration réelle sera
    // branchée. À retirer une fois l'intégration stabilisée.
    const __t0 = Date.now();
    const __lap = (label) => console.log(`⏱️ [Jeko init] ${label}: ${Date.now() - __t0}ms`);

    try {
        let { userId, items, address, deliveryType, couponApplied, jekoPaymentMethod } = req.body;

        const OPERATEURS_VALIDES = ["orange", "wave", "mtn", "moov", "djamo"];
        if (!OPERATEURS_VALIDES.includes(jekoPaymentMethod)) {
            return res.json({ success: false, message: "Opérateur de paiement invalide" });
        }

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

        __lap("adresse résolue");

        // ============================================================
        // [FIX C2] Recalcul intégral du montant et des prix unitaires
        // côté serveur, à partir de la base de données — exactement
        // comme le fait déjà placeOrderCOD.
        // On ne fait JAMAIS confiance à un prix ou un montant envoyé
        // par le client.
        // ============================================================
        let amount = 0;
        const formattedItems = [];

        // [PHASE 0 - PERF] Avant : un Product.findById PAR article du panier,
        // en série (chemin le plus critique du site : le paiement). Un seul
        // Product.find({$in}) charge tous les produits d'un coup, puis on
        // fait correspondre chaque item en mémoire ci-dessous.
        const productIds = [...new Set(items.map(item => item.product))];
        const products = await Product.find({ _id: { $in: productIds } });
        const productsById = new Map(products.map(p => [p._id.toString(), p]));

        for (const item of items) {
            const product = productsById.get(item.product.toString());
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
                priceAtOrder,
                // boutiqueId requis par le schéma Order (voir placeOrderCOD,
                // qui le renseigne déjà) — nécessaire aussi pour le scope
                // des coupons commerçant ci-dessous.
                boutiqueId: product.boutiqueId || null,
            });
        }

        // Sous-total des articles, avant livraison et remise.
        const itemsSubtotal = amount;

        __lap("produits chargés + sous-total calculé");

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

        __lap("livraison calculée");

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
            // Un coupon commerçant (boutiqueId renseigné) ne remise que les
            // articles de sa boutique dans le panier — même logique que
            // placeOrderCOD. Un coupon admin garde le comportement inchangé.
            let baseAmount = itemsSubtotal;
            if (coupon.boutiqueId) {
                baseAmount = formattedItems
                    .filter(it => it.boutiqueId && it.boutiqueId.toString() === coupon.boutiqueId.toString())
                    .filter(it => coupon.eligibleProducts.length === 0 || coupon.eligibleProducts.some(p => p.toString() === it.product.toString()))
                    .reduce((sum, it) => sum + it.priceAtOrder * it.quantity, 0);
            }
            if (baseAmount < coupon.minPurchase) {
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
            discountAmount = coupon.calculateDiscount(baseAmount);
        }

        __lap("coupon calculé");

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
            paymentType: "Jeko",
            status: "pending_payment",
        });

        __lap("commande créée en base (Order.create)");

        // Formater le téléphone au format international. [À CONFIRMER] Format
        // [VÉRIFIÉ] Le téléphone n'est pas requis par le schéma
        // "paymentDetails.data" de POST /partner_api/payment_requests —
        // contrairement à GeniusPay, Jèko ne le demande pas à ce niveau.

        // "reference" identifie la commande dans le webhook plus tard — on met
        // l'ID Mongo complet plutôt qu'un extrait, pour ne jamais avoir
        // d'ambiguïté entre deux commandes lors de la recherche par référence.
        const jekoPayload = {
            amountCents: Math.round(finalAmount * 100),
            currency: "XOF",
            reference: order._id.toString(),
            storeId: process.env.JEKO_STORE_ID,
            paymentDetails: {
                type: "redirect",
                data: {
                    paymentMethod: jekoPaymentMethod,
                    successUrl: `${process.env.FRONTEND_URL}/payment/success?orderId=${order._id}`,
                    errorUrl: `${process.env.FRONTEND_URL}/payment/error?orderId=${order._id}`,
                },
            },
        };

        const response = await axios.post(
            `${process.env.JEKO_BASE_URL || 'https://api.jeko.africa'}/partner_api/payment_requests`,
            jekoPayload,
            {
                headers: {
                    'X-API-KEY': process.env.JEKO_API_KEY,
                    'X-API-KEY-ID': process.env.JEKO_API_KEY_ID,
                    'Content-Type': 'application/json',
                },
            }
        );

        const checkoutUrl = response.data?.redirectUrl;
        const jekoRequestId = response.data?.id;

        if (!checkoutUrl) {
            await Order.findByIdAndDelete(order._id);
            console.error("Réponse Jèko sans redirectUrl:", JSON.stringify(response.data));
            return res.json({ success: false, message: "Réponse Jèko invalide — pas d'URL de paiement" });
        }

        await Order.findByIdAndUpdate(order._id, { jeko_reference: jekoRequestId });

        return res.json({ success: true, checkout_url: checkoutUrl, orderId: order._id });

    } catch (error) {
        console.error("Erreur Jèko:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data));
        }
        res.json({ success: false, message: error.response?.data?.message || "Erreur lors de l'initialisation du paiement" });
    }
};

// ============================================================================
// [SQUELETTE — WEBHOOK NON IMPLÉMENTÉ]
// À écrire une fois le format exact du webhook Jèko confirmé (structure du
// payload, header de signature, algorithme — HMAC-SHA256 mentionné dans leur
// doc mais sans détail exploitable au moment de l'écriture de ce fichier).
// Voir handleGeniusPayWebhook dans geniuspayController.js pour le pattern à
// suivre : vérification de signature avant tout traitement, idempotence
// (ignorer un webhook déjà traité), mise à jour du statut de la commande.
// ============================================================================
export const handleJekoWebhook = async (req, res) => {
    const rawBody = await getRawBody(req);

    // Vérification de signature — header et algorithme confirmés directement
    // sur ton compte Jèko (Réglages > API & Webhooks : "Jèko signe chaque
    // webhook avec HMAC-SHA256. Vérifiez le header Jeko-Signature").
    const secret = process.env.JEKO_WEBHOOK_SECRET;
    if (!secret) {
        console.error("❌ JEKO_WEBHOOK_SECRET non configuré — webhook rejeté par défaut (fail-closed)");
        return res.status(401).json({ error: "Webhook secret not configured" });
    }

    const signature = req.headers['jeko-signature'];
    if (!signature) {
        console.error("❌ Header Jeko-Signature manquant");
        return res.status(401).json({ error: "Missing signature" });
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        console.error("❌ Signature Jèko invalide");
        return res.status(401).json({ error: "Invalid signature" });
    }

    try {
        const payload = JSON.parse(rawBody);

        // [PREMIER PASSAGE] Log complet du payload brut — à garder au moins
        // jusqu'au premier vrai paiement de test, pour confirmer/corriger
        // les noms de champs ci-dessous en un coup d'œil sur les logs Vercel.
        console.log("=== WEBHOOK JÈKO REÇU (signature vérifiée) ===");
        console.log(JSON.stringify(payload));

        // [À CONFIRMER sur le premier vrai webhook] Noms de champs déduits du
        // schéma de réponse de POST /partner_api/payment_requests (déjà
        // vérifié), en supposant que le webhook envoie un objet transaction
        // de forme proche. reference = l'ID de commande Mongo (voir
        // initiateJeko, qui l'envoie tel quel comme "reference").
        const status = payload.status || payload.data?.status;
        const reference = payload.transactionDetails?.reference || payload.reference || payload.data?.reference;
        const remoteAmountCents = payload.amount?.amount ?? payload.data?.amount?.amount;
        const jekoTransactionId = payload.id || payload.data?.id;

        const STATUTS_SUCCES = ['success', 'successful', 'completed', 'paid'];
        const STATUTS_ECHEC = ['failed', 'error', 'cancelled', 'expired'];

        if (!reference) {
            console.error("❌ Référence de commande introuvable dans le webhook Jèko — voir le payload brut loggé ci-dessus pour ajuster le nom du champ");
            return res.status(200).json({ received: true }); // 200 quand même : ce n'est pas Jèko qui a un problème, c'est notre parsing
        }

        const order = await Order.findById(reference);
        if (!order) {
            console.error(`❌ Commande ${reference} non trouvée (webhook Jèko)`);
            return res.status(404).json({ error: "Order not found" });
        }

        // Idempotence — un webhook peut être renvoyé plusieurs fois
        if (order.isPaid && order.status === "Confirmed") {
            console.log(`ℹ️ Commande ${reference} déjà confirmée, ignorer`);
            return res.status(200).json({ received: true, alreadyProcessed: true });
        }

        if (STATUTS_ECHEC.includes(status)) {
            console.log(`❌ Paiement Jèko échoué pour la commande ${reference} (statut: ${status})`);
            return res.status(200).json({ received: true });
        }

        if (!STATUTS_SUCCES.includes(status)) {
            console.log(`ℹ️ Statut Jèko non traité pour la commande ${reference}: ${status}`);
            return res.status(200).json({ received: true });
        }

        // Vérification du montant — amountCents = montant XOF × 100 (voir
        // initiateJeko), donc on compare à order.amount × 100.
        if (typeof remoteAmountCents === 'number' && remoteAmountCents !== Math.round(order.amount * 100)) {
            console.error(`❌ Montant Jèko (${remoteAmountCents} cents) ≠ montant commande (${order.amount} XOF) pour ${reference}`);
            return res.status(400).json({ error: "Amount mismatch" });
        }

        await confirmerCommandePayee(order, { reference: jekoTransactionId, providerField: 'jeko_reference' });

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("❌ Erreur traitement webhook Jèko:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};