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
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../configs/email.js';
import { sendPushToUser } from './pushController.js';

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

// ✅ MODIFIÉ : Réduire le stock ET incrémenter les ventes
const reduceVariantStock = async (items) => {
    for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) continue;
        
        // Incrémenter les ventes GLOBALES
        await Product.findByIdAndUpdate(item.product, {
            $inc: { salesCount: item.quantity }
        });
        
        if (product && product.variants?.length > 0) {
            const variant = product.variants.find(v => 
                (item.color ? v.color === item.color : !v.color) &&
                (item.size ? v.size === item.size : !v.size)
            );
            if (variant) {
                variant.stock = Math.max(0, variant.stock - item.quantity);
                product.inStock = product.variants.some(v => v.stock > 0);
                await product.save();
            }
        } else if (product && product.stock !== null && product.stock !== undefined) {
            const newStock = Math.max(0, product.stock - item.quantity);
            const inStock = newStock > 0;
            await Product.findByIdAndUpdate(item.product, {
                stock: newStock,
                inStock
            });
        }
    }
};

// ✅ NOUVEAU PHASE 3 : Créditer les wallets des commerçants
const crediterWallets = async (items) => {
    // Regrouper les ventes par boutique
    const ventesParBoutique = {};
    
    for (const item of items) {
        // Récupérer le produit pour avoir sa boutiqueId
        const product = await Product.findById(item.product).select('boutiqueId');
        if (!product || !product.boutiqueId) continue;
        
        const boutiqueId = product.boutiqueId.toString();
        if (!ventesParBoutique[boutiqueId]) {
            ventesParBoutique[boutiqueId] = {
                montantTotal: 0,
                items: []
            };
        }
        ventesParBoutique[boutiqueId].montantTotal += item.priceAtOrder * item.quantity;
        ventesParBoutique[boutiqueId].items.push(item);
    }
    
    // Pour chaque boutique, créditer le wallet
    for (const [boutiqueId, data] of Object.entries(ventesParBoutique)) {
        // Trouver le commerçant propriétaire de la boutique
        const Boutique = await import('../models/Boutique.js').then(m => m.default);
        const boutique = await Boutique.findById(boutiqueId).select('ownerId');
        if (!boutique) continue;
        
        const wallet = await Wallet.findOne({ ownerId: boutique.ownerId });
        if (!wallet) continue;
        
        // Créer la transaction de vente
        const montant = data.montantTotal;
        const description = `Vente - ${data.items.length} article(s)`;
        
        await WalletTransaction.create({
            walletId: wallet._id,
            type: 'vente',
            montant: montant,
            description: description,
            // orderId sera ajouté après la création de la commande
        });
        
        // Recalculer le solde
        await wallet.recalculerSolde();
    }
};

export const placeOrderCOD = async (req, res) => {
    try {
        const { userId, items, address, deliveryType, couponApplied } = req.body;
        if (!address || items.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid data" });
        }

        let amount = 0;
        const itemsWithPrice = await Promise.all(items.map(async (item) => {
            const product = await Product.findById(item.product);
            if (!product) {
                throw new Error("Produit introuvable");
            }

            // ✅ PHASE 3 : Récupérer la boutiqueId du produit
            const boutiqueId = product.boutiqueId || null;

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
                boutiqueId: boutiqueId, // ✅ PHASE 3
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
            if (itemsSubtotal < coupon.minPurchase) {
                return res.status(400).json({ success: false, message: `Montant minimum d'achat: ${coupon.minPurchase} FCFA` });
            }
            discountAmount = coupon.calculateDiscount(itemsSubtotal);
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
            // livreurId sera assigné plus tard par l'admin
        });

        // Réduire le stock ET incrémenter salesCount
        await reduceVariantStock(itemsWithPrice);
        await User.findByIdAndUpdate(userId, { cartItems: {} });

        // Envoyer les emails
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

        // ✅ PHASE 3 : Si la commande passe à Delivered, créditer les wallets
        if (status === 'Delivered' && order) {
            await crediterWallets(order.items);
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

// ✅ NOUVEAU PHASE 3 : Assigner un livreur à une commande
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
        
        // Vérifier que le livreur existe et a bien le rôle 'livreur'
        const StaffUser = await import('../models/StaffUser.js').then(m => m.default);
        const livreur = await StaffUser.findOne({ _id: livreurId, role: 'livreur', statut: 'actif' });
        if (!livreur) {
            return res.status(404).json({ success: false, message: "Livreur non trouvé ou inactif" });
        }
        
        order.livreurId = livreurId;
        await order.save();
        
        // Notification push au livreur (à implémenter)
        // sendPushToUser(livreurId, { title: 'Nouvelle commande assignée 🚚', body: `Commande #${order._id.toString().slice(-8)}` });
        
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

// ✅ NOUVEAU PHASE 3 : Récupérer les commandes d'un livreur
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

// ✅ NOUVEAU PHASE 3 : Mettre à jour le statut d'une livraison (par le livreur)
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
        
        // Si Delivered, créditer les wallets
        if (status === 'Delivered') {
            await crediterWallets(order.items);
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