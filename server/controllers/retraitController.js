import DemandeRetrait from '../models/DemandeRetrait.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';

// ------------------------------------------------------------------ //
// POST /api/retraits — Commerçant : créer une demande de retrait
// ------------------------------------------------------------------ //
export const createRetrait = async (req, res) => {
    try {
        const { montant, moyenPaiement } = req.body;

        if (!montant || montant < 1000) {
            return res.status(400).json({ success: false, message: 'Montant minimum de retrait : 1000 FCFA' });
        }

        if (!moyenPaiement || moyenPaiement.trim().length < 3) {
            return res.status(400).json({ success: false, message: 'Moyen de paiement requis' });
        }

        // Vérifier le solde
        const wallet = await Wallet.findOne({ ownerId: req.staffUser._id });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Portefeuille non trouvé' });
        }

        await wallet.recalculerSolde();

        if (wallet.solde < montant) {
            return res.status(400).json({
                success: false,
                message: `Solde insuffisant. Solde actuel : ${wallet.solde} FCFA`
            });
        }

        // Vérifier s'il y a déjà une demande en attente
        const demandeExistante = await DemandeRetrait.findOne({
            commercialId: req.staffUser._id,
            statut: 'en_attente'
        });

        if (demandeExistante) {
            return res.status(400).json({
                success: false,
                message: 'Vous avez déjà une demande de retrait en attente'
            });
        }

        // Créer la demande
        const demande = await DemandeRetrait.create({
            commercialId: req.staffUser._id,
            montant,
            moyenPaiement: moyenPaiement.trim(),
            statut: 'en_attente',
        });

        return res.status(201).json({
            success: true,
            message: 'Demande de retrait créée avec succès',
            demande
        });
    } catch (error) {
        console.error('Erreur createRetrait:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/retraits/moi — Commerçant : voir ses demandes
// ------------------------------------------------------------------ //
export const getMesRetraits = async (req, res) => {
    try {
        const demandes = await DemandeRetrait.find({
            commercialId: req.staffUser._id
        }).sort({ createdAt: -1 });

        return res.status(200).json({ success: true, demandes });
    } catch (error) {
        console.error('Erreur getMesRetraits:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/retraits — Admin : lister toutes les demandes
// ------------------------------------------------------------------ //
export const listAllRetraits = async (req, res) => {
    try {
        const { statut } = req.query;
        const filter = {};
        if (statut) filter.statut = statut;

        const demandes = await DemandeRetrait.find(filter)
            .populate('commercialId', 'nom email')
            .populate('traitePar', 'nom email')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, demandes });
    } catch (error) {
        console.error('Erreur listAllRetraits:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// PATCH /api/retraits/:id — Admin : traiter une demande
// ------------------------------------------------------------------ //
export const traiterRetrait = async (req, res) => {
    try {
        const { id } = req.params;
        const { statut, noteAdmin, preuvePaiement } = req.body;

        if (!['approuvee', 'rejetee', 'payee'].includes(statut)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }

        const demande = await DemandeRetrait.findById(id);
        if (!demande) {
            return res.status(404).json({ success: false, message: 'Demande non trouvée' });
        }

        if (demande.statut === 'payee') {
            return res.status(400).json({ success: false, message: 'Cette demande est déjà payée' });
        }

        // Si on approuve ou paye, vérifier le solde
        if (statut === 'approuvee' || statut === 'payee') {
            const wallet = await Wallet.findOne({ ownerId: demande.commercialId });
            if (wallet) {
                await wallet.recalculerSolde();
                if (wallet.solde < demande.montant) {
                    return res.status(400).json({
                        success: false,
                        message: `Solde insuffisant (${wallet.solde} FCFA) pour ce retrait`
                    });
                }
            }
        }

        // Si statut = 'payee', on débite le wallet
        if (statut === 'payee') {
            const wallet = await Wallet.findOne({ ownerId: demande.commercialId });
            if (wallet) {
                // Créer la transaction de retrait
                await WalletTransaction.create({
                    walletId: wallet._id,
                    type: 'retrait',
                    montant: -demande.montant,
                    description: `Retrait approuvé - ${demande.moyenPaiement}`,
                    demandeRetraitId: demande._id,
                });
                await wallet.recalculerSolde();
            }
        }

        demande.statut = statut;
        demande.traitePar = req.staffUser._id;
        if (noteAdmin) demande.noteAdmin = noteAdmin;
        if (preuvePaiement) demande.preuvePaiement = preuvePaiement;
        await demande.save();

        return res.status(200).json({
            success: true,
            message: 'Demande traitée avec succès',
            demande
        });
    } catch (error) {
        console.error('Erreur traiterRetrait:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};