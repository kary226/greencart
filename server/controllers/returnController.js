import ReturnCase from '../models/ReturnCase.js';
import { journaliser } from '../services/journalService.js';
import {
    ouvrirRetour,
    avancerRetour,
    resoudreRetour,
    escaladerRetour,
} from '../services/returnWorkflowService.js';

/**
 * RETOURS  —  Guide RAMCI §10, §12
 * ================================
 * Le contrôleur ne fait que traduire HTTP vers le métier : toute la règle
 * (transitions, séparation Opérations/Finance, escalade) vit dans
 * services/returnWorkflowService.js — §15, « retour de bout en bout ».
 */

/**
 * Récupère tous les retours (filtrés par statut).
 * GET /api/admin/returns
 */
export const listReturns = async (req, res) => {
    try {
        const { statut, page = 1, limit = 50 } = req.query;

        const filter = {};
        if (statut) filter.statut = statut;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const returns = await ReturnCase.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('orderId', '_id amount status userId')
            .populate('scans', 'type photos note scanneLe')
            .populate('traitePar', 'nom email');

        const total = await ReturnCase.countDocuments(filter);

        return res.status(200).json({
            success: true,
            returns,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Erreur listReturns:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Récupère un retour par son ID.
 * GET /api/admin/returns/:id
 */
export const getReturnById = async (req, res) => {
    try {
        const { id } = req.params;

        const returnCase = await ReturnCase.findById(id)
            .populate('orderId', '_id amount status userId items')
            .populate('scans', 'type photos note scanneLe')
            .populate('traitePar', 'nom email')
            .populate('refundId');

        if (!returnCase) {
            return res.status(404).json({ success: false, message: 'Retour non trouvé' });
        }

        return res.status(200).json({
            success: true,
            return: returnCase,
        });
    } catch (error) {
        console.error('Erreur getReturnById:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * OUVERTURE D'UN RETOUR — Support (§10).
 * POST /api/admin/returns
 *
 * Étape qui manquait : le ReturnCase n'était créé par aucune route staff.
 * §10 place pourtant Support en tête du flux — « enregistre la demande et
 * rassemble les informations ».
 */
export const openReturn = async (req, res) => {
    try {
        const { orderId, motif, itemIds, boutiqueId } = req.body;
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId est requis' });
        }

        const resultat = await ouvrirRetour({
            orderId,
            acteur: req.staffUser,
            motif,
            itemIds: itemIds || [],
            boutiqueId: boutiqueId || null,
        });

        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({
                success: false,
                message: resultat.message,
                ...(resultat.retour ? { return: resultat.retour } : {}),
            });
        }

        return res.status(201).json({ success: true, message: resultat.message, return: resultat.retour });
    } catch (error) {
        console.error('Erreur openReturn:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * RÉCEPTION DU COLIS RETOURNÉ — Opérations (§10).
 * POST /api/admin/returns/:id/receive
 *
 * Photo obligatoire : c'est la seule preuve opposable de l'état constaté le
 * jour où le commerçant conteste la reprise d'argent.
 */
export const receiveReturn = async (req, res) => {
    try {
        const { note, photos } = req.body;
        const returnCase = await ReturnCase.findById(req.params.id);
        if (!returnCase) {
            return res.status(404).json({ success: false, message: 'Retour non trouvé' });
        }

        const resultat = await avancerRetour({
            retour: returnCase,
            acteur: req.staffUser,
            vers: 'return_received',
            note,
            photos: photos || [],
        });

        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({ success: false, message: resultat.message });
        }

        return res.status(200).json({ success: true, message: resultat.message, return: resultat.retour });
    } catch (error) {
        console.error('Erreur receiveReturn:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * INSPECTION — Opérations (§10).
 * POST /api/admin/returns/:id/inspect
 */
export const inspectReturn = async (req, res) => {
    try {
        const { etat, note, photos } = req.body;
        const returnCase = await ReturnCase.findById(req.params.id);
        if (!returnCase) {
            return res.status(404).json({ success: false, message: 'Retour non trouvé' });
        }

        const resultat = await avancerRetour({
            retour: returnCase,
            acteur: req.staffUser,
            vers: 'return_inspection',
            note,
            photos: photos || [],
            etat,
        });

        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({ success: false, message: resultat.message });
        }

        return res.status(200).json({ success: true, message: resultat.message, return: resultat.retour });
    } catch (error) {
        console.error('Erreur inspectReturn:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ESCALADE AU SUPER ADMIN — §10, §12, §19 cas C.
 * POST /api/admin/returns/:id/escalader
 */
export const escalateReturn = async (req, res) => {
    try {
        const { motif } = req.body;
        const returnCase = await ReturnCase.findById(req.params.id);
        if (!returnCase) {
            return res.status(404).json({ success: false, message: 'Retour non trouvé' });
        }

        const resultat = await escaladerRetour({ retour: returnCase, acteur: req.staffUser, motif });
        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({ success: false, message: resultat.message });
        }

        return res.status(202).json({
            success: true,
            message: resultat.message,
            return: resultat.retour,
            approvalRequestId: resultat.approval._id,
        });
    } catch (error) {
        console.error('Erreur escalateReturn:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * RÉSOLUTION — Opérations décide, Finance exécutera (§10).
 * POST /api/admin/returns/:id/resolve
 */
export const resolveReturn = async (req, res) => {
    try {
        const {
            resolution,
            responsabilite,
            montantDecide,
            motif,
            remboursementMethode = 'rcoins',
            noteInterne,
            noteClient,
        } = req.body;

        const returnCase = await ReturnCase.findById(req.params.id);
        if (!returnCase) {
            return res.status(404).json({ success: false, message: 'Retour non trouvé' });
        }

        const resultat = await resoudreRetour({
            retour: returnCase,
            acteur: req.staffUser,
            resolution,
            responsabilite,
            montantDecide,
            motif,
            methode: remboursementMethode,
            noteInterne,
            noteClient,
        });

        if (!resultat.ok) {
            return res.status(resultat.code || 400).json({ success: false, message: resultat.message });
        }

        return res.status(200).json({
            success: true,
            message: resultat.message,
            return: resultat.retour,
            refundId: resultat.refund?._id || null,
            // Le remboursement attend Finance : l'écran doit le dire, sinon
            // Opérations croit le dossier clos (§10, §14).
            remboursementEnAttenteDeFinance: Boolean(resultat.refund),
        });
    } catch (error) {
        console.error('Erreur resolveReturn:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Rejette un retour (sans remboursement).
 * POST /api/admin/returns/:id/reject
 */
export const rejectReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const { motif, noteInterne } = req.body;

        const returnCase = await ReturnCase.findById(id);
        if (!returnCase) {
            return res.status(404).json({ success: false, message: 'Retour non trouvé' });
        }

        if (returnCase.statut === 'resolved') {
            return res.status(409).json({
                success: false,
                message: 'Ce retour est déjà résolu',
            });
        }

        returnCase.statut = 'resolved';
        returnCase.resolution = 'reject_return';
        returnCase.responsabilite = 'client';
        returnCase.noteInterne = noteInterne || `Rejeté: ${motif || 'Motif non spécifié'}`;
        returnCase.traitePar = req.staffUser._id;
        returnCase.traiteLe = new Date();

        await returnCase.save();

        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'returns.reject',
            cible: { id: returnCase._id, libelle: `Retour ${returnCase._id}` },
            note: `Rejeté: ${motif || 'Motif non spécifié'}`,
        });

        return res.status(200).json({
            success: true,
            message: 'Retour rejeté',
            return: returnCase,
        });
    } catch (error) {
        console.error('Erreur rejectReturn:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};