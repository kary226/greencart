import { v2 as cloudinary } from "cloudinary";
import ColisShein from "../models/ColisShein.js";

const EXTRACTION_PROMPT = `Tu extrais les données d'une ou plusieurs captures d'écran du panier de l'app SHEIN.

Règles :
- Le prix à retenir (prix_unitaire) est TOUJOURS le prix affiché en gras/couleur, jamais le prix barré (prix_original) qui sert seulement de référence.
- La quantité est le chiffre affiché dans le sélecteur à droite de chaque article (ex. "4", "1", "3").
- Le nom peut être tronqué ("..."), c'est normal, garde-le tel quel.
- Si un article n'a pas de prix barré, ne mets pas le champ prix_original (null).
- Si le total en bas de l'écran affiche $0.00, indique total_affiche: null (aucun article n'est coché).
- Si plusieurs images sont fournies, elles peuvent se chevaucher (même article visible sur deux captures) : déduplique par nom + variante.
- Si un champ est illisible, mets-le à null plutôt que de deviner.

Retourne uniquement ce JSON, sans texte autour, sans balises markdown :
{
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
        const { userId, lienPartage, captures, articles } = req.body;

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

// GET /api/shein-cart/user — suivi côté client, même pattern que getUserOrders
export const getUserColis = async (req, res) => {
    try {
        const colis = await ColisShein.find({ userId: req.body.userId }).sort({ createdAt: -1 });
        res.json({ success: true, colis });
    } catch (error) {
        console.error("Erreur getUserColis:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};