import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Address from "../models/Address.js";
import Coupon from "../models/Coupon.js";
import DeliveryPrice from "../models/DeliveryPrice.js";
import DeliveryType from "../models/DeliveryType.js";
import Commune from "../models/Commune.js";
import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
// [PHASE 0 - PERF] Import statique au lieu de l'import dynamique répété à
// chaque itération de boucle dans crediterWallets — l'import dynamique
// était re-résolu (et son cache re-consulté) pour chaque boutique du
// panier, un coût inutile sur le chemin de la commande.
import Boutique from "../models/Boutique.js";
import { getIdsBoutiquesSuspendues } from "../services/boutiqueService.js";
import {
    crediterVenteEnAttente,
    libererFonds,
    annulerVenteEnAttente,
    traiterRetourColis,
    etatConfirmations,
} from "../services/walletService.js";
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';
import { sendPushToUser } from './pushController.js';
import { syncManyProductsToAirtable } from '../services/airtableSync.js';

// Messages affichés dans la notification push
const orderStatusPushMessages = {
    'Confirmed': { title: 'Commande confirmée ✅', body: 'Votre commande a été confirmée et est en cours de préparation.' },
    'Shipped': { title: 'Commande expédiée 📦', body: 'Votre commande vient d\'être expédiée.' },
    'Out for Delivery': { title: 'Livraison en cours 🚴', body: 'Votre livreur est en route vers vous !' },
    'Delivered': { title: 'Commande livrée 🎉', body: 'Votre commande a été livrée. Merci pour votre confiance !' },
    'Returned': { title: 'Commande retournée', body: 'Votre commande a été marquée comme retournée.' },
    'Cancelled': { title: 'Commande annulée', body: 'Votre commande a été annulée.' }
};

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

// Réduire le stock ET incrémenter les ventes
//
// [PHASE 0 - PERF] Avant : un Product.findById + un Product.findByIdAndUpdate
// (+ un product.save() pour les variantes) PAR article du panier, en série.
// Pour un panier de 5 articles c'était jusqu'à 10-15 allers-retours MongoDB
// évitables sur le chemin critique de la commande. Maintenant : un seul
// Product.find({_id: {$in: [...]}}) pour tout charger, puis un seul
// bulkWrite() pour appliquer toutes les mises à jour (ventes + stock) en une
// requête groupée.
const reduceVariantStock = async (items) => {
    if (!items.length) return;

    const productIds = [...new Set(items.map(item => item.product.toString()))];
    const products = await Product.find({ _id: { $in: productIds } });
    const productsById = new Map(products.map(p => [p._id.toString(), p]));

    const bulkOps = [];

    for (const item of items) {
        const product = productsById.get(item.product.toString());
        if (!product) continue;

        bulkOps.push({
            updateOne: {
                filter: { _id: product._id },
                update: { $inc: { salesCount: item.quantity } }
            }
        });

        if (product.variants?.length > 0) {
            const variant = product.variants.find(v =>
                (item.color ? v.color === item.color : !v.color) &&
                (item.size ? v.size === item.size : !v.size)
            );
            if (variant) {
                // On simule la décrémentation en mémoire pour recalculer
                // inStock correctement même si plusieurs items du même
                // panier touchent des variantes du même produit.
                variant.stock = Math.max(0, variant.stock - item.quantity);
                const inStock = product.variants.some(v => v.stock > 0);
                bulkOps.push({
                    updateOne: {
                        filter: { _id: product._id, 'variants._id': variant._id },
                        update: {
                            $set: {
                                'variants.$.stock': variant.stock,
                                inStock
                            }
                        }
                    }
                });
            }
        } else if (product.stock !== null && product.stock !== undefined) {
            const newStock = Math.max(0, product.stock - item.quantity);
            product.stock = newStock; // pour cohérence si réutilisé plus bas
            bulkOps.push({
                updateOne: {
                    filter: { _id: product._id },
                    update: { $set: { stock: newStock, inStock: newStock > 0 } }
                }
            });
        }
    }

    if (bulkOps.length > 0) {
        await Product.bulkWrite(bulkOps);
        // Chaque vente change "Quantité restante" et "Quantité vendue" —
        // tâche de fond, ne bloque jamais la confirmation de commande.
        syncManyProductsToAirtable(productIds);
    }
};

