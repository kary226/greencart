import User from "../models/User.js";
import CustomerCreditTransaction from "../models/CustomerCreditTransaction.js";

export const crediterClient = async ({ userId, orderId, itemId, amount, description }) => {
    if (!userId || !orderId || !itemId || Number(amount) <= 0) return false;
    try {
        await CustomerCreditTransaction.create({
            userId, orderId, itemId, type: 'credit',
            amount: Number(amount), description: description || 'Crédit GreenCart'
        });
    } catch (e) {
        if (e?.code === 11000) return false;
        throw e;
    }
    await User.findByIdAndUpdate(userId, { $inc: { creditBalance: Number(amount) } });
    return true;
};
