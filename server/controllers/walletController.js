import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import DemandeRetrait from '../models/DemandeRetrait.js';

// ------------------------------------------------------------------ //
// GET /api/wallet/moi — Consulter son portefeuille
// ------------------------------------------------------------------ //
export const getMyWallet = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ ownerId: req.staffUser._id });
        if (!wallet) {
            // Créer le wallet si inexistant
            wallet = await Wallet.create({
                ownerId: req.staffUser._id,
                solde: 0,
            });
        }

        // Recalculer le solde pour être sûr
        await wallet.recalculerSolde();

        return res.status(200).json({
            success: true,
            wallet: {
                _id: wallet._id,
                solde: wallet.solde,
                ownerId: wallet.ownerId,
                createdAt: wallet.createdAt,
            }
        });
    } catch (error) {
        console.error('Erreur getMyWallet:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/wallet/moi/transactions — Historique des transactions
// ------------------------------------------------------------------ //
export const getMyTransactions = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ ownerId: req.staffUser._id });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Portefeuille non trouvé' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const transactions = await WalletTransaction.find({ walletId: wallet._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('orderId', 'amount status');

        const total = await WalletTransaction.countDocuments({ walletId: wallet._id });

        return res.status(200).json({
            success: true,
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        console.error('Erreur getMyTransactions:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/wallet/admin/:commercialId — Admin : voir wallet d'un commercial
// ------------------------------------------------------------------ //
export const getWalletByCommercial = async (req, res) => {
    try {
        const { commercialId } = req.params;

        const wallet = await Wallet.findOne({ ownerId: commercialId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Portefeuille non trouvé' });
        }

        await wallet.recalculerSolde();

        return res.status(200).json({
            success: true,
            wallet
        });
    } catch (error) {
        console.error('Erreur getWalletByCommercial:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// POST /api/wallet/admin/ajustement — Admin : ajuster manuellement
// (utilisé en cas d'erreur, tracé via transactions)
// ------------------------------------------------------------------ //
export const adminAjustement = async (req, res) => {
    try {
        const { commercialId, montant, description } = req.body;

        if (!commercialId || !montant || !description) {
            return res.status(400).json({ success: false, message: 'Données manquantes' });
        }

        const wallet = await Wallet.findOne({ ownerId: commercialId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Portefeuille non trouvé' });
        }

        // Créer la transaction
        const transaction = await WalletTransaction.create({
            walletId: wallet._id,
            type: 'ajustement',
            montant: montant,
            description: `Ajustement admin : ${description}`,
        });

        // Recalculer le solde
        await wallet.recalculerSolde();

        return res.status(200).json({
            success: true,
            message: 'Ajustement effectué',
            wallet,
            transaction
        });
    } catch (error) {
        console.error('Erreur adminAjustement:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};