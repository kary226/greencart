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

export const NATURE_REMBOURSEMENT_ORIGINE = 'remboursement_moyen_origine';

// Combien de RCOINS peut-on encore reprendre sur cette commande ?
// = RCOINS crédités sur la commande − RCOINS déjà repris pour un
// remboursement par moyen d'origine. Les débits d'« utilisation » (client
// qui paie avec ses RCOINS) ne comptent pas : ce n'est pas une reprise.
export const evaluerRepriseRcoins = async ({ userId, orderId, amount }) => {
    const montant = Math.floor(Number(amount));
    const lignes = await CustomerCreditTransaction.find({
        orderId,
        $or: [{ type: 'credit' }, { type: 'debit', nature: NATURE_REMBOURSEMENT_ORIGINE }],
    }).select('type amount').lean();

    const credites = lignes.filter((l) => l.type === 'credit').reduce((s, l) => s + l.amount, 0);
    const repris = lignes.filter((l) => l.type === 'debit').reduce((s, l) => s + l.amount, 0);
    const reprenable = Math.max(0, credites - repris);

    // Aucun RCOINS n'a été versé sur cette commande : rien à reprendre, le
    // remboursement par moyen d'origine se fait seul (comportement historique).
    if (credites <= 0) return { ok: true, aReprendre: false, reprenable: 0, montant };

    if (montant > reprenable) {
        return {
            ok: false,
            code: 'plafond',
            reprenable,
            message: reprenable > 0
                ? `Cette commande a déjà été remboursée en RCOINS : au plus ${reprenable} FCFA peuvent encore l'être par moyen d'origine (montant demandé : ${montant} FCFA).`
                : "Les RCOINS versés sur cette commande ont déjà tous été repris : plus rien à rembourser par moyen d'origine.",
        };
    }

    const user = await User.findById(userId).select('creditBalance');
    const solde = Number(user?.creditBalance || 0);
    if (solde < montant) {
        return {
            ok: false,
            code: 'solde_insuffisant',
            reprenable,
            message: `Le client n'a plus que ${solde} RCOINS (il a déjà utilisé le reste) : impossible de reprendre ${montant} FCFA de RCOINS pour rembourser par moyen d'origine.`,
        };
    }
    return { ok: true, aReprendre: true, reprenable, montant };
};

// Remboursement par moyen d'origine sur une commande déjà créditée en
// RCOINS : on REPREND les RCOINS du même montant, pour que le client ne
// soit pas payé deux fois, et la ligne d'historique porte la mention
// « remboursement par moyen d'origine ».
//
// Idempotent : itemId = id du remboursement, donc l'index unique
// (orderId, itemId, type) interdit une seconde reprise pour le même
// remboursement. Le solde est débité de façon atomique, avec la condition
// « solde >= montant », pour ne jamais passer en négatif même si le client
// dépense ses RCOINS au même instant.
export const reprendreRcoinsRemboursementOrigine = async ({ userId, orderId, refundId, amount, description }) => {
    const evaluation = await evaluerRepriseRcoins({ userId, orderId, amount });
    if (!evaluation.ok) return evaluation;
    if (!evaluation.aReprendre) return { ok: true, repris: 0 };

    const montant = evaluation.montant;
    const debite = await User.findOneAndUpdate(
        { _id: userId, creditBalance: { $gte: montant } },
        { $inc: { creditBalance: -montant } },
    );
    if (!debite) {
        return {
            ok: false,
            code: 'solde_insuffisant',
            message: `Le solde RCOINS du client a changé : impossible de reprendre ${montant} FCFA.`,
        };
    }

    try {
        await CustomerCreditTransaction.create({
            userId, orderId, itemId: refundId, type: 'debit', amount: montant,
            nature: NATURE_REMBOURSEMENT_ORIGINE,
            description: description || `Remboursement par moyen d'origine — RCOINS repris (commande ${orderId})`,
        });
    } catch (e) {
        // On a débité le solde mais la ligne n'a pas pu être écrite : on
        // rend les RCOINS, sinon le solde bougerait sans trace.
        await User.findByIdAndUpdate(userId, { $inc: { creditBalance: montant } });
        if (e?.code === 11000) return { ok: true, repris: 0, dejaFait: true };
        throw e;
    }
    return { ok: true, repris: montant };
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

// Rembourse le client quand son colis revient en 'Returned' — jusqu'ici
// traiterRetourColis() (walletService.js) reprenait l'argent du commerçant
// mais ne rendait jamais rien au client : il payait un article qu'il n'a
// finalement pas reçu.
//
// On rembourse la valeur des ARTICLES (montant total - frais de livraison) :
// la livraison a réellement eu lieu (aller ET retour), elle n'est donc pas
// remboursée. Le remboursement est toujours en RCOINS (CustomerCredit),
// quel que soit le moyen de paiement d'origine (COD ou Jèko) : c'est déjà
// ainsi que le reste de la plateforme gère les remboursements (voir
// rembourserCreditAnnulation ci-dessus), faute d'intégration de
// remboursement direct sur le moyen de paiement d'origine.
//
// Idempotent SANS champ verrou supplémentaire sur Order : l'ID de la
// commande sert lui-même d'itemId. L'index unique (orderId, itemId, type)
// de CustomerCreditTransaction empêche alors tout doublon, même si cette
// fonction est appelée deux fois pour la même commande (retry, double
// clic admin, etc.).
export const rembourserClientRetour = async ({ order, description } = {}) => {
    if (!order?._id || !order?.userId) return 0;

    const montant = Math.max(0, Math.floor(Number(order.amount || 0) - Number(order.deliveryPrice || 0)));
    if (montant <= 0) return 0;

    const credite = await crediterClient({
        userId: order.userId,
        orderId: order._id,
        itemId: order._id,
        amount: montant,
        description: description || `Remboursement RCOINS — colis retourné (commande ${order._id})`,
    });

    return credite ? montant : 0;
};