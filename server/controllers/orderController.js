import mongoose from "mongoose";
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
import CustomerCreditTransaction from "../models/CustomerCreditTransaction.js";
// [CORRECTIF AUDIT — 23 août 2026] nécessaire pour le garde-fou
// d'exclusivité RCOINS / remboursement monétaire, symétrique à celui
// ajouté dans refundController.createRefund.
import Refund from "../models/Refund.js";
// [PHASE 0 - PERF] Import statique au lieu de l'import dynamique répété à
// chaque itération de boucle dans crediterWallets — l'import dynamique
// était re-résolu (et son cache re-consulté) pour chaque boutique du
// panier, un coût inutile sur le chemin de la commande.
import Boutique from "../models/Boutique.js";
import StaffUser from "../models/StaffUser.js";
import { getIdsBoutiquesSuspendues } from "../services/boutiqueService.js";
import {
    crediterVenteEnAttente,
    libererFonds,
    annulerVenteEnAttente,
    traiterRetourColis,
    etatConfirmations,
    ajusterPortefeuille,
} from "../services/walletService.js";
import {
    libererReservationsExpirees,
    calculerExpirationReservation,
} from "../services/collecteService.js";
// [RAMCI §8, §15] Règle unique d'éligibilité à la libération des fonds.
import { evaluerEligibilite, etatLiberation } from "../services/fundsReleaseService.js";
// [RAMCI §5, §15] Table unique des transitions de commande.
import { transitionner, transitionnerAtomique, avancement } from "../services/orderWorkflowService.js";
import { journaliser } from "../services/journalService.js";
import { acteurDepuisStaff, acteurVendeurTechnique, acteurDepuisRequete } from "../middlewares/authActeur.js";
// [FIX] Ce contrôleur importait crediterClient depuis services/customerCreditService.js,
// un module qui importe lui-même le mauvais fichier (models/CustomerCredit.js sans
// export par défaut) : CustomerCreditTransaction y valait `undefined`, donc tout appel
// de crediterClient plantait avec une TypeError dès qu'une commande payée avait un
// article indisponible. models/CustomerCredit.js contient la version qui fonctionne
// réellement (met à jour User.creditBalance, cohérente avec GET /order/user/credit).
import { crediterClient, rembourserCreditAnnulation, rembourserClientRetour } from '../models/CustomerCredit.js';
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

        // [RETIRÉ] Une taxe de 2 % était ajoutée ici au total de la commande.
        // Elle venait du code d'origine du projet et n'a jamais été voulue :
        //   · elle n'existait que sur ce chemin — jekoController, le seul
        //     réellement emprunté aujourd'hui, ne l'appliquait pas ;
        //   · elle n'apparaissait nulle part côté client, dont le panier
        //     calcule simplement prix × quantité ;
        //   · elle n'a jamais été prélevée sur personne : rien dans
        //     l'interface ne met paymentOption à "COD", donc cette route
        //     n'est pas atteignable depuis le panier.
        //
        // On la retire plutôt que de la laisser dormir : le jour où le
        // paiement à la livraison sera rebranché, elle s'appliquerait sans
        // que personne ne sache d'où viennent ces 2 %.
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
            status: "Checking Availability",
            estimatedDeliveryStart: deliveryStart,
            estimatedDeliveryEnd: deliveryEnd,
        });

        await reduceVariantStock(itemsWithPrice);

        // Une commande composée uniquement du catalogue principal n'attend
        // aucun commerçant.
        if (!itemsWithPrice.some(item => item.boutiqueId)) {
            // [MIGRATION GUICHET UNIQUE] transition système (pas d'acteur
            // humain) — passe par transitionner() pour garder une seule
            // porte d'entrée sur order.status, avec la même table de
            // transitions que partout ailleurs.
            const transition = transitionner({ order, vers: 'Confirmed', acteur: null });
            if (!transition.ok) {
                console.error(`⚠️ Transition refusée pour la commande ${order._id} (COD, sans commerçant) : ${transition.message}`);
            }
            order.confirmedAt = new Date();
            await order.save();
        }

        // Le portefeuille n'est crédité qu'après validation de disponibilité
        // de toutes les boutiques. Une commande simplement créée ne constitue
        // pas encore une créance commerçant définitive.
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
// ANNULER UNE COMMANDE NON PAYÉE (client) — utilisée notamment quand le
// client abandonne la page de paiement Jèko ou revient sur une erreur
// (voir Cart.jsx, useEffect de vérification des commandes abandonnées).
// [MIGRATION GUICHET UNIQUE] passe par transitionnerAtomique() : le
// filtre isPaid: {$ne:true} reste la protection contre une course avec
// une confirmation de paiement en cours (webhook Jèko), mais il est
// maintenant combiné à la table TRANSITIONS et journalisé comme toute
// autre transition. Si des RCOINS avaient été débités, ils sont
// remboursés.
// =============================================================
export const cancelOrder = async (req, res) => {
    try {
        const { orderId, userId } = req.body;
        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId requis" });
        }

        const resultat = await transitionnerAtomique({
            Order,
            orderId,
            vers: 'Cancelled',
            depuis: 'pending_payment',
            filtreConcurrence: { userId, isPaid: { $ne: true } },
            acteur: null,
            verifierDroits: false,
            note: 'annulation par le client',
        });

        // Idempotent par design : si la commande est introuvable, déjà payée,
        // déjà annulée, ou déjà passée à un autre statut, il n'y a
        // simplement rien à faire — pas une erreur pour l'appelant.
        if (!resultat.ok) {
            return res.json({ success: true, message: "Rien à annuler" });
        }

        if (resultat.avant.creditUsed > 0) {
            await rembourserCreditAnnulation({
                orderId,
                userId: resultat.avant.userId,
                description: `Remboursement RCOINS — commande ${orderId} annulée par le client`
            });
        }

        return res.json({ success: true, message: "Commande annulée" });
    } catch (error) {
        console.error('Erreur cancelOrder:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// METTRE À JOUR LE STATUT D'UNE COMMANDE (Admin)
// =============================================================
export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status, retourEtat, retourNote } = req.body;
        const validStatuses = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Statut invalide" });
        }

        // [NOUVEAU] Un retour engage deux décisions distinctes : reprendre
        // l'argent du commerçant (toujours) et réintégrer le stock (sauf
        // colis endommagé/invendable). On force donc un choix explicite
        // plutôt qu'un restock silencieux par défaut — voir
        // traiterRetourColis() dans walletService.js.
        if (status === 'Returned' && !['bon_etat', 'endommage'].includes(retourEtat)) {
            return res.status(400).json({
                success: false,
                message: "Précisez l'état du retour : bon état (remis en stock) ou endommagé.",
            });
        }
        
        // [RAMCI §5, §15] Cette route écrivait le statut avec un
        // findByIdAndUpdate direct : AUCUNE transition n'était contrôlée.
        // Une commande pouvait sauter de « Commande passée » à « Livrée »
        // sans collecte ni réception — donc sans qu'aucun commerçant ait
        // confirmé, et avec des fonds réputés libérables. On passe
        // désormais par la table unique de orderWorkflowService.
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande introuvable' });
        }

        const transition = transitionner({
            order,
            vers: status,
            acteur: req.staffUser,
            note: 'mise à jour manuelle',
        });
        if (!transition.ok) {
            return res.status(transition.code || 409).json({
                success: false,
                message: transition.message,
                statutActuel: transition.depuis,
            });
        }

        if (status === 'Delivered') {
            order.deliveredAt = new Date();
        }
        if (status === 'Returned') {
            order.retourEtat = retourEtat;
            order.retourNote = String(retourNote || '').slice(0, 300) || null;
            order.retourTraiteLe = new Date();
        }
        await order.save();

        // [ARGENT] Le crédit se fait désormais À LA COMMANDE (solde en
        // attente), plus à la livraison — sinon le commerçant serait payé
        // deux fois. Ici on ne fait que reprendre le crédit si la commande
        // ne se conclut pas.
        if (order && status === 'Cancelled') {
            // Annulation avant libération : simple reprise du crédit.
            await annulerVenteEnAttente(order);
        }
        let montantRembourseClient = 0;
        if (order && status === 'Returned') {
            // Colis retourné : l'argent est repris où qu'il soit, y compris
            // s'il a déjà été retiré (le solde passe alors en négatif).
            // Le stock n'est réintégré que si le colis revient en bon état.
            await traiterRetourColis(order, { etat: retourEtat });

            // [NOUVEAU] Le commerçant est débité, mais jusqu'ici le client
            // ne récupérait jamais rien : il payait un article qu'il n'a
            // finalement pas reçu. On lui rend la valeur des articles en
            // RCOINS (hors frais de livraison, réellement engagés) — voir
            // rembourserClientRetour() dans models/CustomerCredit.js.
            montantRembourseClient = await rembourserClientRetour({ order });
        }

        const pushContent = orderStatusPushMessages[status];
        if (order && pushContent) {
            sendPushToUser(order.userId, {
                title: pushContent.title,
                body: pushContent.body,
                url: '/my-orders'
            });
        }

        // [NOUVEAU] doc §15 : le forçage manuel d'un statut (hors circuit
        // disponibilité → collecte → Shipped) est une action Admin sensible.
        if (order) {
            // [FIX] Journalisait systématiquement le compte technique, même
            // quand l'action venait d'un vrai compte staff admin (2FA) —
            // acteurDepuisRequete() restitue le VRAI acteur de la requête,
            // quelle que soit la session utilisée pour s'authentifier.
            journaliser({
                acteur: acteurDepuisRequete(req) || acteurVendeurTechnique(),
                action: 'commande.forcage_statut',
                cible: { id: order._id, libelle: `Commande ${order._id.toString().slice(-6).toUpperCase()}` },
                note: status === 'Returned'
                    ? `Statut forcé manuellement → Returned (${retourEtat}${montantRembourseClient > 0 ? `, ${montantRembourseClient} FCFA remboursés au client` : ''})`
                    : `Statut forcé manuellement → ${status}`,
            });
        }

        res.json({
            success: true,
            message: "Statut mis à jour",
            ...(status === 'Returned' ? { montantRembourseClient } : {}),
        });
    } catch (error) {
        console.error('Erreur updateOrderStatus:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// [NOUVEAU] RECHERCHE DE COMMANDE (Admin) — pour l'écran de retour colis
// =============================================================
// Un admin moderne (compte staff, 2FA) n'avait aucun moyen de retrouver une
// commande précise pour la marquer 'Returned' : la seule vue existante
// (listCommandesAValider) ne montre que les commandes en attente de
// libération de fonds, pas l'historique complet. Recherche par fin d'ID de
// commande (les 6-8 caractères affichés partout dans l'UI, ex. #A1B2C3).
export const rechercherCommandeAdmin = async (req, res) => {
    try {
        const terme = String(req.query.q || '').trim();
        if (terme.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Indiquez au moins 3 caractères (fin du numéro de commande).",
            });
        }

        // ID complet valide -> recherche exacte. Sinon -> recherche sur la
        // fin de l'ID (ce que l'admin a sous les yeux dans les autres écrans).
        const filtre = mongoose.Types.ObjectId.isValid(terme) && terme.length === 24
            ? { _id: terme }
            : { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${terme}$`, options: 'i' } } };

        const orders = await Order.find(filtre)
            .sort({ createdAt: -1 })
            .limit(10)
            .select('_id userId amount deliveryPrice status retourEtat retourNote retourTraiteLe createdAt items')
            .populate('userId', 'name email')
            .lean();

        return res.json({ success: true, orders });
    } catch (error) {
        console.error('Erreur rechercherCommandeAdmin:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// COLLECTE LIVREUR — une commande est visible par tous les livreurs,
// mais une réservation est atomique et exclusive.
// =============================================================
export const getCollectesLivreur = async (req, res) => {
    try {
        // Une réservation morte (livreur qui a abandonné) ne doit jamais
        // rester invisible aux autres — on la libère avant de lister.
        await libererReservationsExpirees();

        const livreurId = req.staffUser._id;
        const orders = await Order.find({
            status: { $in: ['Confirmed', 'Collecting', 'Ready for Shipment'] },
            $or: [
                { collecteLivreurId: null },
                { collecteLivreurId: livreurId }
            ]
        }).populate('items.product address').sort({ createdAt: -1 }).lean();

        return res.json({ success: true, orders });
    } catch (error) {
        console.error('Erreur getCollectesLivreur:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const reserverCollecte = async (req, res) => {
    try {
        await libererReservationsExpirees();

        const livreurId = req.staffUser._id;
        const { orderId } = req.body;

        const resultat = await transitionnerAtomique({
            Order,
            orderId,
            vers: 'Collecting',
            depuis: 'Confirmed',
            filtreConcurrence: { collecteLivreurId: null },
            champsSupplementaires: {
                collecteLivreurId: livreurId,
                collecteReserveeLe: new Date(),
                collecteExpireLe: calculerExpirationReservation(),
            },
            acteur: acteurDepuisRequete(req),
            note: 'réservation collecte livreur',
        });

        if (!resultat.ok) {
            return res.status(409).json({
                success: false,
                message: 'Cette collecte a déjà été réservée ou n’est plus disponible.'
            });
        }

        const order = await Order.findById(orderId).populate('items.product address');
        return res.json({ success: true, order });
    } catch (error) {
        console.error('Erreur reserverCollecte:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const collecterArticle = async (req, res) => {
    try {
        const { orderId, itemId } = req.body;
        const livreurId = req.staffUser._id;
        const order = await Order.findOne({
            _id: orderId,
            collecteLivreurId: livreurId,
            status: { $in: ['Collecting', 'Ready for Shipment'] }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Collecte introuvable ou non réservée à ce livreur.' });
        }

        const item = order.items.id(itemId);
        if (!item) return res.status(404).json({ success: false, message: 'Article introuvable.' });
        if (item.availabilityStatus === 'unavailable') {
            return res.status(409).json({ success: false, message: 'Cet article est indisponible.' });
        }
        if (item.availabilityStatus === 'collected') {
            return res.json({ success: true, message: 'Article déjà collecté.' });
        }

        item.availabilityStatus = 'collected';
        item.collectedAt = new Date();
        item.collectedBy = livreurId;
        // Une collecte réelle a commencé : plus question de la laisser
        // expirer sous ce livreur.
        order.collecteExpireLe = null;

        const actifs = order.items.filter(i => i.availabilityStatus !== 'unavailable');
        const tousCollectes = actifs.length > 0 && actifs.every(i => i.availabilityStatus === 'collected');

        // [MIGRATION GUICHET UNIQUE] passe par transitionner() plutôt que
        // par une écriture directe de order.status.
        const cible = tousCollectes ? 'Ready for Shipment' : 'Collecting';
        const transition = transitionner({ order, vers: cible, acteur: acteurDepuisRequete(req) });
        if (!transition.ok) {
            return res.status(transition.code || 409).json({ success: false, message: transition.message });
        }
        await order.save();

        return res.json({
            success: true,
            tousCollectes,
            status: order.status
        });
    } catch (error) {
        console.error('Erreur collecterArticle:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const terminerCollecte = async (req, res) => {
    try {
        const livreurId = req.staffUser._id;
        const { orderId } = req.body;
        const order = await Order.findOne({
            _id: orderId,
            collecteLivreurId: livreurId,
            status: 'Ready for Shipment'
        });
        if (!order) return res.status(409).json({ success: false, message: 'Tous les articles disponibles ne sont pas encore collectés.' });
        return res.json({ success: true, message: 'Collecte terminée. Les Opérations peuvent réceptionner le colis.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// [FIX] La page Collectes.jsx (nouvelle, liée à /livreur/collectes) appelle
// des routes REST à paramètres (POST /livreur/collectes/:orderId/reserver,
// /:orderId/items/:itemId/collecter, /:orderId/terminer) conformément à la
// doc (section 18, API cible). Ces routes n'existaient pas — seules les
// versions à plat (reserverCollecte/collecterArticle/terminerCollecte,
// orderId/itemId dans req.body) étaient branchées, ce que Collectes.jsx
// n'utilise pas. On réutilise ici exactement la même logique/les mêmes
// champs de schéma (collecteLivreurId, collecteReserveeLe) pour éviter tout
// nouveau champ non déclaré dans Order.js.
export const reserverCollecteLivreur = async (req, res) => {
    try {
        await libererReservationsExpirees();

        const livreurId = req.staffUser._id;
        const { orderId } = req.params;

        const resultat = await transitionnerAtomique({
            Order,
            orderId,
            vers: 'Collecting',
            depuis: 'Confirmed',
            filtreConcurrence: { collecteLivreurId: null },
            champsSupplementaires: {
                collecteLivreurId: livreurId,
                collecteReserveeLe: new Date(),
                collecteExpireLe: calculerExpirationReservation(),
            },
            acteur: acteurDepuisRequete(req),
            note: 'réservation collecte livreur',
        });

        if (!resultat.ok) {
            return res.status(409).json({ success: false, message: 'Cette collecte a déjà été réservée ou n’est plus disponible.' });
        }

        const order = await Order.findById(orderId).populate('items.product address');
        return res.json({ success: true, order });
    } catch (error) {
        console.error('Erreur reserverCollecteLivreur:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const collecterArticleLivreur = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const livreurId = req.staffUser._id;
        const order = await Order.findOne({
            _id: orderId,
            collecteLivreurId: livreurId,
            status: { $in: ['Collecting', 'Ready for Shipment'] }
        }).populate('items.product address');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Collecte introuvable ou non réservée à ce livreur.' });
        }
        const item = order.items.id(itemId);
        if (!item) return res.status(404).json({ success: false, message: 'Article introuvable.' });
        if (item.availabilityStatus === 'unavailable') {
            return res.status(409).json({ success: false, message: 'Cet article est indisponible.' });
        }
        if (item.availabilityStatus !== 'collected') {
            item.availabilityStatus = 'collected';
            item.collectedAt = new Date();
            item.collectedBy = livreurId;
            order.collecteExpireLe = null;
            const actifs = order.items.filter(i => i.availabilityStatus !== 'unavailable');
            const tousCollectes = actifs.length > 0 && actifs.every(i => i.availabilityStatus === 'collected');
            // [MIGRATION GUICHET UNIQUE] passe par transitionner() plutôt
            // que par une écriture directe de order.status.
            const cible = tousCollectes ? 'Ready for Shipment' : 'Collecting';
            const transition = transitionner({ order, vers: cible, acteur: acteurDepuisRequete(req) });
            if (!transition.ok) {
                return res.status(transition.code || 409).json({ success: false, message: transition.message });
            }
            await order.save();
        }

        return res.json({ success: true, order });
    } catch (error) {
        console.error('Erreur collecterArticleLivreur:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const terminerCollecteLivreur = async (req, res) => {
    try {
        const livreurId = req.staffUser._id;
        const { orderId } = req.params;
        const order = await Order.findOne({ _id: orderId, collecteLivreurId: livreurId, status: 'Ready for Shipment' });
        if (!order) return res.status(409).json({ success: false, message: 'Tous les articles disponibles ne sont pas encore collectés.' });
        return res.json({ success: true, message: 'Collecte terminée. Les Opérations peuvent réceptionner le colis.', order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// RÉCEPTION À L'ENTREPÔT — étape 4 du cycle (§5, §7).
//
// §7 : « Opérations réceptionne ; le Super Admin peut intervenir. » C'est
// cette étape qui rend les fonds éligibles à la libération (§8).
//
// Renommée depuis `sellerMarkShipped` : le §0 proscrit le terme « Seller »,
// et « marquer expédié » décrivait mal l'acte réel, qui est une RÉCEPTION.
// L'ancien nom reste exporté plus bas pour les imports existants.
export const receptionnerColis = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });

        const actifs = order.items.filter(i => i.availabilityStatus !== 'unavailable');
        if (!actifs.length || !actifs.every(i => i.availabilityStatus === 'collected')) {
            return res.status(409).json({ success: false, message: 'Tous les articles disponibles doivent être collectés.' });
        }

        const transition = transitionner({
            order,
            vers: 'Shipped',
            acteur: req.staffUser,
            note: 'réception entrepôt',
        });
        if (!transition.ok) {
            return res.status(transition.code || 409).json({
                success: false,
                message: transition.message,
                statutActuel: transition.depuis,
            });
        }

        // [FIX] Sans ceci, la commande devient invisible pour le livreur qui
        // vient de la collecter : getLivraisonsLivreur (onglet "Livraisons")
        // filtre sur `livreurId`, un champ historiquement renseigné par
        // l'assignation manuelle admin (assignerLivreur), jamais par le
        // circuit de collecte qui ne renseigne que `collecteLivreurId`. Sans
        // cette ligne, le colis passe Shipped puis disparaît de tous les
        // écrans livreur — plus personne ne peut le livrer.
        order.shippedAt = new Date();
        order.shippedBy = req.staffUser?._id || null;
        if (!order.livreurId && order.collecteLivreurId) {
            order.livreurId = order.collecteLivreurId;
        }
        await order.save();

        return res.json({ success: true, message: 'Commande reçue en entrepôt et marquée Expédiée.' });
    } catch (error) {
        console.error('Erreur receptionnerColis:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Alias de compatibilité : les routes et scripts existants importent
// encore `sellerMarkShipped`. Migration progressive demandée par le §17.2.
export const sellerMarkShipped = receptionnerColis;

// Opérations : file des commandes dont la collecte est terminée
// (Ready for Shipment) et qui attendent d'être réceptionnées à
// l'entrepôt — c'est l'écran qui manquait : jusqu'ici, la commande
// affichait au livreur « Les Opérations doivent réceptionner le colis »,
// mais aucun écran ne permettait aux Opérations de savoir laquelle
// réceptionner ni de le faire.
export const listCommandesAReceptionner = async (req, res) => {
    try {
        const orders = await Order.find({ status: 'Ready for Shipment' })
            .populate('collecteLivreurId', 'nom email')
            .select('items amount collecteLivreurId collecteReserveeLe createdAt')
            .sort({ collecteReserveeLe: 1 });

        return res.json({ success: true, orders });
    } catch (error) {
        console.error('Erreur listCommandesAReceptionner:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Opérations : confirme avoir physiquement remis le colis au livreur
// assigné, juste avant que celui-ci ne parte livrer. Sans cette étape, un
// livreur pouvait déclarer "En livraison" (updateLivraisonStatus) sur sa
// seule parole, sans qu'aucune confirmation ne prouve qu'il avait
// réellement le colis en main — c'est cette confirmation qui manquait.
export const confirmerRemiseLivreur = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });

        if (order.status !== 'Shipped') {
            return res.status(409).json({
                success: false,
                message: 'La commande doit être au statut Expédiée (reçue à l’entrepôt) avant toute remise au livreur.',
            });
        }
        if (!order.livreurId) {
            return res.status(409).json({
                success: false,
                message: 'Aucun livreur n’est encore assigné à cette commande.',
            });
        }
        if (order.remiseLivreurConfirmee) {
            return res.status(409).json({ success: false, message: 'La remise a déjà été confirmée pour ce livreur.' });
        }

        order.remiseLivreurConfirmee = true;
        order.remiseLivreurConfirmeeLe = new Date();
        await order.save();

        journaliser({
            acteur: acteurVendeurTechnique(),
            action: 'commande.remise_livreur',
            cible: { id: order._id, libelle: `Commande ${order._id.toString().slice(-6).toUpperCase()}` },
            note: `Colis remis physiquement au livreur ${order.livreurId}`,
        });

        return res.json({ success: true, message: 'Remise au livreur confirmée — il peut maintenant partir livrer.', order });
    } catch (error) {
        console.error('Erreur confirmerRemiseLivreur:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Opérations : file des colis Expédiés en attente d'être remis à leur
// livreur — pour construire l'écran "à remettre" côté Opérations.
export const listCommandesARemettre = async (req, res) => {
    try {
        const orders = await Order.find({
            status: 'Shipped',
            remiseLivreurConfirmee: false,
            livreurId: { $ne: null },
        })
            .populate('livreurId', 'nom email')
            .select('items amount livreurId shippedAt createdAt')
            .sort({ shippedAt: 1 });

        return res.json({ success: true, orders });
    } catch (error) {
        console.error('Erreur listCommandesARemettre:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// ✅ PHASE 4 : ASSIGNER UN LIVREUR À UNE COMMANDE (admin)
// =============================================================
// [FIX] Cette fonction était importée et déjà branchée sur la route
// POST /admin/assigner-livreur dans routes/orderRoute.js, mais n'existait
// nulle part dans ce contrôleur : l'import échouait au démarrage
// ("does not provide an export named 'assignerLivreur'"), ce qui empêchait
// le serveur de démarrer, en local comme en production, indépendamment de
// toute base de données. confirmerRemiseLivreur et getLivraisonsLivreur
// supposent déjà Order.livreurId rempli : cette fonction est le seul point
// du code qui est censé le renseigner.
export const assignerLivreur = async (req, res) => {
    try {
        const { orderId, livreurId } = req.body;
        if (!orderId || !livreurId) {
            return res.status(400).json({ success: false, message: "orderId et livreurId sont requis." });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Commande introuvable." });
        }

        // Pas de sens à assigner un livreur à une commande déjà terminée
        // (livrée, retournée, annulée) ou encore non confirmée par l'admin.
        const statutsInterdits = ['Delivered', 'Returned', 'Cancelled', 'pending_payment', 'Order Placed'];
        if (statutsInterdits.includes(order.status)) {
            return res.status(409).json({
                success: false,
                message: `Impossible d'assigner un livreur : la commande est au statut "${order.status}".`,
            });
        }

        const livreur = await StaffUser.findById(livreurId);
        if (!livreur || livreur.role !== 'livreur') {
            return res.status(400).json({ success: false, message: "Ce compte n'est pas un livreur valide." });
        }
        if (livreur.statut !== 'actif') {
            return res.status(409).json({ success: false, message: "Ce livreur n'est pas actif." });
        }

        order.livreurId = livreur._id;
        // Une réassignation annule toute remise déjà confirmée au précédent
        // livreur : le nouveau livreur n'a pas encore le colis en main.
        order.remiseLivreurConfirmee = false;
        order.remiseLivreurConfirmeeLe = null;
        await order.save();

        journaliser({
            acteur: acteurDepuisRequete(req),
            action: 'commande.assignation_livreur',
            cible: { id: order._id, libelle: `Commande ${order._id.toString().slice(-6).toUpperCase()}` },
            note: `Livreur assigné : ${livreur.nom} (${livreur.email})`,
        });

        return res.json({ success: true, message: "Livreur assigné avec succès.", order });
    } catch (error) {
        console.error('Erreur assignerLivreur:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// ✅ PHASE 4 : RÉCUPÉRER LES COMMANDES D'UN LIVREUR
// =============================================================
// ACTIVITÉ D'UN LIVREUR SUR UNE PÉRIODE
//
// Le livreur n'avait qu'une liste brute des 50 dernières commandes closes :
// aucune date, aucun total, et surtout AUCUNE trace de ses collectes — elles
// sont rattachées à `collecteLivreurId`, jamais regardé ici. Il ne pouvait
// donc pas répondre à « qu'est-ce que j'ai fait aujourd'hui ? ».
//
// Deux activités distinctes, comptées séparément parce qu'elles se passent à
// des moments différents de la journée :
//   · les COLLECTES  — il récupère les articles chez les commerçants ;
//   · les LIVRAISONS — il remet le colis au client.
//
// Une commande apparaît dans les deux si c'est le même livreur qui l'a
// collectée puis livrée. C'est voulu : ce sont deux déplacements.
export const getActiviteLivreur = async (req, res) => {
    try {
        const livreurId = req.staffUser._id;

        // Par défaut : aujourd'hui. Les dates arrivent en AAAA-MM-JJ depuis
        // l'écran, on borne la journée entière côté serveur pour éviter les
        // surprises de fuseau.
        const bornerDebut = (valeur) => {
            const d = valeur ? new Date(valeur) : new Date();
            d.setHours(0, 0, 0, 0);
            return d;
        };
        const bornerFin = (valeur) => {
            const d = valeur ? new Date(valeur) : new Date();
            d.setHours(23, 59, 59, 999);
            return d;
        };

        const depuis = bornerDebut(req.query.depuis);
        const jusqu = bornerFin(req.query.jusqu || req.query.depuis);

        if (Number.isNaN(depuis.getTime()) || Number.isNaN(jusqu.getTime())) {
            return res.status(400).json({ success: false, message: 'Dates invalides' });
        }

        // ── Collectes : on date par l'article, pas par la commande ───────
        // `collectedAt` est posé article par article. Une commande dont il
        // n'a récupéré qu'une partie aujourd'hui doit compter pour
        // aujourd'hui, avec ce qu'il a réellement pris.
        const commandesCollectees = await Order.find({
            'items.collectedBy': livreurId,
            'items.collectedAt': { $gte: depuis, $lte: jusqu },
        }).select('items amount address createdAt').populate('address', 'city commune').lean();

        const collectes = commandesCollectees.map((o) => {
            const siens = (o.items || []).filter((i) =>
                String(i.collectedBy || '') === String(livreurId)
                && i.collectedAt >= depuis && i.collectedAt <= jusqu
            );
            return {
                orderId: o._id,
                reference: String(o._id).slice(-6).toUpperCase(),
                articles: siens.length,
                le: siens.reduce((plusRecent, i) => (i.collectedAt > plusRecent ? i.collectedAt : plusRecent), siens[0]?.collectedAt),
                commune: o.address?.commune || null,
            };
        }).filter((c) => c.articles > 0);

        // ── Livraisons : datées par `deliveredAt` ────────────────────────
        const commandesLivrees = await Order.find({
            livreurId,
            status: 'Delivered',
            deliveredAt: { $gte: depuis, $lte: jusqu },
        }).select('amount deliveredAt address').populate('address', 'city commune').lean();

        const livraisons = commandesLivrees.map((o) => ({
            orderId: o._id,
            reference: String(o._id).slice(-6).toUpperCase(),
            montant: o.amount,
            le: o.deliveredAt,
            commune: o.address?.commune || null,
        }));

        // ── Retours constatés sur la période ─────────────────────────────
        const retours = await Order.countDocuments({
            livreurId,
            status: 'Returned',
            retourTraiteLe: { $gte: depuis, $lte: jusqu },
        });

        // ── Regroupement par jour, pour l'affichage ──────────────────────
        // Sur une période d'une semaine, une liste à plat de 40 lignes est
        // illisible ; par journée, il retrouve ce qu'il a fait mardi.
        const parJour = {};
        const ajouter = (date, champ) => {
            if (!date) return;
            const jour = new Date(date).toISOString().slice(0, 10);
            parJour[jour] = parJour[jour] || { jour, collectes: 0, livraisons: 0 };
            parJour[jour][champ] += 1;
        };
        collectes.forEach((c) => ajouter(c.le, 'collectes'));
        livraisons.forEach((l) => ajouter(l.le, 'livraisons'));

        return res.json({
            success: true,
            periode: { depuis, jusqu },
            resume: {
                collectes: collectes.length,
                articlesCollectes: collectes.reduce((n, c) => n + c.articles, 0),
                livraisons: livraisons.length,
                // Le montant encaissé compte pour lui : c'est ce qu'il a
                // remis, et ce qu'on peut lui demander de justifier.
                montantLivre: livraisons.reduce((n, l) => n + (l.montant || 0), 0),
                retours,
            },
            parJour: Object.values(parJour).sort((a, b) => b.jour.localeCompare(a.jour)),
            collectes: collectes.sort((a, b) => new Date(b.le) - new Date(a.le)),
            livraisons: livraisons.sort((a, b) => new Date(b.le) - new Date(a.le)),
        });
    } catch (error) {
        console.error('Erreur getActiviteLivreur:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

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
// [MIGRATION GUICHET UNIQUE] Cette fonction écrivait le statut avec un
// findByIdAndUpdate direct, en dehors du guichet unique — passé inaperçu
// jusqu'ici car la vérification qui cherchait ces écritures ne couvrait
// pas cette variante précise de la méthode Mongo. Conséquence concrète :
// "En livraison" et "Livrée", déclenchés par le livreur, n'étaient
// JAMAIS journalisés — aucune trace de qui avait fait quoi, quand.
// Les deux conditions métier propres à cette route (remise confirmée par
// les Opérations avant "En livraison" ; passage obligé par "En livraison"
// avant "Livrée") sont conservées, désormais via filtreConcurrence/depuis.
// =============================================================
export const updateLivraisonStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const livreurId = req.staffUser._id;

        const validStatuses = ['Out for Delivery', 'Delivered'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Statut invalide pour un livreur" });
        }

        const filtreConcurrence = { livreurId };
        const champsSupplementaires = {};
        let depuis;

        if (status === 'Out for Delivery') {
            depuis = 'Shipped';
            // Le livreur ne peut pas déclarer "En livraison" sur sa seule
            // parole : il faut que les Opérations aient confirmé la remise
            // physique du colis (voir confirmerRemiseLivreur).
            filtreConcurrence.remiseLivreurConfirmee = true;
        } else {
            depuis = 'Out for Delivery';
            champsSupplementaires.deliveredAt = new Date();
        }

        const resultat = await transitionnerAtomique({
            Order,
            orderId,
            vers: status,
            depuis,
            filtreConcurrence,
            champsSupplementaires,
            acteur: acteurDepuisStaff(req.staffUser),
            note: status === 'Out for Delivery' ? 'départ en livraison' : 'livraison confirmée par le livreur',
        });

        if (!resultat.ok) {
            const message = status === 'Out for Delivery'
                ? "La commande n'est pas (ou plus) au statut Expédiée, ou les Opérations n'ont pas encore confirmé vous avoir remis ce colis."
                : "La commande doit d'abord être passée à 'En livraison'.";
            return res.status(resultat.code || 409).json({ success: false, message });
        }

        const pushContent = orderStatusPushMessages[status];
        if (pushContent) {
            sendPushToUser(resultat.avant.userId, {
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
        if (order.retourEtat === 'endommage') {
            return { cle: 'retournee', libelle: 'Retournée — article endommagé', ton: 'neutre' };
        }
        return { cle: 'retournee', libelle: 'Retournée — remise en stock', ton: 'neutre' };
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
                // [FIX] itemId et availabilityStatus manquaient ici : sans eux,
                // Commandes.jsx (côté client) ne peut pas construire la liste
                // availableItemIds/unavailableItemIds attendue par
                // /commercant/disponibilite (chaque itemId valait "undefined"),
                // et le badge de disponibilité restait bloqué sur "À vérifier".
                articles: mesArticles.map((item) => ({
                    itemId: item._id,
                    availabilityStatus: item.availabilityStatus,
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
                retourEtat: order.retourEtat || null,
                retourNote: order.retourNote || null,
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
        const { orderId, available = true, reason = '' } = req.body;
        const boutiqueId = req.staffUser.boutiqueId;

        if (!boutiqueId) {
            return res.status(400).json({ success: false, message: 'Aucune boutique associée à ce compte' });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

        const itemsBoutique = (order.items || []).filter(
            item => item.boutiqueId?.toString() === boutiqueId.toString()
        );
        if (!itemsBoutique.length) {
            return res.status(403).json({ success: false, message: "Cette commande ne concerne pas votre boutique" });
        }

        // Une boutique répond une seule fois. Le choix est enregistré article
        // par article pour permettre les commandes multi-boutiques et les
        // indisponibilités partielles.
        const now = new Date();
        const newlyUnavailable = [];
        for (const item of itemsBoutique) {
            if (item.availabilityStatus && item.availabilityStatus !== 'pending') continue;
            item.availabilityStatus = available ? 'available' : 'unavailable';
            item.unavailableReason = available ? null : String(reason || 'Article indisponible').slice(0, 300);
            if (!available) newlyUnavailable.push(item);
        }

        if (!available) {
            // L'article avait été réservé au moment de la commande. On rend
            // son stock disponible à nouveau, une seule fois, avant de le
            // retirer du panier financier.
            const products = await Product.find({
                _id: { $in: newlyUnavailable.map(i => i.product) }
            });
            for (const item of newlyUnavailable) {
                const product = products.find(p => p._id.toString() === item.product.toString());
                if (!product) continue;
                if (product.variants?.length) {
                    const variant = product.variants.find(v =>
                        (item.color == null ? v.color == null : v.color === item.color) &&
                        (item.size == null ? v.size == null : v.size === item.size)
                    );
                    if (variant) {
                        variant.stock = Number(variant.stock || 0) + Number(item.quantity || 0);
                        product.inStock = product.variants.some(v => Number(v.stock || 0) > 0);
                        await product.save();
                    }
                } else if (product.stock !== null && product.stock !== undefined) {
                    product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
                    product.inStock = product.stock > 0;
                    await product.save();
                }
            }

            // Le montant client est diminué. Pour une commande déjà payée,
            // on crée un crédit client interne plutôt qu'un payout automatique.
            const refund = itemsBoutique
                .filter(i => i.availabilityStatus === 'unavailable')
                .reduce((sum, i) => sum + (Number(i.priceAtOrder) || 0) * (Number(i.quantity) || 0), 0);
            const refundWithTax = Math.floor(refund * 1.02);
            order.amount = Math.max(0, Number(order.amount || 0) - refundWithTax);
            order.refundDue = Number(order.refundDue || 0) + refundWithTax;

            if (order.isPaid && refundWithTax > 0) {
                let credited = 0;
                for (const item of newlyUnavailable) {
                    const lineRefund = Math.floor((Number(item.priceAtOrder) || 0) * (Number(item.quantity) || 0) * 1.02);
                    if (lineRefund <= 0) continue;
                    const ok = await crediterClient({
                        userId: order.userId,
                        orderId: order._id,
                        itemId: item._id,
                        amount: lineRefund,
                        description: `Article indisponible — commande ${order._id}`
                    });
                    if (ok) credited += lineRefund;
                }
                if (credited > 0) order.refundCreditedAt = now;
            }
        }

        const allResponded = (order.items || [])
            .filter(i => i.boutiqueId)
            .every(i => i.availabilityStatus !== 'pending');

        const dejaConfirmation = (order.confirmationsBoutiques || []).some(
            c => c.boutiqueId?.toString() === boutiqueId.toString()
        );
        if (!dejaConfirmation) {
            order.confirmationsBoutiques.push({
                boutiqueId,
                confirmePar: req.staffUser._id,
                confirmeParNom: req.staffUser.nom || req.staffUser.email || 'Commerçant',
                confirmeLe: now,
            });
        }

        // Les produits du catalogue principal n'ont pas de commerçant à
        // confirmer. Une fois toutes les boutiques concernées décidées, la
        // commande devient automatiquement Confirmed.
        // [MIGRATION GUICHET UNIQUE] les deux écritures directes de
        // order.status passent désormais par transitionner().
        const acteur = acteurDepuisStaff(req.staffUser);
        if (allResponded) {
            const transition = transitionner({ order, vers: 'Confirmed', acteur, note: 'toutes les boutiques ont répondu' });
            if (!transition.ok) {
                return res.status(transition.code || 409).json({ success: false, message: transition.message });
            }
            order.confirmedAt = now;

            // Le crédit en attente n'est créé qu'à ce moment : uniquement
            // pour les articles réellement disponibles.
            await order.save();
            await crediterVenteEnAttente(order);
        } else {
            const transition = transitionner({ order, vers: 'Checking Availability', acteur, note: 'en attente d\'autres boutiques' });
            if (!transition.ok) {
                return res.status(transition.code || 409).json({ success: false, message: transition.message });
            }
            await order.save();
        }

        return res.json({
            success: true,
            message: available ? 'Disponibilité confirmée' : 'Article marqué indisponible',
            toutesConfirmees: allResponded,
            status: order.status,
            refundDue: order.refundDue || 0,
        });
    } catch (error) {
        console.error('Erreur confirmerCommandeCommercant:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/order/commercant/disponibilite — Commerçant
//
// [FIX] Le frontend (Commandes.jsx) a été mis à jour pour envoyer la
// disponibilité article par article (availableItemIds / unavailableItemIds),
// conformément à la nouvelle doc, mais aucune route/contrôleur ne
// répondait à '/commercant/disponibilite' : chaque clic renvoyait un 404 et
// aucune commande ne pouvait plus jamais passer 'Checking Availability' →
// 'Confirmed'. Reprend exactement la logique déjà éprouvée de
// confirmerCommandeCommercant (restock, remboursement/crédit, transition
// automatique), simplement pilotée par article plutôt que par un booléen
// unique pour toute la boutique.
export const confirmerDisponibiliteCommercant = async (req, res) => {
    try {
        const { orderId, availableItemIds = [], unavailableItemIds = [], reason = '' } = req.body;
        const boutiqueId = req.staffUser.boutiqueId;

        if (!boutiqueId) {
            return res.status(400).json({ success: false, message: 'Aucune boutique associée à ce compte' });
        }
        if (!availableItemIds.length && !unavailableItemIds.length) {
            return res.status(400).json({ success: false, message: 'Indiquez la disponibilité des articles' });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

        const itemsBoutique = (order.items || []).filter(
            item => item.boutiqueId?.toString() === boutiqueId.toString()
        );
        if (!itemsBoutique.length) {
            return res.status(403).json({ success: false, message: "Cette commande ne concerne pas votre boutique" });
        }

        const unavailableSet = new Set(unavailableItemIds.map(String));
        const now = new Date();
        const newlyUnavailable = [];
        for (const item of itemsBoutique) {
            if (item.availabilityStatus && item.availabilityStatus !== 'pending') continue;
            const id = item._id.toString();
            if (!unavailableSet.has(id) && !availableItemIds.map(String).includes(id)) continue;
            item.availabilityStatus = unavailableSet.has(id) ? 'unavailable' : 'available';
            item.unavailableReason = unavailableSet.has(id) ? String(reason || 'Article indisponible').slice(0, 300) : null;
            if (item.availabilityStatus === 'unavailable') newlyUnavailable.push(item);
        }

        if (newlyUnavailable.length) {
            const products = await Product.find({ _id: { $in: newlyUnavailable.map(i => i.product) } });
            for (const item of newlyUnavailable) {
                const product = products.find(p => p._id.toString() === item.product.toString());
                if (!product) continue;
                if (product.variants?.length) {
                    const variant = product.variants.find(v =>
                        (item.color == null ? v.color == null : v.color === item.color) &&
                        (item.size == null ? v.size == null : v.size === item.size)
                    );
                    if (variant) {
                        variant.stock = Number(variant.stock || 0) + Number(item.quantity || 0);
                        product.inStock = product.variants.some(v => Number(v.stock || 0) > 0);
                        await product.save();
                    }
                } else if (product.stock !== null && product.stock !== undefined) {
                    product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
                    product.inStock = product.stock > 0;
                    await product.save();
                }
            }

            const refund = newlyUnavailable.reduce((sum, i) => sum + (Number(i.priceAtOrder) || 0) * (Number(i.quantity) || 0), 0);
            const refundWithTax = Math.floor(refund * 1.02);
            order.amount = Math.max(0, Number(order.amount || 0) - refundWithTax);
            order.refundDue = Number(order.refundDue || 0) + refundWithTax;

            if (order.isPaid && refundWithTax > 0) {
                let credited = 0;
                for (const item of newlyUnavailable) {
                    const lineRefund = Math.floor((Number(item.priceAtOrder) || 0) * (Number(item.quantity) || 0) * 1.02);
                    if (lineRefund <= 0) continue;
                    const ok = await crediterClient({
                        userId: order.userId,
                        orderId: order._id,
                        itemId: item._id,
                        amount: lineRefund,
                        description: `Article indisponible — commande ${order._id}`
                    });
                    if (ok) credited += lineRefund;
                }
                if (credited > 0) order.refundCreditedAt = now;
            }
        }

        const allResponded = (order.items || [])
            .filter(i => i.boutiqueId)
            .every(i => i.availabilityStatus !== 'pending');

        const dejaConfirmation = (order.confirmationsBoutiques || []).some(
            c => c.boutiqueId?.toString() === boutiqueId.toString()
        );
        if (!dejaConfirmation) {
            order.confirmationsBoutiques.push({
                boutiqueId,
                confirmePar: req.staffUser._id,
                confirmeParNom: req.staffUser.nom || req.staffUser.email || 'Commerçant',
                confirmeLe: now,
            });
        }

        // [MIGRATION GUICHET UNIQUE] les deux écritures directes de
        // order.status passent désormais par transitionner().
        const acteurDisponibilite = acteurDepuisStaff(req.staffUser);
        if (allResponded) {
            const transition = transitionner({ order, vers: 'Confirmed', acteur: acteurDisponibilite, note: 'toutes les boutiques ont répondu' });
            if (!transition.ok) {
                return res.status(transition.code || 409).json({ success: false, message: transition.message });
            }
            order.confirmedAt = now;
            await order.save();
            await crediterVenteEnAttente(order);
        } else {
            const transition = transitionner({ order, vers: 'Checking Availability', acteur: acteurDisponibilite, note: 'en attente d\'autres boutiques' });
            if (!transition.ok) {
                return res.status(transition.code || 409).json({ success: false, message: transition.message });
            }
            await order.save();
        }

        return res.json({
            success: true,
            message: allResponded ? 'Disponibilité enregistrée — commande confirmée' : 'Disponibilité enregistrée',
            toutesConfirmees: allResponded,
            status: order.status,
            refundDue: order.refundDue || 0,
        });
    } catch (error) {
        console.error('Erreur confirmerDisponibiliteCommercant:', error.message);
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
            status: 'Shipped',
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
        const { orderId } = req.body;
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

        // [RAMCI §8, §15] Règle unique d'éligibilité — voir
        // services/fundsReleaseService.js. Ces quatre contrôles (déjà
        // libéré, litige, réception, confirmations manquantes) étaient
        // recopiés ici en partie seulement : les confirmations boutique
        // n'étaient pas vérifiées à ce niveau.
        const eligibilite = evaluerEligibilite(order);
        if (!eligibilite.eligible) {
            return res.status(409).json({
                success: false,
                message: eligibilite.message,
                motif: eligibilite.motif,
            });
        }

        order.confirmeParAdminLe = new Date();
        order.confirmeParAdmin = req.staffUser._id;
        await order.save();

        const resultat = await libererFonds(order);

        // [NOUVEAU] doc §15 : action Admin sensible — journalisée.
        journaliser({
            acteur: acteurDepuisStaff(req.staffUser),
            action: 'commande.liberation',
            cible: { id: order._id, libelle: `Commande ${order._id.toString().slice(-6).toUpperCase()}` },
            note: `${resultat.liberees} boutique(s) créditée(s), ${resultat.montantTotal} FCFA libérés`,
        });

        return res.json({
            success: true,
            message: resultat.liberees > 0
                ? `Fonds libérés pour ${resultat.liberees} boutique(s)`
                : 'Aucun fonds commerçant à libérer',
            boutiquesCreditees: resultat.liberees,
            montantLibere: resultat.montantTotal,
        });
    } catch (error) {
        console.error('Erreur confirmerCommandeAdmin:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ══════════════════════════════════════════════════════════════════════
//  LITIGES (doc §15)
// ══════════════════════════════════════════════════════════════════════
//
// Un litige déclaré AVANT la libération financière bloque explicitement
// cette libération (voir confirmerCommandeAdmin) et interrompt le statut
// logistique affiché ('Disputed'), restauré tel quel à la résolution. Un
// litige déclaré APRÈS libération ne peut plus rien bloquer — il ne peut
// que créer une retenue (dette commerçant) ou un remboursement client
// exceptionnel, sans jamais réécrire l'historique déjà écrit.

const STATUTS_TERMINAUX = ['Delivered', 'Cancelled', 'Returned', 'Disputed'];

// POST /api/order/admin/litige/declarer — Admin
export const declarerLitige = async (req, res) => {
    try {
        const { orderId, raison } = req.body;
        if (!String(raison || '').trim()) {
            return res.status(400).json({ success: false, message: 'La raison du litige est obligatoire' });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

        if (order.litige?.enCours) {
            return res.status(409).json({ success: false, message: 'Un litige est déjà en cours sur cette commande' });
        }

        const dejaLiberee = Boolean(order.confirmeParAdminLe);
        // On n'interrompt le statut logistique que s'il y a réellement
        // quelque chose à interrompre : une commande déjà livrée/annulée/
        // retournée garde son statut final, le litige reste une annotation.
        const doitInterrompreStatut = !dejaLiberee && !STATUTS_TERMINAUX.includes(order.status);

        order.litige = {
            enCours: true,
            raison: String(raison).trim().slice(0, 500),
            declarePar: req.staffUser._id,
            declareParNom: req.staffUser.nom || req.staffUser.email || 'Admin',
            declareLe: new Date(),
            statutAvant: doitInterrompreStatut ? order.status : null,
            resoluLe: null,
            resoluPar: null,
            resolution: null,
            note: null,
        };
        if (doitInterrompreStatut) {
            order.status = 'Disputed';
        }
        await order.save();

        journaliser({
            acteur: acteurDepuisStaff(req.staffUser),
            action: 'commande.litige_declare',
            cible: { id: order._id, libelle: `Commande ${order._id.toString().slice(-6).toUpperCase()}` },
            note: `${dejaLiberee ? 'Litige après libération' : 'Litige avant libération (bloque)'} — ${raison}`,
        });

        return res.json({
            success: true,
            message: 'Litige déclaré',
            bloqueLiberation: !dejaLiberee,
            order,
        });
    } catch (error) {
        console.error('Erreur declarerLitige:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/order/admin/litige/resoudre — Admin
//
// resolution:
//   'classe'                — sans suite, aucun mouvement d'argent
//   'dette_commercant'      — retenue sur le portefeuille (boutiqueId + montant requis)
//   'remboursement_client'  — RCOINS exceptionnels (montant requis)
export const resoudreLitige = async (req, res) => {
    try {
        const { orderId, resolution, boutiqueId, montant, note } = req.body;
        const RESOLUTIONS_VALIDES = ['classe', 'dette_commercant', 'remboursement_client'];
        if (!RESOLUTIONS_VALIDES.includes(resolution)) {
            return res.status(400).json({ success: false, message: 'Résolution invalide' });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
        if (!order.litige?.enCours) {
            return res.status(409).json({ success: false, message: 'Aucun litige en cours sur cette commande' });
        }

        if (resolution === 'dette_commercant') {
            if (!boutiqueId || !(Number(montant) > 0)) {
                return res.status(400).json({
                    success: false,
                    message: 'boutiqueId et montant sont requis pour créer une dette commerçant',
                });
            }
            // [CORRECTIF AUDIT — 23 août 2026] acteur n'était pas transmis :
            // la WalletTransaction créée par ajusterPortefeuille gardait un
            // creePar à null, alors que la fonction accepte ce paramètre
            // (voir walletService.js) — contraire à la précision v3.1 du
            // §3.3, qui exige un auteur sur les DEUX voies d'ajustement
            // manuel (adminAjustement ET ajusterPortefeuille via litige).
            await ajusterPortefeuille({
                boutiqueId,
                montant: -Math.abs(Math.round(Number(montant))),
                description: `Litige — retenue (commande ${order._id})`,
                orderId: order._id,
                acteur: acteurDepuisStaff(req.staffUser),
                motif: `Litige commande ${order._id} — ${note || 'retenue décidée par un administrateur'}`,
            });
        }

        if (resolution === 'remboursement_client') {
            const montantRembourse = Math.round(Number(montant) || 0);
            if (montantRembourse <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Un montant positif est requis pour un remboursement client',
                });
            }

            // [CORRECTIF AUDIT — 23 août 2026] Garde-fou d'exclusivité
            // symétrique à celui de refundController.createRefund — voir
            // ce fichier pour la justification complète (§24 du cahier des
            // charges).
            const refundMonetaireExistant = await Refund.findOne({
                orderId: order._id,
                statut: { $nin: ['rejected', 'failed'] },
            });
            if (refundMonetaireExistant) {
                return res.status(409).json({
                    success: false,
                    message: "Cette commande a déjà un remboursement monétaire en cours ou terminé. Un crédit RCOINS sur la même commande est exclu.",
                });
            }

            // Remboursement exceptionnel hors circuit article par article
            // (doc §6 : « l'Admin peut aussi traiter un remboursement
            // externe exceptionnel si le client le demande »), crédité en
            // RCOINS. itemId généré : ce crédit n'est rattaché à aucune
            // ligne précise.
            await CustomerCreditTransaction.create({
                userId: order.userId,
                orderId: order._id,
                itemId: new mongoose.Types.ObjectId(),
                type: 'credit',
                amount: montantRembourse,
                description: `Remboursement exceptionnel — litige (commande ${order._id})`,
            });
            await User.findByIdAndUpdate(order.userId, { $inc: { creditBalance: montantRembourse } });
        }

        order.litige.enCours = false;
        order.litige.resoluLe = new Date();
        order.litige.resoluPar = req.staffUser._id;
        order.litige.resolution = resolution;
        if (note) order.litige.note = String(note).trim().slice(0, 500);

        // Restaure le statut logistique interrompu par le litige, s'il y en
        // avait un. Sans quoi la commande resterait bloquée sur 'Disputed'
        // même une fois le litige réglé.
        if (order.status === 'Disputed' && order.litige.statutAvant) {
            order.status = order.litige.statutAvant;
        }
        await order.save();

        journaliser({
            acteur: acteurDepuisStaff(req.staffUser),
            action: 'commande.litige_resolu',
            cible: { id: order._id, libelle: `Commande ${order._id.toString().slice(-6).toUpperCase()}` },
            note: `Résolution : ${resolution}${montant ? ` — ${montant} FCFA` : ''}${note ? ` — ${note}` : ''}`,
        });

        return res.json({ success: true, message: 'Litige résolu', order });
    } catch (error) {
        console.error('Erreur resoudreLitige:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/order/admin/litiges — Admin
// ?enCours=false pour l'historique des litiges déjà résolus.
export const listLitiges = async (req, res) => {
    try {
        const filtre = req.query.enCours === 'false'
            ? { 'litige.declareLe': { $ne: null }, 'litige.enCours': false }
            : { 'litige.enCours': true };

        const orders = await Order.find(filtre)
            .sort({ 'litige.declareLe': -1 })
            .limit(100)
            .select('items amount status litige createdAt')
            .lean();

        return res.json({ success: true, litiges: orders });
    } catch (error) {
        console.error('Erreur listLitiges:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};