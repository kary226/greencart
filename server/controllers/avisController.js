import ColisShein from "../models/ColisShein.js";
import MessageColis from "../models/MessageColis.js";
import AvisService from "../models/AvisService.js";

// POST /api/shein-cart/admin/:id/demander-avis
// Raccourci agent (à côté des réponses rapides) : poste une carte "avis" dans le
// chat qui demande une note 1-5 étoiles au client. Une seule demande active à la
// fois par colis — si une carte précédente n'a pas eu de réponse, on la referme
// silencieusement (superseded) pour éviter deux cartes actives en même temps.
export const demanderAvis = async (req, res) => {
    try {
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        await MessageColis.updateMany(
            { colisId: colis._id, type: "avis", "payload.repondu": false },
            { $set: { "payload.superseded": true } }
        );

        const message = await MessageColis.create({
            colisId: colis._id,
            expediteurRole: "agent",
            expediteurId: process.env.SELLER_EMAIL,
            type: "avis",
            payload: { libelle: "Comment s'est passée votre expérience avec nous ?" },
        });

        const now = new Date();
        colis.dernierMessageAgentAt = now;
        colis.adminDernierLu = now;
        await colis.save();

        res.json({ success: true, message });
    } catch (error) {
        console.error("Erreur demanderAvis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/:id/avis — soumission côté client
export const soumettreAvis = async (req, res) => {
    try {
        const { userId, messageId, etoiles, commentaire } = req.body;
        const colis = await ColisShein.findOne({ _id: req.params.id, userId });
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        const note = Number(etoiles);
        if (!note || note < 1 || note > 5) {
            return res.status(400).json({ success: false, message: "Note invalide (1 à 5 étoiles)" });
        }

        const carteAvis = await MessageColis.findOne({ _id: messageId, colisId: colis._id, type: "avis" });
        if (!carteAvis) return res.status(404).json({ success: false, message: "Demande d'avis introuvable" });
        if (carteAvis.payload?.repondu) {
            return res.status(400).json({ success: false, message: "Avis déjà envoyé pour cette demande" });
        }

        await AvisService.create({
            colisId: colis._id,
            userId,
            messageId: carteAvis._id,
            etoiles: note,
            commentaire: (commentaire || "").trim().slice(0, 500),
        });

        carteAvis.payload.repondu = true;
        carteAvis.payload.etoilesDonnees = note;
        await carteAvis.save();

        await MessageColis.create({
            colisId: colis._id,
            expediteurRole: "systeme",
            type: "systeme",
            texte: `Merci pour votre avis ${"⭐".repeat(note)} !`,
        });

        const now = new Date();
        colis.dernierMessageClientAt = now;
        colis.clientDernierLu = now;
        await colis.save();

        res.json({ success: true });
    } catch (error) {
        console.error("Erreur soumettreAvis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/shein-cart/admin/avis/stats
// Vue d'ensemble pour l'onglet "Avis clients" — moyenne, distribution par étoile,
// et les avis les plus récents (avec commentaire) pour un coup d'œil rapide.
export const getStatsAvis = async (req, res) => {
    try {
        const tousLesAvis = await AvisService.find({}).sort({ createdAt: -1 });
        const total = tousLesAvis.length;
        const moyenne = total > 0 ? tousLesAvis.reduce((sum, a) => sum + a.etoiles, 0) / total : 0;

        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        tousLesAvis.forEach((a) => { distribution[a.etoiles] = (distribution[a.etoiles] || 0) + 1; });

        const recents = await AvisService.find({})
            .sort({ createdAt: -1 })
            .limit(20)
            .populate("userId", "name email")
            .populate("colisId", "numeroSuivi");

        res.json({
            success: true,
            stats: { total, moyenne: Math.round(moyenne * 10) / 10, distribution },
            avis: recents,
        });
    } catch (error) {
        console.error("Erreur getStatsAvis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};