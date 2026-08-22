import DemandeRetrait, { OPERATEURS_RETRAIT } from '../models/DemandeRetrait.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import StaffUser from '../models/StaffUser.js';
import PushSubscription from '../models/PushSubscription.js';
import Setting from '../models/Setting.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import { journaliser } from '../services/journalService.js';
import { sendEmail } from '../configs/email.js';
import webpush from '../configs/webpush.js';

const MONTANT_MINIMUM = 1000;

// ─── Fonction interne de notification des approbateurs (retrait) ────
const notifierApprobateursRetrait = async (approval) => {
    try {
        const approbateurs = await StaffUser.find({
            role: { $in: ['super_admin', 'finance_admin'] },
            statut: 'actif',
        }).select('email nom _id');

        const sujet = `🟡 Demande d'approbation de retrait (${approval.montant.toLocaleString('fr-FR')} FCFA)`;
        const message = `Une demande de retrait de ${approval.montant.toLocaleString('fr-FR')} FCFA a été créée par ${approval.demandePar?.nom || 'un commerçant'}. Connectez-vous pour approuver ou rejeter.`;

        for (const admin of approbateurs) {
            await sendEmail(admin.email, sujet, `
                <h2>${sujet}</h2>
                <p>Bonjour ${admin.nom},</p>
                <p>${message}</p>
                <p><a href="${process.env.FRONTEND_URL}/admin/approvals/${approval._id}">Voir la demande</a></p>
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
                            data: { approvalId: approval._id },
                        })
                    );
                } catch (err) {
                    console.error('Erreur push:', err.message);
                }
            }
        }
    } catch (error) {
        console.error('Erreur notification approbateurs retrait:', error.message);
    }
};

// ─── GET /api/retraits/operateurs ──────────────────────────────────
export const listOperateurs = async (req, res) => {
    res.json({ success: true, operateurs: OPERATEURS_RETRAIT });
};

// ─── POST /api/retraits ─────────────────────────────────────────────
// [PHASE 2] Double approbation si montant > seuil
export const createRetrait = async (req, res) => {
    try {
        const { montant, operateur, numero, titulaire, cleIdempotence } = req.body;

        if (!cleIdempotence) {
            return res.status(400).json({ success: false, message: 'Requête invalide' });
        }

        // Rejeu réseau
        const dejaCreee = await DemandeRetrait.findOne({ cleIdempotence });
        if (dejaCreee) {
            return res.status(200).json({
                success: true,
                message: 'Demande déjà enregistrée',
                rejeu: true,
                demande: dejaCreee,
            });
        }

        const montantDemande = Math.round(Number(montant) || 0);
        if (montantDemande < MONTANT_MINIMUM) {
            return res.status(400).json({
                success: false,
                message: `Montant minimum de retrait : ${MONTANT_MINIMUM} FCFA`,
            });
        }

        if (!OPERATEURS_RETRAIT.some((o) => o.code === operateur)) {
            return res.status(400).json({ success: false, message: 'Opérateur invalide' });
        }

        const numeroPropre = String(numero || '').replace(/\s/g, '');
        if (!/^\d{10}$/.test(numeroPropre)) {
            return res.status(400).json({
                success: false,
                message: 'Numéro invalide — 10 chiffres attendus',
            });
        }

        const wallet = await Wallet.findOne({ ownerId: req.staffUser._id });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Portefeuille introuvable' });
        }
        await wallet.recalculerSoldes();

        if (wallet.solde < montantDemande) {
            const complement = wallet.soldeEnAttente > 0
                ? ` ${wallet.soldeEnAttente.toLocaleString('fr-FR')} FCFA sont encore en attente de validation.`
                : '';
            return res.status(400).json({
                success: false,
                message: `Solde disponible insuffisant : ${wallet.solde.toLocaleString('fr-FR')} FCFA.${complement}`,
            });
        }

        const enCours = await DemandeRetrait.findOne({
            commercialId: req.staffUser._id,
            statut: { $in: ['en_attente', 'en_cours'] },
        });
        if (enCours) {
            return res.status(409).json({
                success: false,
                message: 'Une demande de retrait est déjà en cours de traitement',
            });
        }

        // Lire le seuil de retrait
        const thresholdSetting = await Setting.findOne({ key: 'finance.approval.withdrawal_threshold' });
        const threshold = thresholdSetting?.value || 100000;

        // Si montant > seuil → demande d'approbation (sans réservation)
        if (montantDemande > threshold) {
            const approval = await ApprovalRequest.create({
                type: 'withdrawal',
                payload: {
                    commercialId: req.staffUser._id,
                    montant: montantDemande,
                    operateur,
                    numero: numeroPropre,
                    titulaire: titulaire || '',
                    cleIdempotence,
                },
                montant: montantDemande,
                demandePar: req.staffUser._id,
            });

            await notifierApprobateursRetrait(approval);

            return res.status(202).json({
                success: true,
                message: `Demande de retrait soumise à approbation (montant > ${threshold.toLocaleString('fr-FR')} FCFA)`,
                approvalRequestId: approval._id,
                approval,
            });
        }

        // Sinon, exécution immédiate
        let demande;
        try {
            demande = await DemandeRetrait.create({
                commercialId: req.staffUser._id,
                montant: montantDemande,
                operateur,
                numero: numeroPropre,
                titulaire: String(titulaire || '').trim(),
                cleIdempotence,
                statut: 'en_attente',
            });
        } catch (error) {
            if (error.code === 11000) {
                const existante = await DemandeRetrait.findOne({ cleIdempotence });
                return res.status(200).json({
                    success: true, message: 'Demande déjà enregistrée', rejeu: true, demande: existante,
                });
            }
            throw error;
        }

        // Réservation immédiate
        await WalletTransaction.create({
            walletId: wallet._id,
            type: 'retrait',
            compte: 'disponible',
            montant: -montantDemande,
            description: 'Retrait demandé — fonds réservés',
            demandeRetraitId: demande._id,
        });
        await wallet.recalculerSoldes();

        return res.status(201).json({
            success: true,
            message: 'Demande enregistrée — le virement sera exécuté sous peu',
            demande,
            soldeRestant: wallet.solde,
        });
    } catch (error) {
        console.error('Erreur createRetrait:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET /api/retraits/moi ──────────────────────────────────────────
export const getMesRetraits = async (req, res) => {
    try {
        const demandes = await DemandeRetrait.find({ commercialId: req.staffUser._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({ success: true, demandes });
    } catch (error) {
        console.error('Erreur getMesRetraits:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET /api/retraits ──────────────────────────────────────────────
export const listAllRetraits = async (req, res) => {
    try {
        const filtre = {};
        if (req.query.statut) filtre.statut = req.query.statut;

        const demandes = await DemandeRetrait.find(filtre)
            .populate('commercialId', 'nom email')
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        const libelleOperateur = new Map(OPERATEURS_RETRAIT.map((o) => [o.code, o.libelle]));

        res.json({
            success: true,
            demandes: demandes.map((d) => ({ ...d, operateurLibelle: libelleOperateur.get(d.operateur) || d.operateur })),
            aTraiter: demandes.filter((d) => d.statut === 'en_attente').length,
        });
    } catch (error) {
        console.error('Erreur listAllRetraits:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── PATCH /api/retraits/:id ────────────────────────────────────────
// [PHASE 0] Journalisation ajoutée
export const traiterRetrait = async (req, res) => {
    try {
        const { id } = req.params;
        const { statut, noteAdmin, reference, preuvePaiement } = req.body;

        if (!['en_cours', 'payee', 'rejetee'].includes(statut)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }

        const demande = await DemandeRetrait.findById(id);
        if (!demande) {
            return res.status(404).json({ success: false, message: 'Demande introuvable' });
        }

        if (['payee', 'rejetee'].includes(demande.statut)) {
            return res.status(409).json({
                success: false,
                message: `Cette demande est déjà ${demande.statut === 'payee' ? 'payée' : 'rejetée'}`,
            });
        }

        if (statut === 'payee' && !String(reference || '').trim()) {
            return res.status(400).json({
                success: false,
                message: 'La référence du virement est obligatoire pour marquer un retrait payé',
            });
        }

        if (statut === 'rejetee') {
            const wallet = await Wallet.findOne({ ownerId: demande.commercialId });
            if (wallet) {
                const dejaRembourse = await WalletTransaction.exists({
                    demandeRetraitId: demande._id,
                    type: 'ajustement',
                });
                if (!dejaRembourse) {
                    await WalletTransaction.create({
                        walletId: wallet._id,
                        type: 'ajustement',
                        compte: 'disponible',
                        montant: demande.montant,
                        description: 'Retrait refusé — fonds restitués',
                        demandeRetraitId: demande._id,
                    });
                    await wallet.recalculerSoldes();
                }
            }
        }

        demande.statut = statut;
        demande.traitePar = req.staffUser._id;
        demande.traiteLe = new Date();
        if (noteAdmin !== undefined) demande.noteAdmin = String(noteAdmin).trim();
        if (reference !== undefined) demande.reference = String(reference).trim();
        if (preuvePaiement) demande.preuvePaiement = preuvePaiement;
        await demande.save();

        // Journalisation
        let actionJournal = null;
        if (statut === 'payee') actionJournal = 'retrait.approbation';
        else if (statut === 'rejetee') actionJournal = 'retrait.rejet';

        if (actionJournal) {
            await journaliser({
                acteur: {
                    id: req.staffUser._id,
                    nom: req.staffUser.nom,
                    role: req.staffUser.role,
                },
                action: actionJournal,
                cible: {
                    id: demande._id,
                    libelle: `Demande retrait ${demande._id}`,
                },
                note: `Montant: ${demande.montant}, opérateur: ${demande.operateur}, référence: ${reference || ''}`,
            });
        }

        const messages = {
            en_cours: 'Virement marqué en cours',
            payee: 'Retrait marqué comme payé',
            rejetee: 'Demande rejetée — fonds restitués au commerçant',
        };

        return res.json({ success: true, message: messages[statut], demande });
    } catch (error) {
        console.error('Erreur traiterRetrait:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};