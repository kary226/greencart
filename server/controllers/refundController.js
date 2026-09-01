import Refund from '../models/Refund.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import Setting from '../models/Setting.js';
import { journaliser } from '../services/journalService.js';
import { crediterClient } from '../models/CustomerCredit.js';
// [CORRECTIF AUDIT — 23 août 2026] nécessaire pour le garde-fou
// d'exclusivité RCOINS / remboursement monétaire ci-dessous.
import CustomerCreditTransaction from '../models/CustomerCreditTransaction.js';
import { sendEmail } from '../configs/email.js';
import webpush from '../configs/webpush.js';
import PushSubscription from '../models/PushSubscription.js';
import StaffUser from '../models/StaffUser.js';
import { v4 as uuidv4 } from 'uuid';
// [RAMCI §1, §13] Sert à ne pas ouvrir une exception que personne ne
// pourrait trancher — voir le commentaire dans createRefund.
import { peutTrancher } from '../services/exceptionApprovalService.js';

// =============================================================
// LISTE DES REMBOURSEMENTS
// GET /api/admin/refunds
// =============================================================
export const listRefunds = async (req, res) => {
    try {
        const { statut, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (statut) filter.statut = statut;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const refunds = await Refund.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('orderId', '_id amount status userId')
            .populate('demandePar', 'nom email')
            .populate('approuvePar', 'nom email');
        const total = await Refund.countDocuments(filter);
        return res.status(200).json({
            success: true,
            refunds,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Erreur listRefunds:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// DÉTAIL D'UN REMBOURSEMENT
// GET /api/admin/refunds/:id
// =============================================================
export const getRefundById = async (req, res) => {
    try {
        const { id } = req.params;
        const refund = await Refund.findById(id)
            .populate('orderId', '_id amount status userId items')
            .populate('demandePar', 'nom email')
            .populate('approuvePar', 'nom email');
        if (!refund) {
            return res.status(404).json({ success: false, message: 'Remboursement non trouvé' });
        }
        return res.status(200).json({ success: true, refund });
    } catch (error) {
        console.error('Erreur getRefundById:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// CRÉER UN REMBOURSEMENT
// POST /api/admin/refunds
// =============================================================
export const createRefund = async (req, res) => {
    try {
        const { orderId, itemIds, montant, methode, motif, noteInterne, noteClient } = req.body;
        if (!orderId || !montant || !motif) {
            return res.status(400).json({
                success: false,
                message: 'orderId, montant et motif sont requis',
            });
        }
        // Vérifier que la commande existe
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande non trouvée' });
        }
        // Vérifier que le montant n'est pas supérieur au montant de la commande
        if (montant > order.amount) {
            return res.status(400).json({
                success: false,
                message: `Le montant demandé (${montant} FCFA) dépasse le montant de la commande (${order.amount} FCFA)`,
            });
        }

        // [CORRECTIF AUDIT — 23 août 2026] Garde-fou d'exclusivité RCOINS /
        // remboursement monétaire — critère d'acceptation explicite du §24
        // du cahier des charges, absent avant ce correctif. Portée : au
        // niveau de la commande entière plutôt qu'article par article, car
        // le crédit RCOINS exceptionnel émis depuis resoudreLitige()
        // (résolution "remboursement_client") n'est rattaché à aucun
        // itemId réel — un contrôle par article donnerait une fausse
        // sécurité. Un remboursement monétaire ne peut donc pas être créé
        // sur une commande qui a déjà reçu un crédit RCOINS, et
        // réciproquement (voir orderController.resoudreLitige).
        const creditRcoinsExistant = await CustomerCreditTransaction.findOne({
            orderId,
            type: 'credit',
        });
        if (creditRcoinsExistant) {
            return res.status(409).json({
                success: false,
                message: "Cette commande a déjà reçu un crédit RCOINS. Un remboursement monétaire sur la même commande est exclu — les deux voies ne peuvent pas coexister.",
            });
        }

        // Générer un refundId unique
        const refundId = uuidv4();
        const refund = await Refund.create({
            orderId,
            itemIds: itemIds || [],
            montantApprouve: montant,
            methode: methode || 'rcoins',
            statut: 'requested',
            refundId,
            demandePar: req.staffUser._id,
            motif,
            noteInterne: noteInterne || '',
            noteClient: noteClient || '',
        });
        // Journaliser la création
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'refund.requested',
            cible: { id: refund._id, libelle: `Remboursement ${refundId.slice(-8)}` },
            note: `Commande ${orderId.slice(-6).toUpperCase()} - ${montant} FCFA - ${motif}`,
        });
        // Vérifier si le montant dépasse le seuil de double approbation.
        //
        // [RAMCI §11, §13] Le seuil est CONSERVÉ ici, contrairement aux
        // retraits (§9) : le guide distingue explicitement les deux cas —
        // « remboursement exceptionnel → préparation + validation finale »
        // reste dans le tableau du §13, alors que le retrait normal en sort.
        //
        // En revanche, on n'ouvre pas de demande d'approbation quand le
        // demandeur est LUI-MÊME l'arbitre : la demande n'aurait alors aucun
        // approbateur possible (nul ne tranche sa propre demande), et le
        // remboursement resterait bloqué indéfiniment. §1 et §4 : le Super
        // Admin a l'autorité finale, il n'a personne à saisir au-dessus.
        const thresholdSetting = await Setting.findOne({ key: 'finance.approval.wallet_adjust_threshold' });
        const threshold = thresholdSetting?.value || 50000;
        if (montant > threshold && !peutTrancher(req.staffUser)) {
            // Créer une demande d'approbation
            const approval = await ApprovalRequest.create({
                type: 'refund',
                payload: {
                    refundId: refund._id,
                    orderId,
                    montant,
                    methode,
                    motif,
                },
                montant: montant,
                demandePar: req.staffUser._id,
            });
            // Notifier les finance_admins et super_admins
            await notifierApprobateursRefund(approval);
            return res.status(202).json({
                success: true,
                message: `Demande de remboursement créée (${montant} FCFA) - en attente d'approbation`,
                refund,
                approvalRequestId: approval._id,
            });
        }
        // Sinon, exécution immédiate (passer en approuvé directement)
        refund.statut = 'approved';
        refund.approuvePar = req.staffUser._id;
        refund.approuveLe = new Date();
        await refund.save();
        // Exécuter le remboursement
        await executerRefund(refund, req.staffUser);
        return res.status(201).json({
            success: true,
            message: 'Remboursement créé et approuvé',
            refund,
        });
    } catch (error) {
        console.error('Erreur createRefund:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// APPROUVER UN REMBOURSEMENT
// POST /api/admin/refunds/:id/approve
// =============================================================
export const approveRefund = async (req, res) => {
    try {
        const { id } = req.params;
        const { commentaire } = req.body;
        // Lecture préalable uniquement pour les contrôles qui ne modifient
        // pas l'état (droits, auto-approbation). La transition d'état elle-
        // même se fait plus bas via findOneAndUpdate, de façon atomique.
        const refundAvant = await Refund.findById(id);
        if (!refundAvant) {
            return res.status(404).json({ success: false, message: 'Remboursement non trouvé' });
        }
        if (refundAvant.statut !== 'requested') {
            return res.status(409).json({
                success: false,
                message: `Ce remboursement est déjà ${refundAvant.statut}`,
            });
        }
        // L'approbateur doit être différent du demandeur
        if (refundAvant.demandePar.toString() === req.staffUser._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Vous ne pouvez pas approuver votre propre demande',
            });
        }
        // Vérifier les droits
        const hasRight = req.staffUser.role === 'super_admin' ||
            req.staffUser.role === 'finance_admin' ||
            (req.staffUser.permissions && req.staffUser.permissions.includes('refunds.approve'));
        if (!hasRight) {
            return res.status(403).json({
                success: false,
                message: 'Vous n\'avez pas les droits pour approuver ce remboursement',
            });
        }
        // [CORRECTIF — race condition] findOneAndUpdate avec condition sur
        // le statut = verrou atomique côté MongoDB. Si deux requêtes
        // arrivent en même temps (double-clic, retry réseau, deux admins),
        // une seule passe la condition { statut: 'requested' } ; l'autre
        // reçoit refund === null et est rejetée en 409. Avant ce correctif,
        // le findById + save() séparés laissaient une fenêtre où les deux
        // requêtes pouvaient lire 'requested' avant qu'aucune n'écrive,
        // menant à une double exécution de executerRefund() et donc à un
        // double crédit RCOINS pour le même remboursement.
        const refund = await Refund.findOneAndUpdate(
            { _id: id, statut: 'requested' },
            {
                $set: {
                    statut: 'approved',
                    approuvePar: req.staffUser._id,
                    approuveLe: new Date(),
                    noteInterne: commentaire || refundAvant.noteInterne,
                },
            },
            { new: true }
        );
        if (!refund) {
            return res.status(409).json({
                success: false,
                message: 'Ce remboursement vient d\'être traité par ailleurs (déjà approuvé, rejeté, ou en cours)',
            });
        }
        // Journaliser l'approbation
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'refund.approved',
            cible: { id: refund._id, libelle: `Remboursement ${refund.refundId.slice(-8)}` },
            note: `Montant: ${refund.montantApprouve} FCFA - ${refund.motif}`,
        });
        // Exécuter le remboursement
        await executerRefund(refund, req.staffUser);
        // Notifier le demandeur
        await notifierDemandeurRefund(refund, 'approuve');
        return res.status(200).json({
            success: true,
            message: 'Remboursement approuvé et exécuté',
            refund,
        });
    } catch (error) {
        console.error('Erreur approveRefund:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// REJETER UN REMBOURSEMENT
// POST /api/admin/refunds/:id/reject
// =============================================================
export const rejectRefund = async (req, res) => {
    try {
        const { id } = req.params;
        const { motif } = req.body;
        const refundAvant = await Refund.findById(id);
        if (!refundAvant) {
            return res.status(404).json({ success: false, message: 'Remboursement non trouvé' });
        }
        if (refundAvant.statut !== 'requested') {
            return res.status(409).json({
                success: false,
                message: `Ce remboursement est déjà ${refundAvant.statut}`,
            });
        }
        if (refundAvant.demandePar.toString() === req.staffUser._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Vous ne pouvez pas rejeter votre propre demande',
            });
        }
        const hasRight = req.staffUser.role === 'super_admin' ||
            req.staffUser.role === 'finance_admin' ||
            (req.staffUser.permissions && req.staffUser.permissions.includes('refunds.approve'));
        if (!hasRight) {
            return res.status(403).json({
                success: false,
                message: 'Vous n\'avez pas les droits pour rejeter ce remboursement',
            });
        }
        // [CORRECTIF — même race condition que approveRefund] Sans ce verrou
        // atomique, un approve et un reject lancés au même instant sur le
        // même remboursement pouvaient tous deux passer leur vérification
        // de statut avant qu'aucun n'écrive, laissant le document dans un
        // état incohérent (RCOINS crédités MAIS refund marqué "rejected",
        // ou l'inverse selon l'ordre d'écriture final).
        const refund = await Refund.findOneAndUpdate(
            { _id: id, statut: 'requested' },
            {
                $set: {
                    statut: 'rejected',
                    approuvePar: req.staffUser._id,
                    approuveLe: new Date(),
                    noteInterne: motif || 'Demande rejetée',
                },
            },
            { new: true }
        );
        if (!refund) {
            return res.status(409).json({
                success: false,
                message: 'Ce remboursement vient d\'être traité par ailleurs (déjà approuvé, rejeté, ou en cours)',
            });
        }
        // Journaliser le rejet
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'refund.rejected',
            cible: { id: refund._id, libelle: `Remboursement ${refund.refundId.slice(-8)}` },
            note: `Motif: ${motif || 'Non spécifié'}`,
        });
        // Notifier le demandeur
        await notifierDemandeurRefund(refund, 'rejete');
        return res.status(200).json({
            success: true,
            message: 'Remboursement rejeté',
            refund,
        });
    } catch (error) {
        console.error('Erreur rejectRefund:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================================
// MARQUER UN REMBOURSEMENT COMME TERMINÉ
// POST /api/admin/refunds/:id/complete
// =============================================================
export const completeRefund = async (req, res) => {
    try {
        const { id } = req.params;
        const { providerReference, note } = req.body;
        const refundAvant = await Refund.findById(id);
        if (!refundAvant) {
            return res.status(404).json({ success: false, message: 'Remboursement non trouvé' });
        }
        if (refundAvant.statut === 'completed') {
            return res.status(409).json({
                success: false,
                message: 'Ce remboursement est déjà terminé',
            });
        }
        if (refundAvant.statut !== 'processing' && refundAvant.statut !== 'approved') {
            return res.status(409).json({
                success: false,
                message: `Ce remboursement est au statut ${refundAvant.statut} - impossible de le marquer comme terminé`,
            });
        }
        // [CORRECTIF — cohérence] Même principe que approveRefund/rejectRefund :
        // pas de double-crédit possible ici (déjà effectué à l'approbation),
        // mais deux appels concurrents pouvaient produire deux entrées de
        // journal et deux notifications pour la même complétion.
        const refund = await Refund.findOneAndUpdate(
            { _id: id, statut: { $in: ['processing', 'approved'] } },
            {
                $set: {
                    statut: 'completed',
                    providerReference: providerReference || refundAvant.providerReference,
                    completeLe: new Date(),
                    noteInterne: note ? `${refundAvant.noteInterne}\n${note}` : refundAvant.noteInterne,
                },
            },
            { new: true }
        );
        if (!refund) {
            return res.status(409).json({
                success: false,
                message: 'Ce remboursement vient d\'être traité par ailleurs',
            });
        }
        // Journaliser la completion
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'refund.completed',
            cible: { id: refund._id, libelle: `Remboursement ${refund.refundId.slice(-8)}` },
            note: `Référence: ${providerReference || 'N/A'}`,
        });
        // Notifier le demandeur
        await notifierDemandeurRefund(refund, 'complete');
        return res.status(200).json({
            success: true,
            message: 'Remboursement marqué comme terminé',
            refund,
        });
    } catch (error) {
        console.error('Erreur completeRefund:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Fonctions internes ────────────────────────────────────────────────

/**
 * Exécute un remboursement (crédit RCOINS).
 */
const executerRefund = async (refund, acteur) => {
    if (refund.methode === 'rcoins') {
        const order = await Order.findById(refund.orderId);
        if (!order) {
            throw new Error('Commande non trouvée');
        }
        // Créditer le client en RCOINS.
        // [CORRECTIF — idempotence] itemId doit être STABLE pour un
        // remboursement donné, pas généré aléatoirement à chaque appel.
        // crediterClient() s'appuie sur l'index unique
        // { orderId, itemId, type } de CustomerCreditTransaction comme
        // verrou anti-doublon (même principe que rembourserCreditAnnulation
        // plus haut dans ce fichier) : avec un ObjectId aléatoire, ce verrou
        // ne peut jamais se déclencher, donc un deuxième appel (retry après
        // crash, replay, ancien bug de race condition sur approveRefund)
        // créditait le client une deuxième fois. En dérivant itemId de
        // refund._id, un deuxième appel pour le MÊME remboursement retombe
        // sur la même clé { orderId, itemId, type: 'credit' } et provoque
        // une erreur E11000 que crediterClient() intercepte déjà (retourne
        // false) — le crédit ne peut alors plus jamais être dupliqué,
        // quelle que soit la cause du second appel.
        const credited = await crediterClient({
            userId: order.userId,
            orderId: order._id,
            itemId: refund._id,
            amount: refund.montantApprouve,
            description: `Remboursement ${refund.motif} - ${refund.refundId}`,
        });
        if (!credited) {
            throw new Error('Échec du crédit RCOINS');
        }
        refund.statut = 'processing';
        await refund.save();
        // Journaliser l'exécution
        await journaliser({
            acteur: {
                id: acteur._id,
                nom: acteur.nom,
                role: acteur.role,
            },
            action: 'refund.executed',
            cible: { id: refund._id, libelle: `Remboursement ${refund.refundId.slice(-8)}` },
            note: `${refund.montantApprouve} FCFA crédités en RCOINS`,
        });
    } else {
        // Moyen d'origine - marquer en attente de confirmation manuelle
        refund.statut = 'processing';
        await refund.save();
    }
};

/**
 * Notifie les approbateurs d'une demande de remboursement.
 */
const notifierApprobateursRefund = async (approval) => {
    try {
        const approbateurs = await StaffUser.find({
            role: { $in: ['super_admin', 'finance_admin'] },
            statut: 'actif',
        }).select('email nom _id');
        const sujet = `🟡 Demande de remboursement (${approval.montant.toLocaleString('fr-FR')} FCFA)`;
        const message = `Une demande de remboursement de ${approval.montant.toLocaleString('fr-FR')} FCFA a été créée. Connectez-vous pour approuver ou rejeter.`;
        for (const admin of approbateurs) {
            await sendEmail(admin.email, sujet, `
                <h2>${sujet}</h2>
                <p>Bonjour ${admin.nom},</p>
                <p>${message}</p>
                <p><a href="${process.env.FRONTEND_URL}/admin/refunds/${approval.payload.refundId}">Voir la demande</a></p>
            `);
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
                            data: { refundId: approval.payload.refundId },
                        })
                    );
                } catch (err) {
                    console.error('Erreur push notification:', err.message);
                }
            }
        }
    } catch (error) {
        console.error('Erreur notification approbateurs refund:', error.message);
    }
};

/**
 * Notifie le demandeur du résultat du remboursement.
 */
const notifierDemandeurRefund = async (refund, type) => {
    try {
        const demandeur = await StaffUser.findById(refund.demandePar).select('email nom');
        if (!demandeur) return;
        const messages = {
            approuve: {
                sujet: '✅ Votre demande de remboursement a été approuvée',
                corps: `Votre demande de remboursement de ${refund.montantApprouve.toLocaleString('fr-FR')} FCFA a été approuvée et est en cours de traitement.`,
            },
            rejete: {
                sujet: '❌ Votre demande de remboursement a été rejetée',
                corps: `Votre demande de remboursement de ${refund.montantApprouve.toLocaleString('fr-FR')} FCFA a été rejetée.`,
            },
            complete: {
                sujet: '✅ Votre remboursement est terminé',
                corps: `Le remboursement de ${refund.montantApprouve.toLocaleString('fr-FR')} FCFA a été effectué.`,
            },
        };
        const msg = messages[type];
        if (!msg) return;
        await sendEmail(demandeur.email, msg.sujet, `
            <h2>${msg.sujet}</h2>
            <p>Bonjour ${demandeur.nom},</p>
            <p>${msg.corps}</p>
            <p>Référence: ${refund.refundId}</p>
            <p><a href="${process.env.FRONTEND_URL}/admin/refunds/${refund._id}">Voir le détail</a></p>
        `);
    } catch (error) {
        console.error('Erreur notification demandeur refund:', error.message);
    }
};