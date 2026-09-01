import DemandeRetrait, { OPERATEURS_RETRAIT } from '../models/DemandeRetrait.js';
import {
    demanderRetrait,
    traiterRetrait as traiterRetraitService,
    escalader,
} from '../services/withdrawalService.js';

/**
 * RETRAITS  —  Guide RAMCI §9, §13, §19 cas A
 * ===========================================
 * Le contrôleur ne fait plus que traduire HTTP ↔ métier. Toute la règle
 * (réservation des fonds, transitions, escalade) vit dans
 * services/withdrawalService.js — §15 : « flux unique de demande et
 * traitement ».
 *
 * Ce qui a disparu ici : la branche « montant > seuil → demande
 * d'approbation ». Le guide la supprime (§9), et elle laissait les fonds
 * non réservés pendant toute l'approbation. Voir withdrawalService.js.
 */

// ─── GET /api/retraits/operateurs ──────────────────────────────────
export const listOperateurs = async (req, res) => {
    res.json({ success: true, operateurs: OPERATEURS_RETRAIT });
};

// ─── POST /api/retraits ─────────────────────────────────────────────
export const createRetrait = async (req, res) => {
    try {
        const resultat = await demanderRetrait({
            commercant: req.staffUser,
            donnees: req.body,
        });

        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({
                success: false,
                message: resultat.message,
            });
        }

        return res.status(resultat.code || 201).json({
            success: true,
            message: resultat.message,
            demande: resultat.demande,
            ...(resultat.rejeu ? { rejeu: true } : {}),
            ...(resultat.soldeRestant !== undefined ? { soldeRestant: resultat.soldeRestant } : {}),
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
            demandes: demandes.map((d) => ({
                ...d,
                operateurLibelle: libelleOperateur.get(d.operateur) || d.operateur,
            })),
            aTraiter: demandes.filter((d) => d.statut === 'en_attente').length,
            // Séparer explicitement ce qui attend le Super Admin de ce qui
            // attend Finance : §14, « chaque acteur doit d'abord voir ce
            // qu'il doit faire maintenant ».
            escalades: demandes.filter((d) => d.statut === 'escalade').length,
        });
    } catch (error) {
        console.error('Erreur listAllRetraits:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── PATCH /api/retraits/:id ────────────────────────────────────────
export const traiterRetrait = async (req, res) => {
    try {
        const { statut, noteAdmin, reference, preuvePaiement } = req.body;

        const demande = await DemandeRetrait.findById(req.params.id);
        if (!demande) {
            return res.status(404).json({ success: false, message: 'Demande introuvable' });
        }

        const resultat = await traiterRetraitService({
            demande,
            acteur: req.staffUser,
            statut,
            reference,
            noteAdmin,
            preuvePaiement,
        });

        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({
                success: false,
                message: resultat.message,
            });
        }

        return res.json({ success: true, message: resultat.message, demande: resultat.demande });
    } catch (error) {
        console.error('Erreur traiterRetrait:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── POST /api/retraits/:id/escalader ───────────────────────────────
//
// §9 : « Le Super Admin intervient si le dossier est suspect, incohérent,
// exceptionnel ou contesté. » C'est le remplaçant du seuil : une personne
// qui regarde le dossier décide, avec un motif.
export const escaladerRetrait = async (req, res) => {
    try {
        const { motif } = req.body;

        const demande = await DemandeRetrait.findById(req.params.id);
        if (!demande) {
            return res.status(404).json({ success: false, message: 'Demande introuvable' });
        }

        const resultat = await escalader({ demande, acteur: req.staffUser, motif });

        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({
                success: false,
                message: resultat.message,
            });
        }

        return res.status(202).json({
            success: true,
            message: resultat.message,
            demande: resultat.demande,
            approvalRequestId: resultat.approval._id,
        });
    } catch (error) {
        console.error('Erreur escaladerRetrait:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
