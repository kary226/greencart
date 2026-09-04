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
import ColisShein from '../models/ColisShein.js';
import MessageColis from '../models/MessageColis.js';
import { posterMessageStatutAuto } from './colisSheinAdminController.js';
import { crediterClient, debiterClient, rembourserCreditAnnulation } from '../models/CustomerCredit.js';
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';
// [MIGRATION GUICHET UNIQUE] le webhook de paiement est justement l'endroit
// le plus sensible à laisser hors du contrôle central : il touche à
// l'argent réel et déclenche la commande sans aucun humain dans la boucle.
import { transitionner } from '../services/orderWorkflowService.js';

// Même fenêtre que côté GeniusPay historiquement — 5 minutes.
const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

const OPERATEURS_VALIDES = ["orange", "wave", "mtn", "moov", "djamo"];

// Fonction pour calculer les dates de livraison estimées (7 jours ouvrés).
// Démarre à la date de confirmation du paiement (pas d'initiation), car une
// commande "pending_payment" peut être abandonnée et ne jamais aboutir.
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

// Récupère le corps brut de la requête pour la vérification HMAC — plusieurs
// cas selon l'environnement (Vercel donne déjà un Buffer via express.raw()
// normalement, ce helper couvre aussi les cas où ce ne serait pas le cas).
export function getRawBody(req) {
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
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => resolve(data));
    });
}

// ============================================================================
// Confirmation d'une commande payée — marquer payé, décrémenter le stock,
// vider le panier, envoyer les emails. L'idempotence est gérée ICI, de façon
// atomique (findOneAndUpdate conditionnel) : un simple `if (order.isPaid)`
// lu puis écrit plus tard laisse une fenêtre où deux webhooks quasi
// simultanés (retry Jèko, livraison en double) peuvent tous les deux lire
// "pas encore payé" avant qu'aucun n'ait fini d'écrire.
// Retourne false si une autre requête a déjà traité cette commande.
// ============================================================================
export const confirmerCommandePayee = async (order, { reference, providerField } = {}) => {
    const { deliveryStart, deliveryEnd } = calculateEstimatedDeliveryDates(new Date());

    const update = {
        isPaid: true,
        status: "Checking Availability",
        estimatedDeliveryStart: deliveryStart,
        estimatedDeliveryEnd: deliveryEnd,
    };
    if (reference && providerField) {
        update[providerField] = reference;
    }

    const updated = await Order.findOneAndUpdate(
        { _id: order._id, isPaid: { $ne: true } },
        { $set: update },
        { new: true }
    );

    if (!updated) {
        console.log(`ℹ️ Commande ${order._id} déjà confirmée par une autre requête (webhook en double), ignorer`);
        return false;
    }
    order = updated;
    // Une commande composée uniquement du catalogue principal n'a aucun
    // commerçant à attendre : elle peut passer directement à Confirmed.
    if (!(order.items || []).some(item => item.boutiqueId)) {
        // Transition système déclenchée par le webhook Jèko — pas d'acteur
        // humain, donc pas de contrôle de droits, mais on garde la même
        // vérification de logique de transition et la même trace que
        // partout ailleurs.
        const transition = transitionner({ order, vers: 'Confirmed', acteur: null, note: 'paiement confirmé par Jèko (webhook)' });
        if (!transition.ok) {
            console.error(`⚠️ Transition refusée pour la commande ${order._id} après paiement Jèko : ${transition.message}`);
        }
        order.confirmedAt = new Date();
        await order.save();
    }
    console.log(`✅ Commande ${order._id} marquée comme payée`);

    const ProductModel = mongoose.model('product');
    const productIds = [...new Set(order.items.map(item => item.product.toString()))];
    const products = await ProductModel.find({ _id: { $in: productIds } });
    const productsById = new Map(products.map(p => [p._id.toString(), p]));
    const bulkOps = [];

    for (const item of order.items) {
        const product = productsById.get(item.product.toString());
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
                const inStock = product.variants.some(v => v.stock > 0);
                bulkOps.push({
                    updateOne: {
                        filter: { _id: product._id, 'variants._id': variant._id },
                        update: { $set: { 'variants.$.stock': variant.stock, inStock } }
                    }
                });
            } else {
                console.warn(`⚠️ Variant (${item.color}/${item.size}) non trouvé pour produit ${product.name}`);
            }
        } else {
            const newStock = Math.max(0, (product.stock || 0) - item.quantity);
            product.stock = newStock;
            bulkOps.push({
                updateOne: {
                    filter: { _id: product._id },
                    update: { $set: { stock: newStock, inStock: newStock > 0 } }
                }
            });
        }
    }

    if (bulkOps.length > 0) {
        await ProductModel.bulkWrite(bulkOps);
    }

    if (order.userId) {
        await User.findByIdAndUpdate(order.userId, { cartItems: {} });
        console.log(`🗑️ Panier vidé pour l'utilisateur ${order.userId}`);
    }

    const user = await User.findById(order.userId);
    const Address = mongoose.model('address');
    const address = await Address.findById(order.address);

    if (user && user.email && address) {
        try {
            await sendOrderConfirmationEmail(user.email, order._id.toString(), order.amount, deliveryStart, deliveryEnd);
            await sendAdminNotificationEmail(order._id.toString(), order.amount, `${address.firstName} ${address.lastName}`, user.email);
        } catch (emailError) {
            console.error("❌ Erreur envoi emails:", emailError);
        }
    } else {
        console.warn("⚠️ Impossible d'envoyer les emails: utilisateur ou adresse manquant");
    }

    console.log(`✅ Commande ${order._id} finalisée avec succès`);
    return true;
};

