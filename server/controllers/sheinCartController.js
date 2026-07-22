import { v2 as cloudinary } from "cloudinary";
import axios from "axios";
import mongoose from "mongoose";
import ColisShein from "../models/ColisShein.js";

const EXTRACTION_PROMPT = `Tu extrais les données d'une ou plusieurs captures d'écran du panier de l'app SHEIN.

Règles :
- Le prix à retenir (prix_unitaire) est TOUJOURS le prix affiché en gras/couleur, jamais le prix barré (prix_original) qui sert seulement de référence.
- La quantité est le chiffre affiché dans le sélecteur à droite de chaque article (ex. "4", "1", "3").
- Le nom peut être tronqué ("..."), c'est normal, garde-le tel quel.
- Si un article n'a pas de prix barré, ne mets pas le champ prix_original (null).
- Si le total en bas de l'écran affiche 0 (quel que soit le symbole), indique total_affiche: null (aucun article n'est coché).
- Détecte la devise à partir du symbole visible devant les prix : "$" → "USD", "€" → "EUR". Si les deux symboles apparaissent ou qu'aucun n'est visible, mets devise: null plutôt que de deviner.
- Si plusieurs images sont fournies, elles peuvent se chevaucher (même article visible sur deux captures) : déduplique par nom + variante.
- Si un champ est illisible, mets-le à null plutôt que de deviner.

Retourne uniquement ce JSON, sans texte autour, sans balises markdown :
{
  "devise": null,
  "articles": [
    { "boutique": "", "nom": "", "variante": "", "prix_unitaire": 0, "prix_original": null, "quantite": 0 }
  ],
  "total_affiche": null
}`;

