import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import { journaliser } from '../services/journalService.js';

// GET /api/wallet/moi — Consulter son portefeuille
export const getMyWallet = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ ownerId: req.staffUser._id });
        if (!wallet) {
            wallet = await Wallet.create({
                ownerId: req.staffUser._id,
                solde: 0,
            });
        }

        await wallet.recalculerSoldes();

        return res.status(200).json({
            success: true,
            wallet: {
                _id: wallet._id,
                // Retirable dès maintenant.
                solde: wallet.solde,
                // Acquis mais bloqué tant que l'admin n'a pas validé.
                soldeEnAttente: wallet.soldeEnAttente,
                soldeTotal: wallet.solde + wallet.soldeEnAttente,
                ownerId: wallet.ownerId,
                createdAt: wallet.createdAt,
            }
        });
    } catch (error) {
        console.error('Erreur getMyWallet:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/wallet/moi/transactions — Historique des transactions
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

// GET /api/wallet/admin/:commercialId — Admin : voir wallet d'un commercial
export const getWalletByCommercial = async (req, res) => {
    try {
        const { commercialId } = req.params;

        const wallet = await Wallet.findOne({ ownerId: commercialId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Portefeuille non trouvé' });
        }

        await wallet.recalculerSoldes();

        return res.status(200).json({
            success: true,
            wallet
        });
    } catch (error) {
        console.error('Erreur getWalletByCommercial:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/wallet/admin/ajustement — Admin : ajuster manuellement
// [PHASE 0] Idempotence, motif obligatoire, creePar, journalisation
export const adminAjustement = async (req, res) => {
    try {
        // Lire la clé d'idempotence depuis l'en-tête
        const idempotencyKey = req.headers['idempotency-key'];
        if (!idempotencyKey) {
            return res.status(400).json({
                success: false,
                message: 'En-tête Idempotency-Key requis pour cette opération'
            });
        }

        const { commercialId, montant, description, motif } = req.body;

        // Motif obligatoire (≥10 caractères)
        if (!motif || motif.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Un motif d’au moins 10 caractères est requis pour justifier l’ajustement.'
            });
        }

        if (!commercialId || !montant || !description) {
            return res.status(400).json({
                success: false,
                message: 'Données manquantes (commercialId, montant, description)'
            });
        }

        const wallet = await Wallet.findOne({ ownerId: commercialId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Portefeuille non trouvé' });
        }

        // Vérification de l'idempotence : tenter de créer, l'index unique
        // échouera si la même clé a déjà été utilisée pour ce wallet.
        let transaction;
        try {
            transaction = await WalletTransaction.create({
                walletId: wallet._id,
                type: 'ajustement',
                montant: montant,
                description: `Ajustement admin : ${description}`,
                motif: motif.trim(),
                creePar: req.staffUser._id,
                idempotencyKey: idempotencyKey,
            });
        } catch (error) {
            if (error.code === 11000) {
                // La même clé a déjà été utilisée : on renvoie la transaction existante
                const existing = await WalletTransaction.findOne({
                    walletId: wallet._id,
                    idempotencyKey: idempotencyKey,
                });
                return res.status(200).json({
                    success: true,
                    message: 'Ajustement déjà effectué (requête dupliquée)',
                    wallet: await wallet.recalculerSoldes(),
                    transaction: existing,
                    rejeu: true,
                });
            }
            throw error;
        }

        await wallet.recalculerSoldes();

        // Journalisation de l'action
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'wallet.ajustement',
            cible: {
                id: commercialId,
                libelle: `Commerçant ${commercialId}`,
            },
            note: `Montant: ${montant}, motif: ${motif.trim()}`,
        });

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