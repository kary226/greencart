import User from '../models/User.js';
import CustomerCreditTransaction from '../models/CustomerCreditTransaction.js';

// =============================================================
// SOLDES CLIENTS (RCOINS)
// GET /api/admin/rcoins
// =============================================================
export const listRcoinsBalances = async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const filter = { creditBalance: { $gt: 0 } };
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const users = await User.find(filter)
            .select('name email phone creditBalance')
            .sort({ creditBalance: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        const total = await User.countDocuments(filter);
        const totalBalanceAgg = await User.aggregate([
            { $match: { creditBalance: { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: '$creditBalance' } } },
        ]);
        return res.status(200).json({
            success: true,
            balances: users,
            totalEnCirculation: totalBalanceAgg[0]?.total || 0,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Erreur listRcoinsBalances:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// TRANSACTIONS RCOINS
// GET /api/admin/rcoins/transactions
// =============================================================
export const listRcoinsTransactions = async (req, res) => {
    try {
        const { type, userId, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (type) filter.type = type;
        if (userId) filter.userId = userId;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const transactions = await CustomerCreditTransaction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'name email')
            .populate('orderId', '_id amount status');
        const total = await CustomerCreditTransaction.countDocuments(filter);
        return res.status(200).json({
            success: true,
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Erreur listRcoinsTransactions:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};