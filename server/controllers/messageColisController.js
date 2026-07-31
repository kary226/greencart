import { v2 as cloudinary } from "cloudinary";
import ColisShein from "../models/ColisShein.js";
import MessageColis from "../models/MessageColis.js";

const verifierProprietaire = async (colisId, userId) => {
    return ColisShein.findOne({ _id: colisId, userId });
};

const uploadImage = (buffer) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: "image", folder: "shein-chat" },
            (error, result) => (error ? reject(error) : resolve(result.secure_url))
        );
        stream.end(buffer);
    });

// GET /api/shein-cart/:id/messages
// Marque aussi la conversation comme lue côté client (déclenche la disparition
// du badge "nouveau message de l'agent" dans la liste /mes-colis-shein).
export const getMessages = async (req, res) => {
    try {
        const colis = await verifierProprietaire(req.params.id, req.body.userId);
        if (!colis) {
            return res.status(404).json({ success: false, message: "Colis introuvable" });
        }
        const messages = await MessageColis.find({ colisId: req.params.id }).sort({ createdAt: 1 });
        colis.clientDernierLu = new Date();
        await colis.save();
        res.json({ success: true, messages });
    } catch (error) {
        console.error("Erreur getMessages:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/:id/messages — envoi côté client, texte et/ou image
export const sendMessageClient = async (req, res) => {
    try {
        const { userId, texte } = req.body;
        const colis = await verifierProprietaire(req.params.id, userId);
        if (!colis) {
            return res.status(404).json({ success: false, message: "Colis introuvable" });
        }
        if ((!texte || !texte.trim()) && !req.file) {
            return res.status(400).json({ success: false, message: "Message vide" });
        }

        let imageUrl = null;
        if (req.file) imageUrl = await uploadImage(req.file.buffer);

        const message = await MessageColis.create({
            colisId: req.params.id,
            expediteurRole: "client",
            expediteurId: userId,
            texte: texte?.trim() || "",
            imageUrl,
        });

        const now = new Date();
        colis.dernierMessageClientAt = now;
        colis.clientDernierLu = now; // le client vient d'écrire, donc sa propre conversation est "lue" pour lui
        await colis.save();

        res.json({ success: true, message });
    } catch (error) {
        console.error("Erreur sendMessageClient:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/:id/typing — signal léger "le client écrit", appelé en continu
// pendant la frappe (débattu côté front). updateOne pour rester très bon marché,
// aucun besoin de charger/valider tout le document pour ça.
export const setClientTyping = async (req, res) => {
    try {
        await ColisShein.updateOne(
            { _id: req.params.id, userId: req.body.userId },
            { clientTypingAt: new Date() }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// =============================================================
// ✅ PHASE 5 : FONCTIONS POUR STAFF (Assistant/Admin)
// =============================================================

// ENVOYER UN MESSAGE (Agent)
export const sendMessage = async (req, res) => {
    try {
        const { colisId } = req.params;
        const { texte, type, montant, libelle, paymentType, detail } = req.body;

        if (!texte || texte.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Le message est requis',
            });
        }

        const conversation = await ColisShein.findById(colisId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation non trouvée',
            });
        }

        if (req.staffUser.role === 'assistant_shein') {
            if (conversation.agentAssigneld?.toString() !== req.staffUser._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Vous n\'avez pas accès à cette conversation',
                });
            }
        }

        const newMessage = await MessageColis.create({
            colisId,
            expediteurRole: 'agent',
            expediteurId: req.staffUser.email,
            agentStaffId: req.staffUser._id,
            texte: texte.trim(),
            type: type || 'texte',
            payload: {
                montant: montant || null,
                libelle: libelle || null,
                paymentType: paymentType || null,
                detail: detail || null,
                superseded: false,
                repondu: false,
                etoilesDonnees: null,
            },
        });

        if (type === 'devis' && montant) {
            conversation.devis.montantArticles = montant;
            conversation.statut = 'devis_envoye';
            await conversation.save();
        }

        await newMessage.populate('agentStaffId', 'nom email');

        return res.status(201).json({
            success: true,
            message: 'Message envoyé',
            messageData: newMessage,
        });
    } catch (error) {
        console.error('Erreur sendMessage:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// RÉCUPÉRER LES MESSAGES (Staff)
export const getMessagesStaff = async (req, res) => {
    try {
        const { colisId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const conversation = await ColisShein.findById(colisId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation non trouvée',
            });
        }

        if (req.staffUser.role === 'assistant_shein') {
            if (conversation.agentAssigneld?.toString() !== req.staffUser._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Vous n\'avez pas accès à cette conversation',
                });
            }
        }

        const skip = (page - 1) * limit;

        const messages = await MessageColis.find({ colisId })
            .populate('agentStaffId', 'nom email')
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit);

        const total = await MessageColis.countDocuments({ colisId });

        return res.status(200).json({
            success: true,
            messages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Erreur getMessagesStaff:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// METTRE À JOUR LE STATUT DU COLIS (via message)
export const updateColisStatut = async (req, res) => {
    try {
        const { colisId } = req.params;
        const { statut, note } = req.body;

        const validStatuses = [
            'soumis', 'en_verification', 'devis_envoye',
            'acompte_paye', 'achete', 'en_entrepot', 'pese',
            'solde_du', 'solde_paye', 'en_livraison',
            'livre', 'annule'
        ];

        if (!validStatuses.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide',
            });
        }

        const conversation = await ColisShein.findById(colisId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation non trouvée',
            });
        }

        if (req.staffUser.role === 'assistant_shein') {
            if (conversation.agentAssigneld?.toString() !== req.staffUser._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Vous n\'avez pas accès à cette conversation',
                });
            }
        }

        const ancienStatut = conversation.statut;
        conversation.statut = statut;

        conversation.historique.push({
            action: `Statut changé de "${ancienStatut}" à "${statut}"`,
            agent: req.staffUser.email || req.staffUser.nom,
            note: note || '',
        });

        await conversation.save();

        await MessageColis.create({
            colisId,
            expediteurRole: 'systeme',
            expediteurId: null,
            agentStaffId: null,
            texte: `📌 Statut mis à jour : ${statut}`,
            type: 'systeme',
            payload: {},
        });

        return res.status(200).json({
            success: true,
            message: 'Statut mis à jour avec succès',
            conversation,
        });
    } catch (error) {
        console.error('Erreur updateColisStatut:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ENVOYER UN DEVIS (via message)
export const sendDevis = async (req, res) => {
    try {
        const { colisId } = req.params;
        const { montant, libelle, detail } = req.body;

        if (!montant || montant <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Le montant du devis est requis',
            });
        }

        const conversation = await ColisShein.findById(colisId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation non trouvée',
            });
        }

        if (req.staffUser.role === 'assistant_shein') {
            if (conversation.agentAssigneld?.toString() !== req.staffUser._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Vous n\'avez pas accès à cette conversation',
                });
            }
        }

        const newMessage = await MessageColis.create({
            colisId,
            expediteurRole: 'agent',
            expediteurId: req.staffUser.email,
            agentStaffId: req.staffUser._id,
            texte: `📄 Devis : ${montant.toLocaleString()} FCFA`,
            type: 'devis',
            payload: {
                montant: montant,
                libelle: libelle || 'Devis',
                paymentType: 'shein_acompte',
                detail: detail || '',
                superseded: false,
                repondu: false,
                etoilesDonnees: null,
            },
        });

        conversation.devis.montantArticles = montant;
        conversation.statut = 'devis_envoye';
        await conversation.save();

        await newMessage.populate('agentStaffId', 'nom email');

        return res.status(201).json({
            success: true,
            message: 'Devis envoyé avec succès',
            messageData: newMessage,
        });
    } catch (error) {
        console.error('Erreur sendDevis:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};