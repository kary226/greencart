import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import StaffUser from '../models/StaffUser.js';
import PushSubscription from '../models/PushSubscription.js';
import Setting from '../models/Setting.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import { journaliser } from '../services/journalService.js';
import { sendEmail } from '../configs/email.js';
import webpush from '../configs/webpush.js';

// ─── Fonction interne de notification des approbateurs ──────────────
const notifierApprobateurs = async (approval) => {
    try {
        const approbateurs = await StaffUser.find({
            role: { $in: ['super_admin', 'finance_admin'] },
            statut: 'actif',
        }).select('email nom _id');

        const sujet = `🟡 Demande d'approbation : ${approval.type} (${approval.montant.toLocaleString('fr-FR')} FCFA)`;
        const message = `Une demande d'approbation de ${approval.type} pour ${approval.montant.toLocaleString('fr-FR')} FCFA a été créée par ${approval.demandePar?.nom || 'un administrateur'}. Connectez-vous pour approuver ou rejeter.`;

        for (const admin of approbateurs) {
            // Email
            await sendEmail(admin.email, sujet, `
                <h2>${sujet}</h2>
                <p>Bonjour ${admin.nom},</p>
                <p>${message}</p>
                <p><a href="${process.env.FRONTEND_URL}/admin/approvals/${approval._id}">Voir la demande</a></p>
            `);

            // Push
            const subscriptions = await PushSubscription.find({ userId: admin._id });
            for (const sub of subscriptions) {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.keys.p256dh,
                                auth: sub.keys.auth,
                            },
                        },
                        JSON.stringify({
                            title: sujet,
                            body: message,
                            icon: '/logo.png',
                            data: { approvalId: approval._id },
                        })
                    );
                } catch (err) {
                    console.error('Erreur push notification:', err.message);
                }
            }
        }
    } catch (error) {
        console.error('Erreur notification approbateurs:', error.message);
    }
};

// ─── GET /api/wallet/moi ────────────────────────────────────────────
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
                solde: wallet.solde,
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

// ─── GET /api/wallet/moi/transactions ──────────────────────────────
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

// ─── GET /api/wallet/admin/:commercialId ──────────────────────────
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

// ─── POST /api/wallet/admin/ajustement ─────────────────────────────
// [PHASE 0] Idempotence, motif, creePar, journalisation
// [PHASE 2] Double approbation si montant > seuil
export const adminAjustement = async (req, res) => {
    try {
        // 1. Idempotence
        const idempotencyKey = req.headers['idempotency-key'];
        if (!idempotencyKey) {
            return res.status(400).json({
                success: false,
                message: 'En-tête Idempotency-Key requis pour cette opération'
            });
        }

        const { commercialId, montant, description, motif } = req.body;

        // 2. Validation du motif
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

        const montantAbsolu = Math.abs(montant);

        // 3. Lire le seuil depuis Setting
        const thresholdSetting = await Setting.findOne({ key: 'finance.approval.wallet_adjust_threshold' });
        const threshold = thresholdSetting?.value || 50000;

        // 4. Si montant > seuil → créer une demande d'approbation
        if (montantAbsolu > threshold) {
            // Vérifier qu'il n'y a pas déjà une demande en attente pour cette opération
            const existing = await ApprovalRequest.findOne({
                'payload.commercialId': commercialId,
                'payload.idempotencyKey': idempotencyKey,
                statut: 'en_attente',
            });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: 'Une demande d\'approbation est déjà en attente pour cette opération',
                    approvalRequestId: existing._id,
                });
            }

            const approval = await ApprovalRequest.create({
                type: 'wallet_adjust',
                payload: {
                    commercialId,
                    montant,
                    description,
                    motif: motif.trim(),
                    idempotencyKey,
                },
                montant: montantAbsolu,
                demandePar: req.staffUser._id,
            });

            // Notifier les finance_admins et super_admins
            await notifierApprobateurs(approval);

            return res.status(202).json({
                success: true,
                message: `Demande d'approbation créée (montant > ${threshold.toLocaleString('fr-FR')} FCFA)`,
                approvalRequestId: approval._id,
                approval,
            });
        }

        // 5. Sinon, exécution immédiate
        const wallet = await Wallet.findOne({ ownerId: commercialId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Portefeuille non trouvé' });
        }

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

        // Journalisation
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