// ============================================================================
// Intégration Jèko — initiation ET webhook écrits contre leur doc technique
// officielle (POST /partner_api/payment_requests, type "redirect") et contre
// les infos confirmées de ton compte (header Jeko-Signature, HMAC-SHA256).
//
// Seul point encore incertain : les noms de champs exacts du PAYLOAD du
// webhook (status/reference/amount) sont déduits par analogie avec le schéma
// de réponse de création, pas confirmés sur un vrai webhook reçu. Le premier
// paiement de test réel loggera la LISTE DES CHAMPS reçus (`champsRecus`,
// voir handleJekoWebhook — les valeurs ne sont plus loggées, elles
// contenaient des données clients) : si la commande n'est pas marquée payée
// après un paiement réussi, regarder ce log en premier.
// ============================================================================

// Initier un paiement Jèko (mode redirection, opérateur choisi côté RAMCI)
export const initiateJeko = async (req, res) => {
    // [DEBUG PERF - TEMPORAIRE] Même instrumentation que GeniusPay, utile
    // pour mesurer où passe le temps le jour où l'intégration réelle sera
    // branchée. À retirer une fois l'intégration stabilisée.
    const __t0 = Date.now();
    const __lap = (label) => console.log(`⏱️ [Jeko init] ${label}: ${Date.now() - __t0}ms`);

    // Déclarés ici (et non avec `const` dans le try) pour rester accessibles
    // dans le catch : si l'appel à l'API Jèko lève une exception après que
    // la commande a été créée et les RCOINS débités, on doit pouvoir
    // rembourser ce crédit plutôt que le perdre silencieusement.
    let order = null;
    let creditUtilise = 0;

    try {
        let { userId, items, address, deliveryType, couponApplied, jekoPaymentMethod, useCredit } = req.body;

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
            if (product.isArchived) {
                return res.json({ success: false, message: `"${product.name}" n'est plus disponible à la vente` });
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
                // Instantané — voir Order.js pour le raisonnement.
                name: product.name,
                image: product.image?.[0] || null,
                sku: product.sku || null,
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
        order = await Order.create({
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

        // RCOINS — le client peut demander à utiliser tout ou partie de son
        // solde pour réduire le montant réellement facturé en ligne via Jèko.
        // Débité maintenant (plafonné au solde réel en base par
        // debiterClient) pour que amountFactureJeko reflète le vrai montant
        // à encaisser. Si l'appel Jèko échoue juste après (pas d'URL de
        // paiement), on rembourse ce crédit — voir plus bas.
        creditUtilise = 0;
        const creditDemande = Math.max(0, Math.min(Math.floor(Number(useCredit) || 0), finalAmount - 200));
        if (creditDemande > 0) {
            creditUtilise = await debiterClient({
                userId,
                orderId: order._id,
                itemId: new mongoose.Types.ObjectId(),
                amount: creditDemande,
                description: `Utilisation RCOINS — commande ${order._id}`
            });
            if (creditUtilise > 0) {
                order.amount = finalAmount - creditUtilise;
                order.creditUsed = creditUtilise;
                await order.save();
            }
        }
        const amountFactureJeko = finalAmount - creditUtilise;

        // Formater le téléphone au format international. [À CONFIRMER] Format
        // [VÉRIFIÉ] Le téléphone n'est pas requis par le schéma
        // "paymentDetails.data" de POST /partner_api/payment_requests —
        // contrairement à GeniusPay, Jèko ne le demande pas à ce niveau.

        // "reference" identifie la commande dans le webhook plus tard — on met
        // l'ID Mongo complet plutôt qu'un extrait, pour ne jamais avoir
        // d'ambiguïté entre deux commandes lors de la recherche par référence.
        const jekoPayload = {
            amountCents: Math.round(amountFactureJeko * 100),
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
            if (creditUtilise > 0) {
                // La commande n'ira jamais au paiement — on rend les RCOINS
                // débités plus haut, sinon ils seraient perdus pour le client.
                await crediterClient({
                    userId,
                    orderId: order._id,
                    itemId: new mongoose.Types.ObjectId(),
                    amount: creditUtilise,
                    description: `Remboursement RCOINS — échec initiation paiement (commande ${order._id})`
                });
            }
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
        if (order && creditUtilise > 0) {
            try {
                await crediterClient({
                    userId: order.userId,
                    orderId: order._id,
                    itemId: new mongoose.Types.ObjectId(),
                    amount: creditUtilise,
                    description: `Remboursement RCOINS — erreur initiation paiement (commande ${order._id})`
                });
            } catch (refundError) {
                console.error("❌ Échec remboursement RCOINS après erreur Jèko:", refundError);
            }
        }
        res.json({ success: false, message: error.response?.data?.message || "Erreur lors de l'initialisation du paiement" });
    }
};

// ============================================================================
// Paiement Jèko pour un colis Shein (acompte ou solde) — remplace payAcompte
// / paySolde de sheinCartController.js, qui appelaient GeniusPay directement.
// Même schéma vérifié que initiateJeko ci-dessus. "type" distingue acompte
// et solde : encodé dans "reference" (`${colisId}:${type}`) puisque Jèko n'a
// pas de champ metadata libre comme GeniusPay — c'est ce que le webhook
// relit pour savoir quoi confirmer.
// ============================================================================
export const initiateJekoColis = async (req, res, type) => {
    try {
        const { jekoPaymentMethod } = req.body;
        if (!OPERATEURS_VALIDES.includes(jekoPaymentMethod)) {
            return res.json({ success: false, message: "Opérateur de paiement invalide" });
        }

        const colis = await ColisShein.findOne({ _id: req.params.id, userId: req.body.userId });
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        const dejaPayeChamp = type === "acompte" ? colis.paiement.acomptePaye : colis.paiement.soldePaye;
        if (dejaPayeChamp) {
            return res.status(400).json({ success: false, message: `${type === "acompte" ? "Acompte" : "Solde"} déjà payé` });
        }

        const montantSource = type === "acompte" ? colis.devis?.montantInitial : colis.paiement?.soldeMontant;
        if (!montantSource || montantSource <= 0) {
            return res.status(400).json({
                success: false,
                message: type === "acompte"
                    ? "Le devis n'a pas encore de montant d'acompte défini"
                    : "Le solde n'a pas encore été calculé (en attente de pesée)",
            });
        }

        const finalAmount = Math.round(montantSource);

        const jekoPayload = {
            amountCents: finalAmount * 100,
            currency: "XOF",
            reference: `${colis._id.toString()}:${type}`,
            storeId: process.env.JEKO_STORE_ID,
            paymentDetails: {
                type: "redirect",
                data: {
                    paymentMethod: jekoPaymentMethod,
                    successUrl: `${process.env.FRONTEND_URL}/colis-shein/${colis._id}?paiement=succes`,
                    errorUrl: `${process.env.FRONTEND_URL}/colis-shein/${colis._id}?paiement=erreur`,
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
        if (!checkoutUrl) {
            console.error("Réponse Jèko sans redirectUrl (colis):", JSON.stringify(response.data));
            return res.json({ success: false, message: "Réponse Jèko invalide — pas d'URL de paiement" });
        }

        res.json({ success: true, checkout_url: checkoutUrl });
    } catch (error) {
        console.error(`Erreur Jèko (colis, ${type}):`, error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data));
        }
        res.status(500).json({ success: false, message: error.response?.data?.message || "Erreur lors de l'initialisation du paiement" });
    }
};

export const initiateJekoAcompte = (req, res) => initiateJekoColis(req, res, "acompte");
export const initiateJekoSolde = (req, res) => initiateJekoColis(req, res, "solde");

// ============================================================================
// Webhook Jèko — traite deux types de références : une commande classique
// (reference = son ID Mongo tel quel) ou un paiement colis Shein (reference
// = "${colisId}:acompte" ou "${colisId}:solde", voir initiateJekoColis).
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
    if (!signature || typeof signature !== 'string') {
        console.error("❌ Header Jeko-Signature manquant ou invalide");
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

        // [SÉCURITÉ] Résumé expurgé, plus le payload brut intégral.
        //
        // Le log complet contenait des données de transaction et de clients
        // (téléphone, opérateur, montants), recopiées telles quelles dans
        // les logs Vercel — lisibles par quiconque a accès au tableau de
        // bord, conservées bien au-delà de leur utilité, et hors de portée
        // d'une demande de suppression de données personnelles.
        //
        // On garde exactement ce qui sert à diagnostiquer : le statut, la
        // référence de commande et l'identifiant de transaction, qui
        // permettent de retrouver la trace complète côté Jèko en cas de
        // besoin. Les CLÉS du payload restent loggées (sans les valeurs) :
        // c'était l'autre utilité du log brut, confirmer les noms de champs.
        console.log("=== WEBHOOK JÈKO REÇU (signature vérifiée) ===");
        console.log(JSON.stringify({
            champsRecus: Object.keys(payload),
            status: payload.status ?? payload.data?.status ?? null,
            reference: payload.transactionDetails?.reference ?? payload.reference ?? payload.data?.reference ?? null,
            transactionId: payload.id ?? payload.data?.id ?? null,
        }));

        // Anti-rejeu — contrairement à GeniusPay (header X-Webhook-Timestamp
        // dédié), Jèko ne fournit qu'un header de signature, sans horodatage
        // séparé. La signature seule ne périme jamais : quelqu'un qui
        // capturerait un ancien webhook valide (logs compromis, etc.)
        // pourrait le rejouer indéfiniment. On se rabat donc sur le
        // timestamp présent DANS le payload signé lui-même (executedAt),
        // avec la même fenêtre de 5 minutes que côté GeniusPay.
        const executedAt = payload.executedAt || payload.data?.executedAt;
        if (executedAt) {
            const ageMs = Date.now() - new Date(executedAt).getTime();
            if (!Number.isFinite(ageMs) || Math.abs(ageMs) > WEBHOOK_MAX_AGE_MS) {
                console.error(`❌ Webhook Jèko hors fenêtre acceptable (executedAt=${executedAt})`);
                return res.status(401).json({ error: "Timestamp too old" });
            }
        } else {
            // Pas bloquant : le nom exact du champ n'est pas garanti (voir
            // `champsRecus` dans le log ci-dessus) — mieux vaut traiter un
            // webhook légitime sans protection anti-rejeu à 100% que d'en
            // rejeter un valide sur un nom de champ mal deviné. À resserrer
            // une fois le vrai payload confirmé.
            console.warn("⚠️ Pas de timestamp exploitable dans le webhook Jèko — anti-rejeu non appliqué pour cette requête");
        }

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
            console.error("❌ Référence introuvable dans le webhook Jèko — voir `champsRecus` dans le log ci-dessus pour ajuster le nom du champ");
            return res.status(200).json({ received: true }); // 200 quand même : ce n'est pas Jèko qui a un problème, c'est notre parsing
        }

        // Une référence colis Shein contient ":acompte" ou ":solde" (voir
        // initiateJekoColis) ; une référence de commande classique est un ID
        // Mongo brut, sans ":".
        const [refId, refType] = reference.split(':');
        const estColisShein = refType === 'acompte' || refType === 'solde';

        if (estColisShein) {
            const colis = await ColisShein.findById(refId);
            if (!colis) {
                console.error(`❌ Colis ${refId} non trouvé (webhook Jèko)`);
                return res.status(404).json({ error: "Colis not found" });
            }

            const champPaye = refType === 'acompte' ? 'paiement.acomptePaye' : 'paiement.soldePaye';
            const champDate = refType === 'acompte' ? 'paiement.acompteDate' : 'paiement.soldeDate';
            const nouveauStatut = refType === 'acompte' ? 'acompte_paye' : 'solde_paye';
            const montantAttendu = refType === 'acompte' ? colis.devis?.montantInitial : colis.paiement?.soldeMontant;

            if (STATUTS_ECHEC.includes(status)) {
                console.log(`❌ Paiement Jèko échoué pour le colis ${colis.numeroSuivi} (${refType}, statut: ${status})`);
                return res.status(200).json({ received: true });
            }
            if (!STATUTS_SUCCES.includes(status)) {
                console.log(`ℹ️ Statut Jèko non traité pour le colis ${colis.numeroSuivi} (${refType}): ${status}`);
                return res.status(200).json({ received: true });
            }
            if (typeof remoteAmountCents === 'number' && montantAttendu && remoteAmountCents !== Math.round(montantAttendu * 100)) {
                console.error(`❌ Montant Jèko (${remoteAmountCents} cents) ≠ montant attendu (${montantAttendu} XOF) pour colis ${colis.numeroSuivi}`);
                return res.status(400).json({ error: "Amount mismatch" });
            }

            // Même principe atomique que confirmerCommandePayee : le filtre
            // `[champPaye]: { $ne: true }` garantit qu'une seule requête
            // concurrente peut faire matcher et modifier ce document.
            const colisMisAJour = await ColisShein.findOneAndUpdate(
                { _id: colis._id, [champPaye]: { $ne: true } },
                {
                    $set: { [champPaye]: true, [champDate]: new Date(), 'paiement.methode': 'jeko', statut: nouveauStatut },
                    $push: { historique: { action: nouveauStatut, note: `${refType === 'acompte' ? 'Acompte' : 'Solde'} réglé via Jèko (réf. ${jekoTransactionId})` } },
                },
                { new: true }
            );

            if (!colisMisAJour) {
                console.log(`ℹ️ ${refType === 'acompte' ? 'Acompte' : 'Solde'} du colis ${colis.numeroSuivi} déjà confirmé par une autre requête, ignorer`);
                return res.status(200).json({ received: true, alreadyProcessed: true });
            }

            const texteConfirmation = refType === 'acompte' ? "✓ Paiement des articles confirmé" : "✓ Paiement de la livraison confirmé";
            await MessageColis.create({ colisId: colisMisAJour._id, expediteurRole: "systeme", type: "systeme", texte: texteConfirmation });
            await posterMessageStatutAuto(colisMisAJour, nouveauStatut);

            console.log(`✅ ${refType === 'acompte' ? "Acompte" : "Solde"} confirmé pour le colis ${colis.numeroSuivi}`);
            return res.status(200).json({ received: true });
        }

        // --- Commande classique ---
        const order = await Order.findById(refId);
        if (!order) {
            console.error(`❌ Commande ${refId} non trouvée (webhook Jèko)`);
            return res.status(404).json({ error: "Order not found" });
        }

        // Raccourci rapide — PAS la vraie protection contre les webhooks
        // concurrents, celle-ci est dans confirmerCommandePayee
        // (findOneAndUpdate atomique).
        if (order.isPaid && order.status === "Confirmed") {
            console.log(`ℹ️ Commande ${refId} déjà confirmée, ignorer`);
            return res.status(200).json({ received: true, alreadyProcessed: true });
        }

        if (STATUTS_ECHEC.includes(status)) {
            console.log(`❌ Paiement Jèko échoué pour la commande ${refId} (statut: ${status})`);
            // La commande n'ira pas plus loin : on la marque annulée et on
            // rembourse les RCOINS éventuellement débités à l'initiation
            // (voir initiateJeko). rembourserCreditAnnulation est protégée
            // par creditRefundedAt contre un double remboursement si le
            // client avait aussi appelé POST /order/cancel entre-temps.
            await Order.findOneAndUpdate(
                { _id: order._id, status: 'pending_payment' },
                { $set: { status: 'Cancelled' } }
            );
            if (order.creditUsed > 0) {
                await rembourserCreditAnnulation({
                    orderId: order._id,
                    userId: order.userId,
                    description: `Remboursement RCOINS — paiement Jèko échoué (commande ${order._id})`
                });
            }
            return res.status(200).json({ received: true });
        }

        if (!STATUTS_SUCCES.includes(status)) {
            console.log(`ℹ️ Statut Jèko non traité pour la commande ${refId}: ${status}`);
            return res.status(200).json({ received: true });
        }

        // Vérification du montant — amountCents = montant XOF × 100 (voir
        // initiateJeko), donc on compare à order.amount × 100.
        if (typeof remoteAmountCents === 'number' && remoteAmountCents !== Math.round(order.amount * 100)) {
            console.error(`❌ Montant Jèko (${remoteAmountCents} cents) ≠ montant commande (${order.amount} XOF) pour ${refId}`);
            return res.status(400).json({ error: "Amount mismatch" });
        }

        const traite = await confirmerCommandePayee(order, { reference: jekoTransactionId, providerField: 'jeko_reference' });
        if (!traite) {
            return res.status(200).json({ received: true, alreadyProcessed: true });
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("❌ Erreur traitement webhook Jèko:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};