// POST /api/shein-cart/analyze
// Reçoit les captures (multipart, champ "captures") ET le lien de partage (champ "lienPartage") —
// les deux sont obligatoires ensemble, aucun des deux seul ne suffit à lancer l'analyse.
export const analyzeCart = async (req, res) => {
    try {
        const files = req.files || [];
        const lienPartage = (req.body.lienPartage || "").trim();

        if (files.length === 0) {
            return res.status(400).json({ success: false, message: "Aucune capture reçue" });
        }
        if (!lienPartage) {
            return res.status(400).json({ success: false, message: "Le lien du panier est requis" });
        }

        // Upload Cloudinary (même pattern que productController.addProduct)
        const captureUrls = await Promise.all(
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

        // Appel API vision — chaque image en base64, format attendu par l'API Anthropic
        const imageBlocks = files.map((file) => ({
            type: "image",
            source: {
                type: "base64",
                media_type: file.mimetype,
                data: file.buffer.toString("base64"),
            },
        }));

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-sonnet-5",
                max_tokens: 2000,
                messages: [
                    {
                        role: "user",
                        content: [...imageBlocks, { type: "text", text: EXTRACTION_PROMPT }],
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Erreur API vision:", errText);
            return res.status(502).json({ success: false, message: "Extraction indisponible, réessaie ou saisis manuellement" });
        }

        const data = await response.json();
        const rawText = data.content?.find((b) => b.type === "text")?.text || "{}";

        let extraction;
        try {
            extraction = JSON.parse(rawText);
        } catch (e) {
            console.error("JSON extraction invalide:", rawText);
            return res.status(502).json({ success: false, message: "Résultat d'extraction illisible, réessaie ou saisis manuellement" });
        }

        res.json({
            success: true,
            captures: captureUrls,
            articles: extraction.articles || [],
            totalAffiche: extraction.total_affiche ?? null,
            devise: extraction.devise ?? null,
        });
    } catch (error) {
        console.error("Erreur analyzeCart:", error);
        res.status(500).json({ success: false, message: error.message });
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

// Formate un numéro ivoirien au format international attendu par GeniusPay (+225XXXXXXXXX)
const formatPhoneCI = (phone) => {
    let p = (phone || "").replace(/\D/g, "");
    if (p.startsWith("0")) p = p.substring(1);
    if (!p.startsWith("225")) p = `225${p}`;
    return `+${p}`;
};

// POST /api/shein-cart/:id/pay-acompte
// Le montant n'est JAMAIS pris du client — recalculé depuis colis.devis.montantInitial,
// figé par l'agent au moment de la validation du devis (validateColis).
export const payAcompte = async (req, res) => {
    try {
        const colis = await ColisShein.findOne({ _id: req.params.id, userId: req.body.userId });
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });
        if (colis.paiement.acomptePaye) {
            return res.status(400).json({ success: false, message: "Acompte déjà payé" });
        }
        if (!colis.devis.montantInitial || colis.devis.montantInitial <= 0) {
            return res.status(400).json({ success: false, message: "Le devis n'a pas encore de montant d'acompte défini" });
        }

        const User = mongoose.model("user");
        const user = await User.findById(req.body.userId);
        if (!user?.phone) {
            return res.status(400).json({ success: false, message: "Ajoute un numéro de téléphone à ton compte avant de payer" });
        }

        const amount = Math.round(colis.devis.montantInitial);
        const response = await axios.post(
            `${process.env.GENIUSPAY_BASE_URL}/payments`,
            {
                amount,
                description: `Acompte colis ${colis.numeroSuivi}`,
                customer: { name: user.name?.substring(0, 100) || "Client RAMCI", phone: formatPhoneCI(user.phone) },
                success_url: `${process.env.FRONTEND_URL}/colis-shein/${colis._id}?paiement=succes`,
                error_url: `${process.env.FRONTEND_URL}/colis-shein/${colis._id}?paiement=erreur`,
                metadata: { type: "shein_acompte", colis_id: colis._id.toString(), user_id: req.body.userId },
            },
            { headers: { "X-API-Key": process.env.GENIUSPAY_API_KEY, "X-API-Secret": process.env.GENIUSPAY_API_SECRET, "Content-Type": "application/json" } }
        );

        if (response.data.success) {
            res.json({ success: true, checkout_url: response.data.data.checkout_url });
        } else {
            res.json({ success: false, message: response.data.error?.message || "Erreur d'initiation du paiement" });
        }
    } catch (error) {
        console.error("Erreur payAcompte:", error.message);
        res.status(500).json({ success: false, message: "Erreur lors de l'initialisation du paiement" });
    }
};

// POST /api/shein-cart/:id/pay-solde — même logique, montant recalculé depuis paiement.soldeMontant
// (fixé par l'agent à la pesée, jamais transmis par le client).
export const paySolde = async (req, res) => {
    try {
        const colis = await ColisShein.findOne({ _id: req.params.id, userId: req.body.userId });
        if (!colis) return res.status(404).json({ success: false, message: "Colis introuvable" });
        if (colis.paiement.soldePaye) {
            return res.status(400).json({ success: false, message: "Solde déjà payé" });
        }
        if (!colis.paiement.soldeMontant || colis.paiement.soldeMontant <= 0) {
            return res.status(400).json({ success: false, message: "Le solde n'a pas encore été calculé (en attente de pesée)" });
        }

        const User = mongoose.model("user");
        const user = await User.findById(req.body.userId);
        if (!user?.phone) {
            return res.status(400).json({ success: false, message: "Ajoute un numéro de téléphone à ton compte avant de payer" });
        }

        const amount = Math.round(colis.paiement.soldeMontant);
        const response = await axios.post(
            `${process.env.GENIUSPAY_BASE_URL}/payments`,
            {
                amount,
                description: `Solde colis ${colis.numeroSuivi}`,
                customer: { name: user.name?.substring(0, 100) || "Client RAMCI", phone: formatPhoneCI(user.phone) },
                success_url: `${process.env.FRONTEND_URL}/colis-shein/${colis._id}?paiement=succes`,
                error_url: `${process.env.FRONTEND_URL}/colis-shein/${colis._id}?paiement=erreur`,
                metadata: { type: "shein_solde", colis_id: colis._id.toString(), user_id: req.body.userId },
            },
            { headers: { "X-API-Key": process.env.GENIUSPAY_API_KEY, "X-API-Secret": process.env.GENIUSPAY_API_SECRET, "Content-Type": "application/json" } }
        );

        if (response.data.success) {
            res.json({ success: true, checkout_url: response.data.data.checkout_url });
        } else {
            res.json({ success: false, message: response.data.error?.message || "Erreur d'initiation du paiement" });
        }
    } catch (error) {
        console.error("Erreur paySolde:", error.message);
        res.status(500).json({ success: false, message: "Erreur lors de l'initialisation du paiement" });
    }
};