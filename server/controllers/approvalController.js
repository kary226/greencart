import ApprovalRequest from '../models/ApprovalRequest.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import DemandeRetrait from '../models/DemandeRetrait.js';
import StaffUser from '../models/StaffUser.js';
import PushSubscription from '../models/PushSubscription.js';
import Refund from '../models/Refund.js';
import { journaliser } from '../services/journalService.js';
import { sendEmail } from '../configs/email.js';
import webpush from '../configs/webpush.js';
import { trancher } from '../services/exceptionApprovalService.js';
import { executerDecisionEscalade, executerRejetEscalade } from '../services/withdrawalService.js';

/**
 * EXCEPTIONS  —  Guide RAMCI §12, §13, §19 cas C et D, §20
 * ========================================================
 * « Le Super Admin décide ; les équipes exécutent dans leur domaine. »
 *
 * Cet écran ne traite plus des opérations normales en attente d'un second
 * clic. Il ne contient que ce qu'aucune règle ne sait clore (§13). Les
 * contrôles d'autorité (qui peut trancher, pas sa propre demande, dossier
 * non expiré) sont dans services/exceptionApprovalService.js, pour être
 * identiques quel que soit le chemin d'appel.
 */

// ─── GET /api/admin/approvals ─────────────────────────────────────
export const listApprovals = async (req, res) => {
    try {
        const { statut, type, domaine } = req.query;
        const filter = {};
        if (statut) filter.statut = statut;
        if (type) filter.type = type;
        if (domaine) filter.domaine = domaine;

        const approvals = await ApprovalRequest.find(filter)
            .populate('demandePar', 'nom email role')
            .populate('approuvePar', 'nom email role')
            .sort({ createdAt: -1 })
            .limit(100);

        return res.status(200).json({
            success: true,
            approvals,
            // §14 : le Super Admin doit voir d'abord ce qui l'attend.
            aTrancher: await ApprovalRequest.countDocuments({ statut: 'en_attente' }),
        });
    } catch (error) {
        console.error('Erreur listApprovals:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── POST /api/admin/approvals/:id/approuver ──────────────────────
export const approuverApproval = async (req, res) => {
    try {
        const { commentaire, paye = false, reference = '' } = req.body;

        const approval = await ApprovalRequest.findById(req.params.id);

        const resultat = await trancher({
            approval,
            acteur: req.staffUser,
            decision: 'approuvee',
            commentaire,
            executer: (dossier, arbitre) => executerSelonType(dossier, arbitre, { paye, reference }),
        });

        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({ success: false, message: resultat.message });
        }

        notifierDemandeur(resultat.approval, 'approuvee').catch(() => {});

        return res.status(200).json({
            success: true,
            message: 'Exception tranchée — décision appliquée',
            approval: resultat.approval,
            result: resultat.resultat,
        });
    } catch (error) {
        console.error('Erreur approuverApproval:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── POST /api/admin/approvals/:id/rejeter ────────────────────────
export const rejeterApproval = async (req, res) => {
    try {
        const { commentaire } = req.body;

        const approval = await ApprovalRequest.findById(req.params.id);

        const resultat = await trancher({
            approval,
            acteur: req.staffUser,
            decision: 'rejetee',
            commentaire: commentaire || 'Demande rejetée',
            // Un rejet a des conséquences concrètes : un retrait escaladé
            // qui n'est pas payé doit rendre les fonds réservés au
            // commerçant. Les laisser réservés, c'est de l'argent gelé sans
            // décision — le contraire de ce que §8 demande.
            executer: null,
        });

        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({ success: false, message: resultat.message });
        }

        await annulerSelonType(resultat.approval, req.staffUser);

        notifierDemandeur(resultat.approval, 'rejetee').catch(() => {});

        return res.status(200).json({
            success: true,
            message: 'Exception rejetée',
            approval: resultat.approval,
        });
    } catch (error) {
        console.error('Erreur rejeterApproval:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────
// Exécution de la décision, par nature d'exception
// ─────────────────────────────────────────────────────────────────────────

const executerSelonType = async (approval, arbitre, options) => {
    switch (approval.type) {
        case 'wallet_adjust':
            return executerAjustementWallet(approval.payload, arbitre);

        case 'withdrawal_escalated':
        case 'withdrawal':
            return executerDecisionEscalade(approval, arbitre, options);

        case 'refund_exceptionnel':
        case 'refund':
            return executerRemboursementExceptionnel(approval, arbitre);

        // Un retour contesté et un litige se tranchent par une décision
        // écrite, que les équipes appliquent ensuite dans leur domaine
        // (§12 étape 8). Rien à exécuter automatiquement ici : forcer une
        // action mécanique reviendrait à décider à leur place.
        case 'return_conteste':
        case 'litige':
        case 'role_change':
            return { applique: false, message: 'Décision enregistrée — à exécuter par le domaine concerné' };

        default:
            throw new Error(`Type d'exception non supporté : ${approval.type}`);
    }
};

const annulerSelonType = async (approval, arbitre) => {
    if (['withdrawal_escalated', 'withdrawal'].includes(approval.type)) {
        await executerRejetEscalade(approval, arbitre);
    }
};

/** Ajustement de portefeuille validé par le Super Admin (§13, §19 cas D). */
const executerAjustementWallet = async (payload, arbitre) => {
    const { commercialId, montant, description, motif, idempotencyKey } = payload;

    const wallet = await Wallet.findOne({ ownerId: commercialId });
    if (!wallet) throw new Error('Portefeuille non trouvé');

    // Idempotence : une décision rejouée ne double pas l'écriture.
    if (idempotencyKey) {
        const existante = await WalletTransaction.findOne({ walletId: wallet._id, idempotencyKey });
        if (existante) return { wallet, transaction: existante, rejeu: true };
    }

    const transaction = await WalletTransaction.create({
        walletId: wallet._id,
        type: 'ajustement',
        // Le compte manquait ici : sans lui, la transaction ne tombait dans
        // aucun des deux soldes du modèle à deux niveaux (§8) et
        // recalculerSoldes l'ignorait — l'ajustement était écrit mais
        // n'apparaissait nulle part.
        compte: 'disponible',
        montant,
        description: `Ajustement validé par le Super Admin : ${description}`,
        motif: motif || description,
        creePar: arbitre._id,
        idempotencyKey: idempotencyKey || null,
    });

    await wallet.recalculerSoldes();

    await journaliser({
        acteur: { id: arbitre._id, nom: arbitre.nom, role: arbitre.role },
        action: 'wallet.ajustement',
        cible: { id: commercialId, libelle: `Commerçant ${commercialId}` },
        note: `Montant: ${montant}, motif: ${motif} (exception tranchée)`,
    });

    return { wallet, transaction };
};

/** Remboursement hors règles, autorisé par le Super Admin (§11). */
const executerRemboursementExceptionnel = async (approval, arbitre) => {
    const refund = await Refund.findById(approval.payload?.refundId);
    if (!refund) throw new Error('Remboursement introuvable');

    if (refund.statut !== 'requested') {
        return { refund, message: `Ce remboursement est déjà ${refund.statut}` };
    }

    refund.statut = 'approved';
    refund.approuvePar = arbitre._id;
    refund.approuveLe = new Date();
    await refund.save();

    await journaliser({
        acteur: { id: arbitre._id, nom: arbitre.nom, role: arbitre.role },
        action: 'refund.approved',
        cible: { id: refund._id, libelle: `Remboursement ${refund.refundId}` },
        note: `Exception tranchée — ${approval.motif}`,
    });

    return { refund, message: 'Remboursement autorisé — Finance peut l’exécuter' };
};

// ─────────────────────────────────────────────────────────────────────────
// Notification du demandeur
// ─────────────────────────────────────────────────────────────────────────

const notifierDemandeur = async (approval, statut) => {
    try {
        await approval.populate('demandePar', 'email nom');
        const demandeur = approval.demandePar;
        if (!demandeur?.email) return;

        const sujet = statut === 'approuvee'
            ? 'Votre demande d’exception a été acceptée'
            : 'Votre demande d’exception a été refusée';

        const montant = approval.montant
            ? ` (${approval.montant.toLocaleString('fr-FR')} FCFA)`
            : '';
        const message = statut === 'approuvee'
            ? `Le Super Admin a tranché en faveur de votre demande « ${approval.type} »${montant}.`
            : `Le Super Admin a refusé votre demande « ${approval.type} »${montant}. Motif : ${approval.commentaire || 'non précisé'}.`;

        await sendEmail(demandeur.email, sujet, `
            <h2>${sujet}</h2>
            <p>Bonjour ${demandeur.nom},</p>
            <p>${message}</p>
        `);

        const abonnements = await PushSubscription.find({ userId: demandeur._id });
        for (const sub of abonnements) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
                    JSON.stringify({ title: sujet, body: message, icon: '/logo.png' })
                );
            } catch (err) {
                console.error('Erreur push notification:', err.message);
            }
        }
    } catch (error) {
        console.error('Erreur notification:', error.message);
    }
};

// Conservé pour compatibilité avec d'éventuels imports existants.
export { StaffUser };
