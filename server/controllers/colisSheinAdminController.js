import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import ColisShein from "../models/ColisShein.js";
import MessageColis from "../models/MessageColis.js";
import Setting from "../models/Setting.js";

const ArticleSheinInputSchema = ["boutique", "nom", "variante", "prixUnitaire", "prixOriginal", "quantite"];

// Poste un message "devis" auto-généré dans le chat — la carte apparaît dans la
// conversation avec un bouton de paiement, en plus (pas à la place) du bouton
// fixe en haut de la page client.
const posterDevisMessage = async (colisId, montant, libelle, paymentType, detail = null) => {
    // Les anciens devis du même type (même paymentType) deviennent obsolètes —
    // pas de suppression, ils gardent leur trace, mais plus de bouton "Payer"
    // et plus de badge "payé" hérité à tort.
    await MessageColis.updateMany(
        { colisId, type: "devis", "payload.paymentType": paymentType },
        { $set: { "payload.superseded": true } }
    );
    await MessageColis.create({
        colisId,
        expediteurRole: "agent",
        expediteurId: process.env.SELLER_EMAIL,
        type: "devis",
        payload: { montant, libelle, paymentType, detail },
    });
};

// Poste un badge système (confirmation) — visible des deux côtés, sans bulle orientée.
export const posterMessageSysteme = async (colisId, texte) => {
    await MessageColis.create({ colisId, expediteurRole: "systeme", type: "systeme", texte });
};

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
        const { articles, devise } = req.body;
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ success: false, message: "Aucun article à valider" });
        }

        // Si l'admin corrige/fournit la devise dans ce même appel (cas où l'extraction
        // ne l'avait pas détectée), on l'applique avant de calculer le FCFA.
        if (devise === "USD" || devise === "EUR") colis.devise = devise;

        const articlesValides = articles.map((a) => ({
            boutique: a.boutique || "",
            nom: a.nom || "",
            variante: a.variante || "",
            prixUnitaire: Number(a.prixUnitaire) || 0,
            prixOriginal: a.prixOriginal != null ? Number(a.prixOriginal) : null,
            quantite: Number(a.quantite) || 1,
        }));

        const montantArticles = articlesValides.reduce((sum, a) => sum + a.prixUnitaire * a.quantite, 0);

        // La devise est obligatoire pour calculer un montant FCFA — jamais de devis
        // à 0 FCFA envoyé silencieusement. Si l'extraction ne l'a pas détectée,
        // on bloque et on demande à l'admin de la préciser (voir champ devise ci-dessus).
        if (!colis.devise) {
            return res.status(400).json({
                success: false,
                message: "Devise inconnue pour ce colis — précise USD ou EUR avant d'envoyer le devis.",
            });
        }

        const setting = await Setting.findOne({ key: "sheinExchangeRates" });
        const taux = setting?.value?.[colis.devise.toLowerCase()];
        if (!taux) {
            return res.status(400).json({
                success: false,
                message: `Aucun taux configuré pour ${colis.devise}. Renseigne-le dans la barre en haut avant de valider.`,
            });
        }
        const tauxApplique = taux;
        const montantArticlesFCFA = montantArticles * taux;

        colis.articlesValides = articlesValides;
        colis.devis.montantArticles = montantArticles;
        colis.devis.tauxApplique = tauxApplique;
        colis.devis.montantArticlesFCFA = montantArticlesFCFA;

        // Paiement n°1 : uniquement le prix des articles, rien à voir avec la livraison
        // qui n'est connue qu'après la pesée. Figé ici — un changement ultérieur du
        // taux de change n'affecte plus ce montant pour ce colis.
        colis.devis.montantInitial = Math.round(montantArticlesFCFA || 0);
        colis.paiement.acompteMontant = colis.devis.montantInitial;

        // Si le client avait déjà payé une version précédente de ce devis (admin
        // revenu en arrière pour corriger), on remet le paiement à zéro — le montant
        // a changé, l'ancien paiement ne couvre plus forcément le bon total.
        const etaitDejaPaye = colis.paiement.acomptePaye;
        if (etaitDejaPaye) {
            colis.paiement.acomptePaye = false;
            colis.paiement.acompteDate = null;
        }

        colis.statut = "devis_envoye";
        colis.historique.push({
            action: "validation_agent",
            agent: process.env.SELLER_EMAIL,
            note: etaitDejaPaye
                ? `Devis corrigé après un paiement déjà reçu — nouveau montant à payer : ${colis.devis.montantInitial} FCFA`
                : `Panier vérifié — prix des articles à payer : ${colis.devis.montantInitial} FCFA`,
        });

        await colis.save();
        await posterDevisMessage(colis._id, colis.devis.montantInitial, "Prix des articles", "shein_acompte");
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur validateColis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/shein-cart/admin/:id/statut — transitions génériques pour la suite du parcours
export const updateStatutColis = async (req, res) => {
    try {
        const { statut, note, poidsReel, tauxParKilo, fraisLivraisonAbidjan } = req.body;
        const colis = await ColisShein.findById(req.params.id);
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });

        const statutsValides = ColisShein.schema.path("statut").enumValues;
        if (!statutsValides.includes(statut)) {
            return res.status(400).json({ success: false, message: "Statut invalide" });
        }

        // Pesée : deuxième devis, indépendant du premier — uniquement kilo + livraison Abidjan,
        // jamais le prix des articles (déjà payé au paiement n°1).
        if (statut === "pese") {
            if (poidsReel == null || (tauxParKilo == null && !colis.devis.tauxParKilo)) {
                return res.status(400).json({ success: false, message: "Poids réel et taux au kilo requis pour cette étape" });
            }
            colis.devis.poidsReel = Number(poidsReel);
            if (tauxParKilo != null) colis.devis.tauxParKilo = Number(tauxParKilo);
            if (fraisLivraisonAbidjan != null) colis.devis.fraisLivraisonEstime = Number(fraisLivraisonAbidjan);

            const fraisTransport = colis.devis.poidsReel * colis.devis.tauxParKilo;
            colis.devis.montantFinal = fraisTransport + (colis.devis.fraisLivraisonEstime || 0);
            colis.paiement.soldeMontant = colis.devis.montantFinal;

            // Même logique que pour le paiement articles — une pesée corrigée après
            // un paiement déjà reçu invalide ce paiement pour le nouveau montant.
            if (colis.paiement.soldePaye) {
                colis.paiement.soldePaye = false;
                colis.paiement.soldeDate = null;
            }
        }

        colis.statut = statut;
        colis.historique.push({
            action: `statut_${statut}`,
            agent: process.env.SELLER_EMAIL,
            note: note || "",
        });

        await colis.save();
        if (statut === "pese") {
            const detail = `${colis.devis.poidsReel} kg × ${colis.devis.tauxParKilo} FCFA/kg + ${colis.devis.fraisLivraisonEstime || 0} FCFA livraison Abidjan`;
            await posterDevisMessage(colis._id, colis.paiement.soldeMontant, "Livraison (poids + Abidjan)", "shein_solde", detail);
        }
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

// POST /api/shein-cart/admin/:id/typing — signal léger "l'agent écrit", même logique
// que setClientTyping côté client (updateOne, pas de validation complète du document).
export const setAgentTyping = async (req, res) => {
    try {
        await ColisShein.updateOne({ _id: req.params.id }, { agentTypingAt: new Date() });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};