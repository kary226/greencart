import ColisShein from "../models/ColisShein.js";
import MessageColis from "../models/MessageColis.js";

// Vérifie que le colis appartient bien au client avant de le laisser lire/écrire —
// même logique IDOR que getColisById.
const verifierProprietaire = async (colisId, userId) => {
    const colis = await ColisShein.findOne({ _id: colisId, userId });
    return colis;
};

// GET /api/shein-cart/:id/messages
export const getMessages = async (req, res) => {
    try {
        const colis = await verifierProprietaire(req.params.id, req.body.userId);
        if (!colis) {
            return res.status(404).json({ success: false, message: "Colis introuvable" });
        }
        const messages = await MessageColis.find({ colisId: req.params.id }).sort({ createdAt: 1 });
        res.json({ success: true, messages });
    } catch (error) {
        console.error("Erreur getMessages:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/:id/messages — envoi côté client
export const sendMessageClient = async (req, res) => {
    try {
        const { userId, texte } = req.body;
        if (!texte || !texte.trim()) {
            return res.status(400).json({ success: false, message: "Message vide" });
        }
        const colis = await verifierProprietaire(req.params.id, userId);
        if (!colis) {
            return res.status(404).json({ success: false, message: "Colis introuvable" });
        }
        const message = await MessageColis.create({
            colisId: req.params.id,
            expediteurRole: "client",
            expediteurId: userId,
            texte: texte.trim(),
        });
        res.json({ success: true, message });
    } catch (error) {
        console.error("Erreur sendMessageClient:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};