import { v2 as cloudinary } from "cloudinary";
import ColisShein from "../models/ColisShein.js";
import MessageColis from "../models/MessageColis.js";
import Setting from "../models/Setting.js";
import { validerCaptures, extrairePanier } from "../services/sheinExtraction.js";

const MESSAGE_BIENVENUE_DEFAUT =
    "Merci pour votre commande ! Elle a bien été reçue et un agent vous répondra très prochainement pour vous envoyer votre devis.";

// POST /api/shein-cart/analyze
// Reçoit les captures (multipart, champ "captures") ET le lien de partage (champ "lienPartage") —
// les deux sont obligatoires ensemble, aucun des deux seul ne suffit à lancer l'analyse.
//
// [SHEIN-SCAN] L'extraction elle-même vit dans services/sheinExtraction.js :
// prompt, schéma de sortie et contrôles de cohérence y sont regroupés pour
// pouvoir être testés hors requête HTTP (voir scripts/evalSheinExtraction.js).
export const analyzeCart = async (req, res) => {
    try {
        const files = req.files || [];
        const lienPartage = (req.body.lienPartage || "").trim();

        if (!lienPartage) {
            return res.status(400).json({ success: false, message: "Le lien du panier est requis" });
        }

        const validation = validerCaptures(files);
        if (!validation.ok) {
            return res.status(400).json({ success: false, message: validation.message });
        }

        // Upload Cloudinary et analyse lancés en parallèle : ils ne dépendent
        // pas l'un de l'autre, et l'analyse vision est de loin la plus lente.
        // Les mener en série ajoutait le temps d'upload à l'attente du client
        // pour rien.
        const uploads = Promise.all(
            files.map((file) =>
                new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { resource_type: "image", folder: "shein-carts" },
                        (error, result) => (error ? reject(error) : resolve(result.secure_url))
                    );
                    uploadStream.end(file.buffer);
                })
            )
        );

        const [captureUrls, extraction] = await Promise.all([
            uploads,
            extrairePanier(files),
        ]);

        res.json({
            success: true,
            captures: captureUrls,
            // Contrat historique, inchangé pour le front existant
            articles: extraction.articles,
            totalAffiche: extraction.totalAffiche,
            devise: extraction.devise,
            // Nouveaux champs : purement additifs, un front qui les ignore
            // continue de fonctionner exactement comme avant.
            couponApplique: extraction.couponApplique,
            sousTotal: extraction.sousTotal,
            ecart: extraction.ecart,
            alertes: extraction.alertes,
            aVerifier: extraction.aVerifier,
            nbArticlesPanier: extraction.nbArticlesPanier,
        });
    } catch (error) {
        // Les erreurs d'extraction portent un codeClient et un message déjà
        // rédigé pour le client ; le reste est une vraie erreur serveur.
        if (error.codeClient) {
            return res.status(error.codeClient).json({ success: false, message: error.message });
        }
        console.error("Erreur analyzeCart:", error);
        res.status(500).json({ success: false, message: "Erreur lors de l'analyse du panier" });
    }
};

// POST /api/shein-cart/submit
// Crée le Colis en base à partir des articles corrigés par le client.
// authUser place userId dans req.body. lienPartage requis (défense en profondeur,
// même si le frontend ne laisse déjà plus passer sans lui à l'étape analyse).
export const submitCart = async (req, res) => {
    try {
        const { userId, lienPartage, captures, articles, devise } = req.body;

        if (!lienPartage || !lienPartage.trim()) {
            return res.status(400).json({ success: false, message: "Le lien du panier est requis" });
        }
        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ success: false, message: "Aucun article à soumettre" });
        }

        const articlesValides = articles.map((a) => ({
            boutique: a.boutique || "",
            nom: a.nom || "",
            variante: a.variante || "",
            prixUnitaire: Number(a.prixUnitaire) || 0,
            prixOriginal: a.prixOriginal != null ? Number(a.prixOriginal) : null,
            quantite: Number(a.quantite) || 1,
        }));

        const montantArticles = articlesValides.reduce(
            (sum, a) => sum + a.prixUnitaire * a.quantite,
            0
        );

        const colis = await ColisShein.create({
            userId,
            lienPartage: lienPartage.trim(),
            captures: captures || [],
            devise: devise === "USD" || devise === "EUR" ? devise : null,
            articlesValides,
            devis: { montantArticles },
            statut: "soumis",
            historique: [{ action: "soumission_client", note: "Panier soumis par le client" }],
        });

        // Message de bienvenue automatique — texte personnalisable par l'admin
        // via le réglage "sheinMessageBienvenue" (back-office > Colis Shein).
        try {
            const reglage = await Setting.findOne({ key: "sheinMessageBienvenue" });
            const texteBienvenue = reglage?.value?.trim() || MESSAGE_BIENVENUE_DEFAUT;
            await MessageColis.create({
                colisId: colis._id,
                expediteurRole: "agent",
                type: "texte",
                texte: texteBienvenue,
            });
            colis.dernierMessageAgentAt = new Date();
            await colis.save();
        } catch (err) {
            // Ne bloque jamais la création du colis si l'envoi du message échoue
            console.error("Erreur envoi message de bienvenue:", err);
        }

        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur submitCart:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/shein-cart/:id — détail d'un colis, pour la page de suivi client.
// Vérifie que le colis appartient bien au user connecté (même logique IDOR que orderRoute.js).
export const getColisById = async (req, res) => {
    try {
        const colis = await ColisShein.findOne({ _id: req.params.id, userId: req.body.userId });
        if (!colis) {
            return res.status(404).json({ success: false, message: "Colis introuvable" });
        }
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur getColisById:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/shein-cart/user — suivi côté client, même pattern que getUserOrders
export const getUserColis = async (req, res) => {
    try {
        const colisRaw = await ColisShein.find({ userId: req.body.userId }).sort({ createdAt: -1 });
        // nonLuClient : true si l'agent a écrit depuis la dernière fois que le client
        // a ouvert ce fil — sert au badge "1" affiché dans /mes-colis-shein.
        const colis = colisRaw.map((c) => {
            const obj = c.toObject();
            obj.nonLuClient = !!(c.dernierMessageAgentAt && (!c.clientDernierLu || c.dernierMessageAgentAt > c.clientDernierLu));
            return obj;
        });
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur getUserColis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// [RETIRÉ] payAcompte / paySolde et leur helper formatPhoneCI appelaient
// GeniusPay directement — remplacés par initiateJekoAcompte / initiateJekoSolde
// dans jekoController.js (montés sur les mêmes routes /pay-acompte et
// /pay-solde, voir sheinCartRoute.js). Même logique de recalcul serveur du
// montant (jamais fait confiance au client), même vérification "déjà payé".