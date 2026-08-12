import axios from "axios";
import * as cheerio from "cheerio";
import { optionsSortantesSures, verifierUrlSortante } from "../utils/urlGuard.js";

/**
 * Scrape une page produit et retourne uniquement : nom, description, images.
 * (Le prix, le stock et les variantes sont volontairement ignorés :
 *  le vendeur les saisit lui-même après import.)
 *
 * Stratégie d'extraction, par ordre de priorité :
 *  1. JSON-LD schema.org "Product" (le plus fiable, standard e-commerce)
 *  2. Repli sur les balises Open Graph (og:title, og:description, og:image)
 */
// Certains sites (dont Jumia) concatènent leurs caractéristiques techniques
// sans séparateur ("Poids：90gCouleur：rouge") — on force un retour à la
// ligne avant chaque nouvelle caractéristique pour rendre le texte lisible.
const cleanDescription = (text) => {
    if (!text) return text;
    return text
        .replace(/([a-zà-ÿ0-9\)])([A-ZÀ-Ÿ][a-zà-ÿA-ZÀ-Ÿ' ]{1,30}?：)/g, "$1\n$2") // ex: "90gCouleur：" -> "90g\nCouleur："
        .replace(/[ \t]{2,}/g, " ")
        .trim();
};

export const scrapeProductPreview = async (url) => {
    // [SÉCURITÉ SSRF] L'URL vient d'un formulaire : on vérifie qu'elle ne
    // pointe pas vers l'intérieur de l'infrastructure avant d'aller la
    // chercher, et on revalide chaque redirection.
    await verifierUrlSortante(url);

    const { data: html } = await axios.get(url, optionsSortantesSures({
        headers: {
            // Beaucoup de sites bloquent les requêtes sans User-Agent "navigateur"
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "fr-FR,fr;q=0.9",
        },
        timeout: 15000,
    }));

    const $ = cheerio.load(html);

    // ---- 1. Tentative via JSON-LD ----
    let name = null;
    let description = null;
    let images = [];

    $('script[type="application/ld+json"]').each((_, el) => {
        if (name && description && images.length) return; // déjà trouvé, on arrête

        let parsed;
        try {
            parsed = JSON.parse($(el).contents().text());
        } catch {
            return; // JSON invalide/tronqué, on ignore ce bloc
        }

        // Le JSON-LD peut être un objet unique, un tableau, ou un "@graph"
        const candidates = Array.isArray(parsed)
            ? parsed
            : parsed["@graph"]
            ? parsed["@graph"]
            : [parsed];

        const product = candidates.find(
            (item) => item && (item["@type"] === "Product" || item["@type"]?.includes?.("Product"))
        );
        if (!product) return;

        name = name || product.name || null;
        description = description || cleanDescription(product.description) || null;

        if (product.image) {
            if (typeof product.image === "string") {
                images.push(product.image);
            } else if (Array.isArray(product.image)) {
                images.push(...product.image);
            } else if (product.image.contentUrl) {
                images.push(
                    ...(Array.isArray(product.image.contentUrl)
                        ? product.image.contentUrl
                        : [product.image.contentUrl])
                );
            }
        }
    });

    // ---- 2. Repli Open Graph si le JSON-LD n'a rien donné ----
    if (!name) {
        name = $('meta[property="og:title"]').attr("content") || $("title").text() || null;
    }
    if (!description) {
        description = $('meta[property="og:description"]').attr("content") || null;
    }
    if (images.length === 0) {
        const ogImage = $('meta[property="og:image"]').attr("content");
        if (ogImage) images.push(ogImage);
    }

    // Dédoublonnage + nettoyage
    images = [...new Set(images)].filter(Boolean);

    if (!name && images.length === 0) {
        throw new Error(
            "Impossible d'extraire les informations produit de cette page (structure non reconnue)."
        );
    }

    return {
        sourceUrl: url,
        name: name?.trim() || "",
        description: description?.trim() || "",
        images,
    };
};

/**
 * Télécharge une liste d'images distantes et les retourne en data URLs base64,
 * prêtes à être converties en File côté client (contourne les restrictions CORS
 * qu'on aurait en téléchargeant directement depuis le navigateur).
 */
export const fetchImagesAsDataUrls = async (urls, { limit = 8, maxBytes = 6 * 1024 * 1024 } = {}) => {
    const targets = (urls || []).slice(0, limit);

    const results = await Promise.allSettled(
        targets.map(async (imageUrl) => {
            // [SÉCURITÉ SSRF] Les URL d'images viennent de la page scrapée,
            // donc d'un tiers : elles sont tout aussi hostiles que l'URL
            // saisie, et méritent le même contrôle.
            await verifierUrlSortante(imageUrl);

            const { data, headers } = await axios.get(imageUrl, optionsSortantesSures({
                responseType: "arraybuffer",
                timeout: 15000,
                maxContentLength: maxBytes,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                },
            }));
            const contentType = headers["content-type"] || "image/jpeg";
            const base64 = Buffer.from(data).toString("base64");
            return `data:${contentType};base64,${base64}`;
        })
    );

    return results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);
};