// [ARGENT] L'ancienne fonction crediterWallets() a été retirée.
//
// Elle créditait le portefeuille des commerçants À LA LIVRAISON, en un seul
// solde. Le circuit est désormais en deux temps, dans services/walletService.js :
//   1. crediterVenteEnAttente() — à la commande, sur le solde EN ATTENTE :
//      le commerçant voit son argent et accepte de remettre son colis ;
//   2. libererFonds() — à la validation de l'admin, une fois tous les
//      commerçants confirmés : l'argent devient retirable.
// annulerVenteEnAttente() reprend le crédit si la commande ne se conclut pas.
//
// La laisser en place aurait été un piège : deux fonctions de crédit
// concurrentes dans le même fichier finissent par être appelées toutes les deux.

export const placeOrderCOD = async (req, res) => {
    try {
        const { userId, items, address, deliveryType, couponApplied } = req.body;
        if (!address || items.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid data" });
        }

        // Un panier peut avoir été rempli avant la suspension d'une
        // boutique : on revérifie à la commande, sinon l'article serait
        // vendu alors que plus personne ne peut l'expédier.
        const boutiquesSuspendues = await getIdsBoutiquesSuspendues();

        let amount = 0;
        const itemsWithPrice = await Promise.all(items.map(async (item) => {
            const product = await Product.findById(item.product);
            if (!product) {
                throw new Error("Produit introuvable");
            }
            if (product.isArchived) {
                throw new Error(`"${product.name}" n'est plus disponible à la vente`);
            }

            const boutiqueId = product.boutiqueId || null;

            if (boutiqueId && boutiquesSuspendues.includes(boutiqueId.toString())) {
                throw new Error(`"${product.name}" n'est plus disponible à la vente`);
            }

            let priceAtOrder = product.offerPrice;
            if (product.variants && product.variants.length > 0) {
                const variant = product.variants.find(v =>
                    (item.selectedColor == null ? v.color == null : v.color === item.selectedColor) &&
                    (item.selectedSize == null ? v.size == null : v.size === item.selectedSize)
                );
                if (variant && variant.offerPrice > 0) {
                    priceAtOrder = variant.offerPrice;
                }
            }

            amount += priceAtOrder * item.quantity;
            return {
                product: item.product,
                quantity: item.quantity,
                color: item.selectedColor || null,
                size: item.selectedSize || null,
                priceAtOrder: priceAtOrder,
                boutiqueId: boutiqueId,
                // Instantané — voir Order.js pour le raisonnement.
                name: product.name,
                image: product.image?.[0] || null,
                sku: product.sku || null,
            };
        }));

        const tax = Math.floor(amount * 0.02);
        amount += tax;
        const itemsSubtotal = amount;

        let deliveryPrice = 0;
        if (deliveryType) {
            const addressDoc = await Address.findById(address);
            const deliveryTypeDoc = await DeliveryType.findOne({ name: deliveryType, isActive: true });

            if (deliveryTypeDoc && addressDoc?.communeId) {
                let priceDoc = await DeliveryPrice.findOne({
                    communeId: addressDoc.communeId,
                    deliveryTypeId: deliveryTypeDoc._id,
                    isActive: true
                });

                if (!priceDoc) {
                    const commune = await Commune.findById(addressDoc.communeId);
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
            }
        }

        let discountAmount = 0;
        if (couponApplied) {
            const coupon = await Coupon.findOne({ code: String(couponApplied).toUpperCase() });
            if (!coupon) {
                return res.status(400).json({ success: false, message: "Code promo invalide" });
            }
            if (!coupon.isValid()) {
                return res.status(400).json({ success: false, message: "Code promo expiré ou désactivé" });
            }
            // Un coupon créé par un commerçant (boutiqueId renseigné) ne
            // remise que les articles de sa boutique dans le panier (et,
            // s'il restreint eligibleProducts, seulement ceux-là). Un
            // coupon admin (boutiqueId null) garde le comportement
            // inchangé : remise sur tout le panier.
            let baseAmount = itemsSubtotal;
            if (coupon.boutiqueId) {
                baseAmount = itemsWithPrice
                    .filter(it => it.boutiqueId && it.boutiqueId.toString() === coupon.boutiqueId.toString())
                    .filter(it => coupon.eligibleProducts.length === 0 || coupon.eligibleProducts.some(p => p.toString() === it.product.toString()))
                    .reduce((sum, it) => sum + it.priceAtOrder * it.quantity, 0);
            }
            if (baseAmount < coupon.minPurchase) {
                return res.status(400).json({ success: false, message: `Montant minimum d'achat: ${coupon.minPurchase} FCFA` });
            }
            discountAmount = coupon.calculateDiscount(baseAmount);
        }

        amount = itemsSubtotal + deliveryPrice - discountAmount;

        const { deliveryStart, deliveryEnd } = calculateEstimatedDeliveryDates(new Date());

        const order = await Order.create({
            userId,
            items: itemsWithPrice,
            amount,
            deliveryPrice,
            discountAmount,
            couponApplied: couponApplied ? String(couponApplied).toUpperCase() : null,
            address,
            paymentType: "COD",
            status: "Order Placed",
            estimatedDeliveryStart: deliveryStart,
            estimatedDeliveryEnd: deliveryEnd,
        });

        await reduceVariantStock(itemsWithPrice);

        // [ARGENT] Crédit du solde EN ATTENTE de chaque boutique concernée,
        // dès la commande. Le commerçant voit immédiatement ce qui lui
        // revient — c'est la condition pour qu'il accepte de préparer et de
        // remettre son colis. Il ne pourra le retirer qu'après validation
        // de l'admin (voir confirmerCommandeAdmin).
        await crediterVenteEnAttente(order);

        await User.findByIdAndUpdate(userId, { cartItems: {} });

        const user = await User.findById(userId);
        if (user && user.email) {
            await sendOrderConfirmationEmail(
                user.email, 
                order._id.toString(), 
                amount,
                deliveryStart,
                deliveryEnd
            );
            await sendAdminNotificationEmail(order._id.toString(), amount, `${user.name}`, user.email);
        }

        return res.status(201).json({ success: true, message: "Order Placed Successfully" });
    } catch (error) {
        console.error('Erreur placeOrderCOD:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// METTRE À JOUR LE STATUT D'UNE COMMANDE (Admin)
// =============================================================
export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const validStatuses = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Statut invalide" });
        }
        
        const updateData = { status };
        if (status === 'Delivered') {
            updateData.deliveredAt = new Date();
        }
        
        const order = await Order.findByIdAndUpdate(orderId, updateData);

        // [ARGENT] Le crédit se fait désormais À LA COMMANDE (solde en
        // attente), plus à la livraison — sinon le commerçant serait payé
        // deux fois. Ici on ne fait que reprendre le crédit si la commande
        // ne se conclut pas.
        if (order && status === 'Cancelled') {
            // Annulation avant libération : simple reprise du crédit.
            await annulerVenteEnAttente(order);
        }
        if (order && status === 'Returned') {
            // Colis retourné : l'argent est repris où qu'il soit, y compris
            // s'il a déjà été retiré (le solde passe alors en négatif).
            await traiterRetourColis(order);
        }

        const pushContent = orderStatusPushMessages[status];
        if (order && pushContent) {
            sendPushToUser(order.userId, {
                title: pushContent.title,
                body: pushContent.body,
                url: '/my-orders'
            });
        }

        res.json({ success: true, message: "Statut mis à jour" });
    } catch (error) {
        console.error('Erreur updateOrderStatus:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// ✅ PHASE 4 : ASSIGNER UN LIVREUR À UNE COMMANDE (Admin)
// =============================================================
export const assignerLivreur = async (req, res) => {
    try {
        const { orderId, livreurId } = req.body;
        
        if (!orderId || !livreurId) {
            return res.status(400).json({ success: false, message: "orderId et livreurId requis" });
        }
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Commande non trouvée" });
        }
        
        const StaffUser = await import('../models/StaffUser.js').then(m => m.default);
        const livreur = await StaffUser.findOne({ _id: livreurId, role: 'livreur', statut: 'actif' });
        if (!livreur) {
            return res.status(404).json({ success: false, message: "Livreur non trouvé ou inactif" });
        }
        
        order.livreurId = livreurId;
        await order.save();
        
        return res.json({ 
            success: true, 
            message: "Livreur assigné avec succès",
            order 
        });
    } catch (error) {
        console.error('Erreur assignerLivreur:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// ✅ PHASE 4 : RÉCUPÉRER LES COMMANDES D'UN LIVREUR
// =============================================================
export const getLivraisonsLivreur = async (req, res) => {
    try {
        const livreurId = req.staffUser._id;
        
        const orders = await Order.find({
            livreurId: livreurId,
            status: { $in: ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery'] }
        }).populate('items.product address').sort({ createdAt: -1 });
        
        const historique = await Order.find({
            livreurId: livreurId,
            status: { $in: ['Delivered', 'Returned', 'Cancelled'] }
        }).populate('items.product address').sort({ createdAt: -1 }).limit(50);
        
        return res.json({ 
            success: true, 
            orders,
            historique
        });
    } catch (error) {
        console.error('Erreur getLivraisonsLivreur:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// ✅ PHASE 4 : METTRE À JOUR LE STATUT D'UNE LIVRAISON (Livreur)
// =============================================================
export const updateLivraisonStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const livreurId = req.staffUser._id;
        
        const validStatuses = ['Out for Delivery', 'Delivered'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Statut invalide pour un livreur" });
        }
        
        const order = await Order.findOne({ _id: orderId, livreurId: livreurId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Commande non trouvée ou non assignée à ce livreur" });
        }
        
        const updateData = { status };
        if (status === 'Delivered') {
            updateData.deliveredAt = new Date();
        }
        
        await Order.findByIdAndUpdate(orderId, updateData);
        
        // Voir plus haut : crédit à la commande, reprise si annulation.
        if (status === 'Cancelled') {
            await annulerVenteEnAttente(order);
        }
        if (status === 'Returned') {
            await traiterRetourColis(order);
        }
        
        const pushContent = orderStatusPushMessages[status];
        if (pushContent) {
            sendPushToUser(order.userId, {
                title: pushContent.title,
                body: pushContent.body,
                url: '/my-orders'
            });
        }
        
        return res.json({ 
            success: true, 
            message: "Statut de livraison mis à jour" 
        });
    } catch (error) {
        console.error('Erreur updateLivraisonStatus:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// COMMANDES UTILISATEUR
// =============================================================
export const getUserOrders = async (req, res) => {
    try {
        const { userId } = req.body;
        const orders = await Order.find({
            userId,
            $or: [{ paymentType: "COD" }, { isPaid: true }]
        }).populate("items.product address").sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// COMMANDES ADMIN
// =============================================================
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            $or: [{ paymentType: "COD" }, { isPaid: true }]
        }).populate("items.product address").sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Commerçant : uniquement les commandes contenant au moins un article
// de SA boutique, avec les montants recalculés sur ses seules lignes
// (une commande peut mélanger des articles de plusieurs boutiques).
// Statut tel qu'un COMMERÇANT doit le lire.
//
// Les statuts internes ('Order Placed', 'Out for Delivery'…) décrivent la
// logistique de la plateforme et ne lui apprennent rien d'actionnable. Ce
// qu'il veut savoir tient en une question : « qu'est-ce que je dois faire,
// et où en est mon argent ? »
const statutCommercant = (order, aConfirme) => {
    if (order.status === 'Cancelled') {
        return { cle: 'annulee', libelle: 'Annulée', ton: 'neutre' };
    }
    if (order.status === 'Returned') {
        return { cle: 'retournee', libelle: 'Retournée', ton: 'neutre' };
    }
    if (!aConfirme) {
        return { cle: 'a_confirmer', libelle: 'À confirmer', ton: 'action' };
    }
    if (!order.confirmeParAdminLe) {
        return { cle: 'confirmee', libelle: 'Confirmée — en attente de validation', ton: 'attente' };
    }
    if (order.status === 'Delivered') {
        return { cle: 'livree', libelle: 'Livrée — fonds disponibles', ton: 'succes' };
    }
    return { cle: 'validee', libelle: 'Validée — fonds disponibles', ton: 'succes' };
};

export const getMesVentesCommercant = async (req, res) => {
    try {
        const boutiqueId = req.staffUser.boutiqueId;
        if (!boutiqueId) {
            return res.json({ success: false, message: 'Aucune boutique associée à ce compte' });
        }

        const orders = await Order.find({
            'items.boutiqueId': boutiqueId,
            status: { $ne: 'pending_payment' },
        })
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        // [CONFIDENTIALITÉ] Rien de ce qui identifie le CLIENT ne sort d'ici :
        // ni son nom, ni son téléphone, ni son adresse, ni le contenu des
        // autres boutiques, ni le montant total de la commande. Le commerçant
        // prépare un colis — il n'a besoin que de SES articles.
        //
        // C'est une reconstruction champ par champ, jamais un filtrage de
        // l'objet complet : un nouveau champ ajouté au modèle Order ne peut
        // pas fuiter ici par accident.
        const ventes = orders.map((order) => {
            const mesArticles = (order.items || []).filter(
                (item) => item.boutiqueId?.toString() === boutiqueId.toString()
            );

            const montantBoutique = mesArticles.reduce(
                (somme, item) => somme + (item.priceAtOrder || 0) * (item.quantity || 0), 0
            );

            const aConfirme = (order.confirmationsBoutiques || []).some(
                (c) => c.boutiqueId?.toString() === boutiqueId.toString()
            );

            return {
                _id: order._id,
                // Référence courte : le commerçant doit pouvoir nommer la
                // commande à l'admin sans manipuler un identifiant complet.
                reference: order._id.toString().slice(-6).toUpperCase(),
                dateCommande: order.createdAt,
                articles: mesArticles.map((item) => ({
                    nom: item.name,
                    sku: item.sku,
                    image: item.image,
                    couleur: item.color,
                    taille: item.size,
                    quantite: item.quantity,
                    prixUnitaire: item.priceAtOrder,
                })),
                nombreArticles: mesArticles.length,
                montantBoutique,
                aConfirme,
                statut: statutCommercant(order, aConfirme),
                fondsLiberes: Boolean(order.confirmeParAdminLe),
            };
        });

        res.json({ success: true, orders: ventes });
    } catch (error) {
        console.error('Erreur getMesVentesCommercant:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getUserOrdersByAdmin = async (req, res) => {
    try {
        const { userId } = req.params;
        const orders = await Order.find({
            userId,
            $or: [{ paymentType: "COD" }, { isPaid: true }]
        }).populate("items.product address").sort({ createdAt: -1 });
        const user = await User.findById(userId).select("-password");
        res.json({ 
            success: true, 
            orders,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
// ══════════════════════════════════════════════════════════════════════
//  CIRCUIT DE CONFIRMATION MULTI-BOUTIQUES
// ══════════════════════════════════════════════════════════════════════

// POST /api/order/commercant/confirmer — Commerçant
//
// « J'ai vu la commande et mis mon colis de côté. »
//
// Ne change pas le statut global de la commande : c'est une confirmation
// PAR BOUTIQUE. Quand toutes les boutiques concernées ont confirmé, la
// commande devient prête à être validée par l'admin.
export const confirmerCommandeCommercant = async (req, res) => {
    try {
        const { orderId } = req.body;
        const boutiqueId = req.staffUser.boutiqueId;

        if (!boutiqueId) {
            return res.status(400).json({ success: false, message: 'Aucune boutique associée à ce compte' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande introuvable' });
        }

        // Le commerçant ne confirme que s'il est réellement concerné.
        const estConcerne = (order.items || []).some(
            (item) => item.boutiqueId?.toString() === boutiqueId.toString()
        );
        if (!estConcerne) {
            return res.status(403).json({
                success: false,
                message: "Cette commande ne concerne pas votre boutique",
            });
        }

        const dejaConfirme = (order.confirmationsBoutiques || []).some(
            (c) => c.boutiqueId?.toString() === boutiqueId.toString()
        );

        if (!dejaConfirme) {
            order.confirmationsBoutiques.push({
                boutiqueId,
                confirmePar: req.staffUser._id,
                confirmeParNom: req.staffUser.nom,
                confirmeLe: new Date(),
            });
            await order.save();
        }

        const etat = etatConfirmations(order);

        return res.json({
            success: true,
            message: dejaConfirme
                ? 'Commande déjà confirmée'
                : 'Commande confirmée — colis à mettre de côté',
            toutesConfirmees: etat.toutesConfirmees,
            enAttenteDe: etat.manquantes.length,
        });
    } catch (error) {
        console.error('Erreur confirmerCommandeCommercant:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/order/admin/a-valider — Admin
//
// Commandes en attente de validation, avec l'état des confirmations de
// chaque boutique. C'est l'écran qui dit à l'admin « qui n'a pas encore
// confirmé », donc qui relancer.
export const listCommandesAValider = async (req, res) => {
    try {
        const orders = await Order.find({
            confirmeParAdminLe: null,
            status: { $nin: ['Cancelled', 'Returned', 'pending_payment'] },
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const boutiqueIds = [...new Set(
            orders.flatMap((o) => (o.items || []).map((i) => i.boutiqueId?.toString()).filter(Boolean))
        )];
        const boutiques = await Boutique.find({ _id: { $in: boutiqueIds } }).select('nom').lean();
        const nomParBoutique = new Map(boutiques.map((b) => [b._id.toString(), b.nom]));

        const resultat = orders.map((order) => {
            const etat = etatConfirmations(order);
            return {
                _id: order._id,
                createdAt: order.createdAt,
                amount: order.amount,
                status: order.status,
                nombreArticles: (order.items || []).length,
                toutesConfirmees: etat.toutesConfirmees,
                boutiquesConfirmees: etat.confirmees.map((id) => nomParBoutique.get(id) || 'Boutique'),
                boutiquesManquantes: etat.manquantes.map((id) => nomParBoutique.get(id) || 'Boutique'),
            };
        });

        return res.json({
            success: true,
            orders: resultat,
            pretes: resultat.filter((o) => o.toutesConfirmees).length,
        });
    } catch (error) {
        console.error('Erreur listCommandesAValider:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/order/admin/confirmer — Admin
//
// Validation finale : c'est CE geste qui rend l'argent retirable pour les
// commerçants (transfert du solde en attente vers le solde disponible).
export const confirmerCommandeAdmin = async (req, res) => {
    try {
        const { orderId, forcer } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande introuvable' });
        }

        if (order.confirmeParAdminLe) {
            return res.status(409).json({
                success: false,
                message: 'Cette commande a déjà été validée',
            });
        }

        const etat = etatConfirmations(order);

        // On refuse par défaut tant qu'un commerçant n'a pas confirmé : le
        // circuit perdrait son sens si l'admin validait avant que les colis
        // soient mis de côté. `forcer` reste possible pour les cas réels
        // (commerçant injoignable), mais c'est un choix explicite.
        if (!etat.toutesConfirmees && !forcer) {
            return res.status(409).json({
                success: false,
                message: `${etat.manquantes.length} boutique(s) n'ont pas encore confirmé`,
                enAttenteDe: etat.manquantes.length,
            });
        }

        order.confirmeParAdminLe = new Date();
        order.confirmeParAdmin = req.staffUser._id;
        await order.save();

        const resultat = await libererFonds(order);

        return res.json({
            success: true,
            message: resultat.liberees > 0
                ? `Commande validée — fonds libérés pour ${resultat.liberees} boutique(s)`
                : 'Commande validée',
            boutiquesCreditees: resultat.liberees,
            montantLibere: resultat.montantTotal,
        });
    } catch (error) {
        console.error('Erreur confirmerCommandeAdmin:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
