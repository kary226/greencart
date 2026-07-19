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