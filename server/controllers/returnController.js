import ReturnCase from '../models/ReturnCase.js';
import WarehouseScan from '../models/WarehouseScan.js';
import Order from '../models/Order.js';
import Refund from '../models/Refund.js';
import { traiterRetourColis } from '../services/walletService.js';
import { journaliser } from '../services/journalService.js';
import { v4 as uuidv4 } from 'uuid';

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
 * Passe un retour à l'étape d'inspection.
 * POST /api/admin/returns/:id/inspect
 */
export const inspectReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const { etat, note, photos } = req.body;

        const returnCase = await ReturnCase.findById(id);
        if (!returnCase) {
            return res.status(404).json({ success: false, message: 'Retour non trouvé' });
        }

        if (returnCase.statut !== 'return_received') {
            return res.status(409).json({
                success: false,
                message: `Le retour doit être au statut 'return_received' (actuel: ${returnCase.statut})`,
            });
        }

        // Créer un scan d'inspection
        const scan = await WarehouseScan.create({
            orderId: returnCase.orderId,
            boutiqueId: returnCase.boutiqueId || null,
            type: 'retour_inspection',
            scannePar: req.staffUser._id,
            photos: photos || [],
            note: note || `Inspection: ${etat}`,
        });

        // Mettre à jour le ReturnCase
        returnCase.statut = 'return_inspection';
        if (!returnCase.scans.includes(scan._id)) {
            returnCase.scans.push(scan._id);
        }
        returnCase.responsabilite = 'non_determinee';
        await returnCase.save();

        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'returns.inspect',
            cible: { id: returnCase._id, libelle: `Retour ${returnCase._id}` },
            note: `Inspection : ${etat}`,
        });

        return res.status(200).json({
            success: true,
            message: 'Retour passé en inspection',
            return: returnCase,
            scan,
        });
    } catch (error) {
        console.error('Erreur inspectReturn:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Résout un retour (décision finale).
 * POST /api/admin/returns/:id/resolve
 */
export const resolveReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            resolution,
            responsabilite,
            montantDecide,
            motif,
            remboursementMethode = 'rcoins',
            noteInterne,
            noteClient,
        } = req.body;

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

        const validResolutions = ['refund_client', 'reroute_to_seller', 'reject_return', 'partial_refund'];
        if (!validResolutions.includes(resolution)) {
            return res.status(400).json({
                success: false,
                message: `Résolution invalide. Options: ${validResolutions.join(', ')}`,
            });
        }

        // Récupérer la commande
        const order = await Order.findById(returnCase.orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande non trouvée' });
        }

        let refundId = null;

        // Si remboursement client, créer un Refund
        if (resolution === 'refund_client' || resolution === 'partial_refund') {
            const montant = montantDecide || order.amount;

            // Générer un refundId unique
            const refundUuid = uuidv4();

            const refund = await Refund.create({
                orderId: order._id,
                itemIds: returnCase.itemIds || [],
                montantApprouve: montant,
                methode: remboursementMethode,
                statut: 'approved', // Approuvé directement par le warehouse_admin
                refundId: refundUuid,
                demandePar: req.staffUser._id,
                approuvePar: req.staffUser._id,
                motif: motif || `Retour résolu - ${resolution}`,
                plafondNetAutorise: montant,
                approuveLe: new Date(),
                noteInterne: noteInterne || '',
            });

            refundId = refund._id;

            // Exécuter le retour financier via walletService
            const result = await traiterRetourColis(order, {
                boutiqueIds: returnCase.boutiqueId ? [returnCase.boutiqueId] : null,
                etat: responsabilite === 'commercant' ? 'endommage' : 'bon_etat',
            });

            // Journaliser le remboursement
            await journaliser({
                acteur: {
                    id: req.staffUser._id,
                    nom: req.staffUser.nom,
                    role: req.staffUser.role,
                },
                action: 'refund.approve',
                cible: { id: refund._id, libelle: `Remboursement ${refundUuid}` },
                note: `Montant: ${montant} FCFA, méthode: ${remboursementMethode}`,
            });
        }

        // Mettre à jour le ReturnCase
        returnCase.statut = 'resolved';
        returnCase.resolution = resolution;
        returnCase.responsabilite = responsabilite || 'non_determinee';
        returnCase.montantDecide = montantDecide || 0;
        returnCase.refundId = refundId || null;
        returnCase.noteInterne = noteInterne || returnCase.noteInterne;
        returnCase.noteClient = noteClient || '';
        returnCase.traitePar = req.staffUser._id;
        returnCase.traiteLe = new Date();

        await returnCase.save();

        // Journaliser la résolution
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'returns.resolve',
            cible: { id: returnCase._id, libelle: `Retour ${returnCase._id}` },
            note: `Résolution: ${resolution}, responsabilité: ${responsabilite || 'non_determinee'}`,
        });

        return res.status(200).json({
            success: true,
            message: 'Retour résolu avec succès',
            return: returnCase,
            refundId,
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