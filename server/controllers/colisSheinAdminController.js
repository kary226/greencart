import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import ColisShein from "../models/ColisShein.js";
import MessageColis from "../models/MessageColis.js";
import Setting from "../models/Setting.js";

const ArticleSheinInputSchema = ["boutique", "nom", "variante", "prixUnitaire", "prixOriginal", "quantite"];

// GET /api/shein-cart/admin/all?statut=soumis (statut optionnel)
export const getAllColisAdmin = async (req, res) => {
    try {
        const filtre = req.query.statut ? { statut: req.query.statut } : {};
        const colisRaw = await ColisShein.find(filtre).populate("userId", "name email").sort({ updatedAt: -1 });
        const colis = colisRaw.map((c) => {
            const obj = c.toObject();
            obj.nonLu = !!(c.dernierMessageClientAt && (!c.adminDernierLu || c.dernierMessageClientAt > c.adminDernierLu));
            return obj;
        });
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur getAllColisAdmin:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/shein-cart/admin/:id
export const getColisAdminById = async (req, res) => {
    try {
        const colis = await ColisShein.findById(req.params.id).populate("userId", "name email");
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur getColisAdminById:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/admin/:id/validate
// L'agent envoie les articles corrigés (peut être identique à l'extraction si rien à changer).
// Le taux de change vient du Setting global — jamais du client, jamais modifiable après coup
// pour CE colis une fois figé ici (tauxApplique).
export const validateColis = async (req, res) => {
    try {
        const { articles, fraisLivraisonEstime } = req.body;
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ success: false, message: "Aucun article à valider" });
        }

        const articlesValides = articles.map((a) => ({
            boutique: a.boutique || "",
            nom: a.nom || "",
            variante: a.variante || "",
            prixUnitaire: Number(a.prixUnitaire) || 0,
            prixOriginal: a.prixOriginal != null ? Number(a.prixOriginal) : null,
            quantite: Number(a.quantite) || 1,
        }));

        const montantArticles = articlesValides.reduce((sum, a) => sum + a.prixUnitaire * a.quantite, 0);

        // Taux de change : lu depuis le Setting global, pas de valeur par défaut arbitraire —
        // si l'admin ne l'a jamais configuré, on bloque plutôt que d'appliquer un taux inventé.
        let tauxApplique = null;
        let montantArticlesFCFA = null;
        if (colis.devise) {
            const setting = await Setting.findOne({ key: "sheinExchangeRates" });
            const taux = setting?.value?.[colis.devise.toLowerCase()];
            if (!taux) {
                return res.status(400).json({
                    success: false,
                    message: `Aucun taux configuré pour ${colis.devise}. Va dans Réglages pour le définir avant de valider.`,
                });
            }
            tauxApplique = taux;
            montantArticlesFCFA = montantArticles * taux;
        }

        colis.articlesValides = articlesValides;
        colis.devis.montantArticles = montantArticles;
        colis.devis.tauxApplique = tauxApplique;
        colis.devis.montantArticlesFCFA = montantArticlesFCFA;
        if (fraisLivraisonEstime != null) colis.devis.fraisLivraisonEstime = Number(fraisLivraisonEstime);
        colis.statut = "devis_envoye";
        colis.historique.push({
            action: "validation_agent",
            agent: process.env.SELLER_EMAIL,
            note: "Panier vérifié et devis validé par l'agent",
        });

        await colis.save();
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur validateColis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/admin/:id/statut — transitions génériques pour la suite du parcours
// (acompte_paye, achete, en_entrepot, pese avec poidsReel, solde_paye, en_livraison, livre, annule)
export const updateStatutColis = async (req, res) => {
    try {
        const { statut, note, poidsReel, tauxParKilo } = req.body;
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        const statutsValides = ColisShein.schema.path("statut").enumValues;
        if (!statutsValides.includes(statut)) {
            return res.status(400).json({ success: false, message: "Statut invalide" });
        }

        // Pesée : calcule le solde dû dès que poids + taux/kg sont connus
        if (statut === "pese") {
            if (poidsReel == null || (tauxParKilo == null && !colis.devis.tauxParKilo)) {
                return res.status(400).json({ success: false, message: "Poids réel et taux au kilo requis pour cette étape" });
            }
            colis.devis.poidsReel = Number(poidsReel);
            if (tauxParKilo != null) colis.devis.tauxParKilo = Number(tauxParKilo);
            const fraisTransport = colis.devis.poidsReel * colis.devis.tauxParKilo;
            colis.devis.montantFinal = (colis.devis.montantArticlesFCFA || 0) + fraisTransport;
            colis.paiement.soldeMontant = colis.devis.montantFinal - (colis.paiement.acompteMontant || 0);
        }

        colis.statut = statut;
        colis.historique.push({
            action: `statut_${statut}`,
            agent: process.env.SELLER_EMAIL,
            note: note || "",
        });

        await colis.save();
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur updateStatutColis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/shein-cart/admin/:id/messages
// Marque la conversation comme lue par l'agent — fait disparaître le badge "non lu" de la liste.
export const getMessagesAdmin = async (req, res) => {
    try {
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });
        const messages = await MessageColis.find({ colisId: req.params.id }).sort({ createdAt: 1 });
        colis.adminDernierLu = new Date();
        await colis.save();
        res.json({ success: true, messages });
    } catch (error) {
        console.error("Erreur getMessagesAdmin:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/admin/:id/messages — texte et/ou image
export const sendMessageAgent = async (req, res) => {
    try {
        const { texte } = req.body;
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        if ((!texte || !texte.trim()) && !req.file) {
            return res.status(400).json({ success: false, message: "Message vide" });
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { resource_type: "image", folder: "shein-chat" },
                    (error, result) => (error ? reject(error) : resolve(result.secure_url))
                );
                stream.end(req.file.buffer);
            });
        }

        const message = await MessageColis.create({
            colisId: req.params.id,
            expediteurRole: "agent",
            expediteurId: process.env.SELLER_EMAIL,
            texte: texte?.trim() || "",
            imageUrl,
        });

        const now = new Date();
        colis.dernierMessageAgentAt = now;
        colis.adminDernierLu = now;
        await colis.save();

        res.json({ success: true, message });
    } catch (error) {
        console.error("Erreur sendMessageAgent:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};