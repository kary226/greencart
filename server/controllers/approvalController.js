import ApprovalRequest from '../models/ApprovalRequest.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import DemandeRetrait from '../models/DemandeRetrait.js';
import StaffUser from '../models/StaffUser.js';
import PushSubscription from '../models/PushSubscription.js';
import { journaliser } from '../services/journalService.js';
import { sendEmail } from '../configs/email.js';
import webpush from '../configs/webpush.js';

// ─── GET /api/admin/approvals ─────────────────────────────────────
export const listApprovals = async (req, res) => {
    try {
        const { statut, type } = req.query;
        const filter = {};
        if (statut) filter.statut = statut;
        if (type) filter.type = type;

        const approvals = await ApprovalRequest.find(filter)
            .populate('demandePar', 'nom email')
            .populate('approuvePar', 'nom email')
            .sort({ createdAt: -1 })
            .limit(100);

        return res.status(200).json({
            success: true,
            approvals,
        });
    } catch (error) {
        console.error('Erreur listApprovals:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── POST /api/admin/approvals/:id/approuver ──────────────────────
export const approuverApproval = async (req, res) => {
    try {
        const { id } = req.params;
        const { commentaire } = req.body;

        const approval = await ApprovalRequest.findById(id);
        if (!approval) {
            return res.status(404).json({ success: false, message: 'Demande introuvable' });
        }

        if (approval.statut !== 'en_attente') {
            return res.status(409).json({
                success: false,
                message: `Cette demande est déjà ${approval.statut}`,
            });
        }

        // L'approbateur doit être différent du demandeur
        if (approval.demandePar.toString() === req.staffUser._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Vous ne pouvez pas approuver votre propre demande',
            });
        }

        // Vérifier les droits
        const hasRight = req.staffUser.role === 'super_admin' ||
            req.staffUser.role === 'finance_admin' ||
            (req.staffUser.permissions && req.staffUser.permissions.includes('wallet.adjust'));
        if (!hasRight) {
            return res.status(403).json({
                success: false,
                message: 'Vous n\'avez pas les droits pour approuver cette demande',
            });
        }

        // Exécuter l'action selon le type
        let result;
        switch (approval.type) {
            case 'wallet_adjust':
                result = await executerAjustementWallet(approval.payload, req.staffUser);
                break;
            case 'withdrawal':
                result = await executerApprobationRetrait(approval.payload, req.staffUser);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: `Type d'approbation non supporté : ${approval.type}`,
                });
        }

        // Marquer comme approuvée
        approval.statut = 'approuvee';
        approval.approuvePar = req.staffUser._id;
        approval.decideLe = new Date();
        approval.commentaire = commentaire || '';
        await approval.save();

        // Journaliser
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'approval.approuvee',
            cible: {
                id: approval._id,
                libelle: `Demande ${approval.type}`,
            },
            note: `Montant: ${approval.montant}, commentaire: ${commentaire || ''}`,
        });

        // Notifier le demandeur
        await notifierDemandeur(approval, 'approuvee');

        return res.status(200).json({
            success: true,
            message: 'Demande approuvée et exécutée',
            approval,
            result,
        });
    } catch (error) {
        console.error('Erreur approuverApproval:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── POST /api/admin/approvals/:id/rejeter ────────────────────────
export const rejeterApproval = async (req, res) => {
    try {
        const { id } = req.params;
        const { commentaire } = req.body;

        const approval = await ApprovalRequest.findById(id);
        if (!approval) {
            return res.status(404).json({ success: false, message: 'Demande introuvable' });
        }

        if (approval.statut !== 'en_attente') {
            return res.status(409).json({
                success: false,
                message: `Cette demande est déjà ${approval.statut}`,
            });
        }

        // L'approbateur doit être différent du demandeur
        if (approval.demandePar.toString() === req.staffUser._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Vous ne pouvez pas rejeter votre propre demande',
            });
        }

        // Vérifier les droits
        const hasRight = req.staffUser.role === 'super_admin' ||
            req.staffUser.role === 'finance_admin' ||
            (req.staffUser.permissions && req.staffUser.permissions.includes('wallet.adjust'));
        if (!hasRight) {
            return res.status(403).json({
                success: false,
                message: 'Vous n\'avez pas les droits pour rejeter cette demande',
            });
        }

        // Annuler les réservations si nécessaire
        if (approval.type === 'withdrawal') {
            const wallet = await Wallet.findOne({ ownerId: approval.payload.commercialId });
            if (wallet) {
                const demandeRetrait = await DemandeRetrait.findById(approval.payload.demandeRetraitId);
                if (demandeRetrait && demandeRetrait.statut === 'en_attente') {
                    // Recréditer
                    await WalletTransaction.create({
                        walletId: wallet._id,
                        type: 'ajustement',
                        compte: 'disponible',
                        montant: demandeRetrait.montant,
                        description: 'Retrait refusé (double approbation) — fonds restitués',
                        demandeRetraitId: demandeRetrait._id,
                    });
                    await wallet.recalculerSoldes();
                    demandeRetrait.statut = 'rejetee';
                    demandeRetrait.traitePar = req.staffUser._id;
                    demandeRetrait.traiteLe = new Date();
                    await demandeRetrait.save();
                }
            }
        }

        approval.statut = 'rejetee';
        approval.approuvePar = req.staffUser._id;
        approval.decideLe = new Date();
        approval.commentaire = commentaire || 'Demande rejetée';
        await approval.save();

        // Journaliser
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'approval.rejetee',
            cible: {
                id: approval._id,
                libelle: `Demande ${approval.type}`,
            },
            note: `Montant: ${approval.montant}, commentaire: ${commentaire || ''}`,
        });

        // Notifier le demandeur
        await notifierDemandeur(approval, 'rejetee');

        return res.status(200).json({
            success: true,
            message: 'Demande rejetée',
            approval,
        });
    } catch (error) {
        console.error('Erreur rejeterApproval:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Fonctions internes ────────────────────────────────────────────────

/**
 * Exécute un ajustement de wallet (appelé après approbation)
 */
const executerAjustementWallet = async (payload, acteur) => {
    const { commercialId, montant, description, motif, idempotencyKey } = payload;
    const wallet = await Wallet.findOne({ ownerId: commercialId });
    if (!wallet) {
        throw new Error('Portefeuille non trouvé');
    }

    const transaction = await WalletTransaction.create({
        walletId: wallet._id,
        type: 'ajustement',
        montant: montant,
        description: `Ajustement admin (double approbation) : ${description}`,
        motif: motif || description,
        creePar: acteur._id,
        idempotencyKey: idempotencyKey,
    });

    await wallet.recalculerSoldes();

    await journaliser({
        acteur: {
            id: acteur._id,
            nom: acteur.nom,
            role: acteur.role,
        },
        action: 'wallet.ajustement',
        cible: {
            id: commercialId,
            libelle: `Commerçant ${commercialId}`,
        },
        note: `Montant: ${montant}, motif: ${motif} (double approbation)`,
    });

    return { wallet, transaction };
};

/**
 * Exécute l'approbation d'un retrait (appelé après approbation)
 */
const executerApprobationRetrait = async (payload, acteur) => {
    const { demandeRetraitId, reference } = payload;
    const demande = await DemandeRetrait.findById(demandeRetraitId);
    if (!demande) {
        throw new Error('Demande de retrait introuvable');
    }

    if (demande.statut !== 'en_attente') {
        throw new Error(`La demande est déjà ${demande.statut}`);
    }

    demande.statut = 'payee';
    demande.traitePar = acteur._id;
    demande.traiteLe = new Date();
    demande.reference = reference || '';
    await demande.save();

    await journaliser({
        acteur: {
            id: acteur._id,
            nom: acteur.nom,
            role: acteur.role,
        },
        action: 'retrait.approbation',
        cible: {
            id: demande._id,
            libelle: `Demande retrait ${demande._id}`,
        },
        note: `Montant: ${demande.montant}, opérateur: ${demande.operateur}, référence: ${reference}`,
    });

    return { demande };
};

/**
 * Notifie le demandeur par email et push
 */
const notifierDemandeur = async (approval, statut) => {
    try {
        await approval.populate('demandePar', 'email nom');
        const email = approval.demandePar.email;
        const nom = approval.demandePar.nom;

        const sujet = statut === 'approuvee'
            ? `✅ Votre demande a été approuvée`
            : `❌ Votre demande a été rejetée`;

        const message = statut === 'approuvee'
            ? `Votre demande de ${approval.type} (${approval.montant} FCFA) a été approuvée.`
            : `Votre demande de ${approval.type} (${approval.montant} FCFA) a été rejetée. Motif : ${approval.commentaire || 'non spécifié'}.`;

        // Email
        await sendEmail(email, sujet, `
            <h2>${sujet}</h2>
            <p>Bonjour ${nom},</p>
            <p>${message}</p>
            <p>Connectez-vous pour plus de détails.</p>
        `);

        // Push
        const subscriptions = await PushSubscription.find({ userId: approval.demandePar._id });
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
                    })
                );
            } catch (err) {
                console.error('Erreur push notification:', err.message);
            }
        }
    } catch (error) {
        console.error('Erreur notification:', error.message);
    }
};