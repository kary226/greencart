import axios from 'axios';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import DeliveryPrice from '../models/DeliveryPrice.js';
import DeliveryType from '../models/DeliveryType.js';
import Commune from '../models/Commune.js';

// ============================================================================
// [SQUELETTE — INTÉGRATION JÈKO INCOMPLÈTE]
// Ce contrôleur reprend le calcul de commande éprouvé de geniuspayController.js
// (revalidation intégrale des prix/livraison/coupon côté serveur, jamais fait
// confiance au client — voir les commentaires [FIX C2]/[FIX M2] plus bas).
//
// Ce qui MANQUE encore avant que ce moyen de paiement soit réellement
// fonctionnel :
//   1. Les identifiants Jèko réels (X-API-KEY, X-API-KEY-ID, storeId) dans
//      les variables d'environnement JEKO_API_KEY / JEKO_API_KEY_ID /
//      JEKO_STORE_ID.
//   2. Le schéma exact attendu par POST /partner_api/payment_links (noms de
//      champs, format du montant/devise, structure des URLs de retour) —
//      non confirmé dans la doc publique au moment où ce fichier a été
//      écrit. Le payload ci-dessous est une estimation à vérifier.
//   3. Le endpoint et la logique de vérification de signature du webhook
//      Jèko (HMAC-SHA256 mentionné dans leur doc, détail non confirmé).
//
// Tant que ces points ne sont pas confirmés, initiateJeko renvoie une erreur
// propre côté client plutôt que d'appeler une API avec des champs devinés —
// voir le bloc JEKO_INTEGRATION_PRETE plus bas.
// Ce moyen de paiement n'apparaît de toute façon au client que si l'admin
// l'active explicitement dans Réglages > Moyens de paiement.
// ============================================================================

const JEKO_INTEGRATION_PRETE = false; // passer à true une fois les 3 points ci-dessus réglés

// Initier un paiement Jèko (mode lien de paiement / checkout)
export const initiateJeko = async (req, res) => {
    // [DEBUG PERF - TEMPORAIRE] Même instrumentation que GeniusPay, utile
    // pour mesurer où passe le temps le jour où l'intégration réelle sera
    // branchée. À retirer une fois l'intégration stabilisée.
    const __t0 = Date.now();
    const __lap = (label) => console.log(`⏱️ [Jeko init] ${label}: ${Date.now() - __t0}ms`);

    try {
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
        // exact exigé par Jèko non vérifié — repris de GeniusPay par défaut,
        // à ajuster une fois la doc/le format de réponse de test en main.
        let phone = completeAddress.phone;
        phone = phone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
            phone = phone.substring(1);
        }
        if (!phone.startsWith('225')) {
            phone = `225${phone}`;
        }
        phone = `+${phone}`;

        if (!JEKO_INTEGRATION_PRETE) {
            // On annule la commande "pending_payment" créée ci-dessus pour ne
            // pas laisser de commande fantôme en base — même logique que le
            // catch d'échec d'appel réseau plus bas.
            await Order.findByIdAndDelete(order._id);
            console.error("Tentative d'initiation Jèko alors que l'intégration n'est pas terminée (JEKO_INTEGRATION_PRETE = false)");
            return res.json({
                success: false,
                message: "Le paiement par Jèko n'est pas encore disponible, merci de choisir un autre moyen de paiement.",
            });
        }

        // [À VÉRIFIER — champs devinés par analogie avec GeniusPay et la doc
        // publique Jèko, jamais testés contre leur API réelle]
        const jekoPayload = {
            amount: finalAmount,
            currency: "XOF",
            storeId: process.env.JEKO_STORE_ID,
            description: `Commande #${order._id.toString().slice(-8)}`,
            customer: {
                name: `${completeAddress.firstName} ${completeAddress.lastName}`.substring(0, 100),
                phone: phone,
            },
            success_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${order._id}`,
            error_url: `${process.env.FRONTEND_URL}/payment/error?orderId=${order._id}`,
            metadata: {
                order_id: order._id.toString(),
                user_id: userId.toString(),
            },
        };

        const response = await axios.post(
            `${process.env.JEKO_BASE_URL || 'https://api.jeko.africa'}/partner_api/payment_links`,
            jekoPayload,
            {
                headers: {
                    'X-API-KEY': process.env.JEKO_API_KEY,
                    'X-API-KEY-ID': process.env.JEKO_API_KEY_ID,
                    'Content-Type': 'application/json',
                },
            }
        );

        // [À VÉRIFIER] Nom exact du champ contenant l'URL de paiement dans
        // la réponse Jèko — deviné par analogie, à corriger après un premier
        // appel réel.
        const checkoutUrl = response.data?.data?.checkout_url || response.data?.checkout_url || response.data?.url;

        if (!checkoutUrl) {
            await Order.findByIdAndDelete(order._id);
            return res.json({ success: false, message: "Réponse Jèko invalide — pas d'URL de paiement" });
        }

        await Order.findByIdAndUpdate(order._id, { jeko_reference: response.data?.data?.reference || response.data?.reference });

        return res.json({ success: true, checkout_url: checkoutUrl, orderId: order._id });

    } catch (error) {
        console.error("Erreur Jèko:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
        res.json({ success: false, message: error.message || "Erreur lors de l'initialisation du paiement" });
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
    console.error("Webhook Jèko reçu mais non implémenté — voir les commentaires en tête de jekoController.js");
    res.status(200).json({ received: true }); // 200 pour éviter que Jèko ne s'acharne à réessayer indéfiniment
};