import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";
import CustomerCreditTransaction from "../models/CustomerCreditTransaction.js";

export const crediterClient = async ({ userId, orderId, itemId, amount, description }) => {
    if (!userId || !orderId || !itemId || Number(amount) <= 0) return false;
    try {
        await CustomerCreditTransaction.create({
            userId, orderId, itemId, type: 'credit',
            amount: Number(amount), description: description || 'RCOINS'
        });
    } catch (e) {
        if (e?.code === 11000) return false;
        throw e;
    }
    await User.findByIdAndUpdate(userId, { $inc: { creditBalance: Number(amount) } });
    return true;
};

// Débite des RCOINS du solde client au moment où il les utilise pour payer
// une commande (en tout ou partie). `amount` est le montant demandé côté
// client — on le recalcule/plafonne ici avec le solde réel en base pour ne
// jamais faire passer le solde en négatif, même en cas de double-appel ou de
// requête modifiée côté client. Retourne le montant réellement débité (peut
// être inférieur à `amount` demandé, ou 0 si le client n'a pas de crédit).
export const debiterClient = async ({ userId, orderId, itemId, amount, description }) => {
    if (!userId || !orderId || !itemId || Number(amount) <= 0) return 0;
    const user = await User.findById(userId).select('creditBalance');
    const solde = Number(user?.creditBalance || 0);
    const montant = Math.min(solde, Math.floor(Number(amount)));
    if (montant <= 0) return 0;
    try {
        await CustomerCreditTransaction.create({
            userId, orderId, itemId, type: 'debit',
            amount: montant, description: description || 'Utilisation RCOINS'
        });
    } catch (e) {
        if (e?.code === 11000) return 0;
        throw e;
    }
    await User.findByIdAndUpdate(userId, { $inc: { creditBalance: -montant } });
    return montant;
};

// Rembourse les RCOINS d'une commande qui n'aboutira jamais (annulée par le
// client avant paiement, ou paiement Jèko revenu en échec). Appelée depuis
// deux chemins différents (POST /order/cancel et le webhook Jèko) qui
// peuvent tous les deux tenter le remboursement pour la même commande —
// `creditRefundedAt` sert de verrou atomique : le findOneAndUpdate ne
// réussit que pour le premier appel, l'autre repart avec `order: null` et
// ne fait rien. Retourne le montant remboursé (0 si rien à rembourser ou si
// déjà fait).
export const rembourserCreditAnnulation = async ({ orderId, userId, description }) => {
    if (!orderId) return 0;
    const order = await Order.findOneAndUpdate(
        { _id: orderId, creditUsed: { $gt: 0 }, creditRefundedAt: null },
        { $set: { creditRefundedAt: new Date() } }
    );
    if (!order) return 0;
    await crediterClient({
        userId: userId || order.userId,
        orderId: order._id,
        itemId: new mongoose.Types.ObjectId(),
        amount: order.creditUsed,
        description: description || `Remboursement RCOINS — commande ${order._id} annulée`
    });
    return order.creditUsed;
};