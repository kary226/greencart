import DemandeRetrait, { OPERATEURS_RETRAIT } from '../models/DemandeRetrait.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import StaffUser from '../models/StaffUser.js';

// Retraits des commerçants.
//
// Modèle SEMI-AUTOMATIQUE assumé : Jèko, le prestataire de paiement du site,
// ne fait que de l'ENCAISSEMENT — il n'expose aucune API de versement. Un
// retrait 100 % automatique est donc impossible aujourd'hui sans changer de
// prestataire. Plutôt que de simuler une automatisation qui n'existe pas, le
// circuit est : demande instantanée et fonds réservés côté commerçant,
// exécution du virement côté admin, preuve enregistrée.
//
// Toute la sécurité tient en trois points :
//   1. les fonds sont RÉSERVÉS dès la demande (débit immédiat) ;
//   2. une CLÉ D'IDEMPOTENCE empêche qu'un rejeu réseau crée deux retraits ;
//   3. un rejet RECRÉDITE le portefeuille, jamais un ajustement à la main.

const MONTANT_MINIMUM = 1000;

// GET /api/retraits/operateurs — Liste fermée proposée au commerçant.
export const listOperateurs = async (req, res) => {
    res.json({ success: true, operateurs: OPERATEURS_RETRAIT });
};

// POST /api/retraits — Commerçant : demander un retrait
export const createRetrait = async (req, res) => {
    try {
        const { montant, operateur, numero, titulaire, cleIdempotence } = req.body;

        if (!cleIdempotence) {
            return res.status(400).json({ success: false, message: 'Requête invalide' });
        }

        // Rejeu réseau : la demande existe déjà, on la renvoie telle quelle
        // au lieu d'en créer une seconde. C'est le cas normal quand le
        // commerçant perd la connexion juste après avoir validé.
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

        // Numéro ivoirien : 10 chiffres, espaces tolérés à la saisie.
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
            // Deux requêtes simultanées avec la même clé : l'index unique en
            // laisse passer une seule. La perdante récupère la gagnante.
            if (error.code === 11000) {
                const existante = await DemandeRetrait.findOne({ cleIdempotence });
                return res.status(200).json({
                    success: true, message: 'Demande déjà enregistrée', rejeu: true, demande: existante,
                });
            }
            throw error;
        }

        // RÉSERVATION : le portefeuille est débité tout de suite. La somme
        // cesse d'être disponible, donc redemandable.
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

// GET /api/retraits/moi — Commerçant : ses demandes
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

// GET /api/retraits — Admin : toutes les demandes
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

// PATCH /api/retraits/:id — Admin : faire avancer une demande
//
// en_attente -> en_cours -> payee, ou -> rejetee (recrédite les fonds).
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

        // Un état terminal ne se rejoue pas : sans ce garde-fou, repasser
        // une demande payée en « rejetée » recréditerait un argent déjà versé.
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
            // Les fonds avaient été réservés à la demande : on les rend.
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
