import Anthropic from "@anthropic-ai/sdk";

// [SHEIN-SCAN] Extraction des paniers SHEIN à partir de captures d'écran.
//
// Ce module remplace l'appel vision « prompt libre + JSON.parse » d'origine.
// Trois changements structurels, dans l'ordre de leur impact sur la fiabilité :
//
//   1. Un prompt écrit à partir de vraies captures, qui nomme explicitement
//      les pièges de l'interface SHEIN (voir PROMPT_EXTRACTION). C'est le
//      levier principal : la quasi-totalité des erreurs d'extraction vient de
//      badges pris pour des quantités et de blocs de recommandations pris
//      pour des articles du panier.
//
//   2. Une sortie structurée imposée par schéma JSON (output_config.format).
//      Le modèle ne peut plus renvoyer de prose autour du JSON, plus oublier
//      un champ, plus inventer un type. Le « réponds uniquement du JSON »
//      d'origine échouait silencieusement et tombait en 502.
//
//   3. Une couche de normalisation et de contrôle en aval (normaliser()) :
//      déduplication, bornage des valeurs aberrantes, réconciliation avec le
//      total affiché, et un drapeau de confiance par article pour que le
//      client sache quoi vérifier plutôt que de tout relire.

const MODELE = process.env.SHEIN_VISION_MODEL || "claude-opus-5";
const EFFORT = process.env.SHEIN_VISION_EFFORT || "high";

// Formats acceptés par l'API vision. Les captures iPhone en HEIC/HEIF sont le
// cas de rejet le plus fréquent : elles passent le filtre `image/*` de Multer
// mais l'API les refuse. On le détecte ici pour renvoyer un message utile.
const FORMATS_SUPPORTES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Le corps de requête est plafonné à 32 Mo côté API, base64 compris (+33%).
// On garde une marge : au-delà, on demande au client de réduire l'envoi
// plutôt que de laisser l'API renvoyer une erreur illisible.
const TAILLE_MAX_TOTALE = 20 * 1024 * 1024;

const PROMPT_EXTRACTION = `Tu extrais les articles d'un panier de l'application SHEIN à partir d'une ou plusieurs captures d'écran de téléphone. Ces captures sont envoyées par des clients pour qu'un agent leur établisse un devis : une erreur de prix ou de quantité se répercute directement sur une commande réelle.

## Ce qui est un article du panier

Un article du panier est une ligne composée de : une case à cocher à gauche, une vignette produit, un nom de produit, et un sélecteur de quantité à droite. Ces lignes sont regroupées sous une en-tête de boutique (icône de magasin + nom + chevron « > »). Le nom de boutique à retenir pour un article est celui de l'en-tête qui le précède immédiatement.

## Ce qui n'est PAS un article du panier — ne jamais l'extraire

- Tout ce qui suit un titre de recommandation : « You Might Like to Fill it With », « Frequent Favorites », « Hot Deals », « You May Also Like ». Ces vignettes ressemblent à des produits mais ne sont pas dans le panier. Le panier s'arrête à ce titre.
- Les bannières promotionnelles (« Spend $15.00 to get 30% OFF », « 30% OFF coupon applied… »).
- La barre de navigation du bas (Acheter, Catégories, Tendances, Panier, Moi).
- Les puces de filtre en haut (« Tout », « Almost Out of Stock »).

## Lire les prix — le piège le plus coûteux

SHEIN affiche les prix avec la partie entière en gros caractères et les décimales en petits : « $2.25 » apparaît visuellement comme un « $ » minuscule, un « 2 » large, puis « .25 » en petit. C'est DEUX VIRGULE VINGT-CINQ, jamais 225. Applique toujours ce format : le petit groupe de deux chiffres après le gros chiffre est la partie décimale.

- \`prix_unitaire\` = le prix en gras/coloré, celui que le client paiera.
- \`prix_original\` = le prix barré en gris à côté, s'il existe. Sinon null.
- Ne prends jamais le prix barré comme prix_unitaire.

## Quantité — ne pas confondre avec les badges

La quantité est le nombre affiché dans le sélecteur encadré à l'extrême droite de la ligne, avec un chevron « v ». C'est presque toujours 1, 2 ou 3.

Ne sont JAMAIS des quantités :
- « 10 Left », « 3 Left » (badge orange avec un sablier = stock restant)
- « -25% », « -15% », « Est. -33% », « Est. -47% » (badges de réduction)
- « Lower than 500+ paid », « Lower than 99% paid »
- « Panier(7) » en en-tête (nombre total d'articles du panier, pas d'une ligne)
- « Checkout with Coupon(4) » (nombre d'articles cochés)

Si le sélecteur de quantité n'est pas visible pour un article, mets quantite: 1 et signale-le dans \`incertitudes\`.

## Étiquettes à ignorer pour le nom et la variante

« Last Day », « Extra Savings », « Lowest in all sellers », « Lower than N% paid », « Trends », « Almost Out of Stock », « Est. -N% ». Ce sont des étiquettes marketing, pas des caractéristiques du produit.

La variante est la ligne grise sous le nom, souvent avec une pastille de couleur : « Hot Pink », « Brown / Bamboo 5 Slots », « Pink / S+M+L », « Multicolor / Iphone 13 ». Reprends-la telle quelle.

Le nom peut être tronqué et finir par « … » — garde-le tel quel, ne l'invente pas et ne le complète pas.

## Coupon appliqué

Si une bannière « X% OFF coupon applied » est visible en haut, mets \`coupon_applique: true\`. Dans ce cas les prix affichés sont DÉJÀ réduits, et le badge de réduction porte le préfixe « Est. ». Extrais les prix tels qu'affichés — ne recalcule rien.

## Sélection

La case à gauche de chaque article est soit vide (non coché) soit remplie/cochée. Mets \`selectionne\` en conséquence. Le total en bas de l'écran ne compte que les articles cochés : si aucun n'est coché il affiche 0.

## Totaux du bas de l'écran

- \`total_affiche\` : le montant en gras dans la barre du bas (ex. « $24.60 »). Si ce montant vaut 0, mets null.
- \`total_avant_reduction\` : le montant barré à côté (ex. « $33.90 »), sinon null.
- \`nb_articles_panier\` : le nombre entre parenthèses dans « Panier(N) » en haut.
- \`nb_articles_selectionnes\` : le nombre entre parenthèses dans « Checkout with Coupon(N) » ou équivalent.

## Plusieurs captures

Les captures peuvent se chevaucher, être identiques, ou montrer le même panier à des états différents (sélection ou coupon différents). Déduplique : deux lignes avec la même boutique, le même nom et la même variante sont le MÊME article, même si le prix diffère d'une capture à l'autre. Dans ce cas retiens le prix de la capture où le coupon est appliqué, et signale-le dans \`incertitudes\`.

Une capture défilée peut couper un article en haut ou en bas. Ne l'extrais que si le nom ET le prix sont tous deux lisibles ; sinon ignore-le.

## Devise

Détecte-la au symbole devant les prix : « $ » → USD, « € » → EUR. Si les deux apparaissent ou qu'aucun n'est lisible, mets null. Ne devine pas d'après le pays de livraison.

## Confiance

Pour chaque article, remplis \`confiance\` :
- « haute » : nom, prix et quantité tous nets et sans ambiguïté.
- « moyenne » : un élément demande interprétation (texte petit, partiellement masqué, article reconstitué depuis deux captures).
- « basse » : un champ a été deviné ou l'article est partiellement coupé.

Et liste dans \`incertitudes\` ce qui a posé problème, en une courte phrase par point. Si tout est net, laisse la liste vide.

Mieux vaut un champ à null qu'une valeur inventée. Un article manquant se rattrape à l'écran suivant ; un prix faux part en devis.`;

// Raccourci pour les champs nullables : `anyOf` est la forme explicitement
// supportée par les sorties structurées (les contraintes numériques type
// `minimum` ne le sont pas — le bornage se fait dans normaliser()).
const nullable = (type) => ({ anyOf: [{ type }, { type: "null" }] });

const SCHEMA_PANIER = {
    type: "object",
    properties: {
        devise: { anyOf: [{ type: "string", enum: ["USD", "EUR"] }, { type: "null" }] },
        coupon_applique: { type: "boolean" },
        articles: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    boutique: { type: "string" },
                    nom: { type: "string" },
                    variante: { type: "string" },
                    prix_unitaire: nullable("number"),
                    prix_original: nullable("number"),
                    quantite: { type: "integer" },
                    selectionne: { type: "boolean" },
                    confiance: { type: "string", enum: ["haute", "moyenne", "basse"] },
                    incertitudes: { type: "array", items: { type: "string" } },
                },
                required: [
                    "boutique", "nom", "variante", "prix_unitaire",
                    "prix_original", "quantite", "selectionne",
                    "confiance", "incertitudes",
                ],
                additionalProperties: false,
            },
        },
        total_affiche: nullable("number"),
        total_avant_reduction: nullable("number"),
        nb_articles_panier: nullable("integer"),
        nb_articles_selectionnes: nullable("integer"),
    },
    required: [
        "devise", "coupon_applique", "articles", "total_affiche",
        "total_avant_reduction", "nb_articles_panier", "nb_articles_selectionnes",
    ],
    additionalProperties: false,
};

let clientAnthropic = null;
const getClient = () => {
    if (!clientAnthropic) {
        clientAnthropic = new Anthropic({
            // 2 tentatives supplémentaires sur 429/5xx/erreurs réseau, gérées
            // par le SDK avec backoff exponentiel.
            maxRetries: 2,
        });
    }
    return clientAnthropic;
};

/**
 * Vérifie les fichiers reçus avant tout appel réseau : un rejet ici coûte
 * 0 token, alors qu'un rejet côté API coûte l'upload complet.
 */
export const validerCaptures = (files) => {
    if (!files || files.length === 0) {
        return { ok: false, message: "Aucune capture reçue" };
    }

    const nonSupporte = files.find((f) => !FORMATS_SUPPORTES.includes(f.mimetype));
    if (nonSupporte) {
        return {
            ok: false,
            message:
                `Le format ${nonSupporte.mimetype} n'est pas lisible. ` +
                "Sur iPhone : Réglages > Appareil photo > Formats > « Le plus compatible », " +
                "ou renvoie la capture en JPEG/PNG.",
        };
    }

    const total = files.reduce((sum, f) => sum + f.size, 0);
    if (total > TAILLE_MAX_TOTALE) {
        return {
            ok: false,
            message:
                "Les captures sont trop volumineuses au total. " +
                "Envoie-les en deux fois, ou réduis leur qualité.",
        };
    }

    return { ok: true };
};

const arrondi = (n) => Math.round(n * 100) / 100;

// Clé de déduplication : boutique + nom + variante, insensible à la casse et
// aux espaces. Le prix en est volontairement absent — le même article vu sur
// deux captures peut porter deux prix (coupon appliqué ou non), et c'est
// justement le doublon qu'on veut fusionner.
const cleDedup = (a) =>
    [a.boutique, a.nom, a.variante]
        .map((v) => String(v || "").toLowerCase().replace(/\s+/g, " ").trim())
        .join("|");

/**
 * Nettoyage et contrôle de cohérence de la sortie du modèle.
 *
 * Le schéma garantit la forme, pas le bon sens : il n'empêche ni une quantité
 * à 47, ni un prix à 0, ni deux fois le même article. C'est ici qu'on borne.
 */
export const normaliser = (brut) => {
    const alertes = [];
    const parCle = new Map();

    for (const a of brut.articles || []) {
        const incertitudes = [...(a.incertitudes || [])];
        let confiance = a.confiance || "moyenne";

        let prixUnitaire = a.prix_unitaire;
        if (prixUnitaire == null || !Number.isFinite(prixUnitaire) || prixUnitaire <= 0) {
            incertitudes.push("Prix illisible — à saisir manuellement");
            confiance = "basse";
            prixUnitaire = null;
        } else {
            prixUnitaire = arrondi(prixUnitaire);
        }

        // Un prix « original » inférieur au prix payé n'a pas de sens : c'est
        // le symptôme classique des deux prix intervertis. On ne devine pas,
        // on écarte le champ décoratif et on signale.
        let prixOriginal = a.prix_original;
        if (prixOriginal != null && Number.isFinite(prixOriginal)) {
            prixOriginal = arrondi(prixOriginal);
            if (prixUnitaire != null && prixOriginal < prixUnitaire) {
                incertitudes.push("Prix barré inférieur au prix payé — lecture douteuse");
                confiance = "basse";
                prixOriginal = null;
            }
        } else {
            prixOriginal = null;
        }

        // Bornage de la quantité. Au-delà de 20 sur un panier SHEIN, c'est
        // presque toujours un badge « 10 Left » ou un « -25% » lu de travers.
        let quantite = Number(a.quantite);
        if (!Number.isInteger(quantite) || quantite < 1) {
            quantite = 1;
            incertitudes.push("Quantité illisible — ramenée à 1");
            confiance = "basse";
        } else if (quantite > 20) {
            incertitudes.push(`Quantité ${quantite} anormalement élevée — à vérifier`);
            confiance = "basse";
            quantite = 1;
        }

        const article = {
            boutique: (a.boutique || "").trim(),
            nom: (a.nom || "").trim(),
            variante: (a.variante || "").trim(),
            // Deux graphies pour le même champ : le front lit `prix_unitaire`
            // à l'analyse et `prixUnitaire` à la soumission.
            prix_unitaire: prixUnitaire,
            prixUnitaire,
            prix_original: prixOriginal,
            prixOriginal,
            quantite,
            selectionne: a.selectionne !== false,
            confiance,
            incertitudes,
        };

        const cle = cleDedup(article);
        const existant = parCle.get(cle);

        if (!existant) {
            parCle.set(cle, article);
            continue;
        }

        // Doublon inter-captures : on garde le prix le plus bas, qui est celui
        // de la capture où le coupon est appliqué — donc celui que le client
        // paiera réellement. La quantité retenue est la plus grande vue, un
        // article coupé en bas d'écran étant plus souvent sous-compté.
        if (
            existant.prix_unitaire == null ||
            (article.prix_unitaire != null && article.prix_unitaire < existant.prix_unitaire)
        ) {
            existant.prix_unitaire = article.prix_unitaire;
            existant.prixUnitaire = article.prixUnitaire;
            existant.prix_original = article.prix_original;
            existant.prixOriginal = article.prixOriginal;
        }
        if (article.quantite > existant.quantite) existant.quantite = article.quantite;
        existant.selectionne = existant.selectionne || article.selectionne;
        if (article.confiance === "basse") existant.confiance = "basse";
        existant.incertitudes = [...new Set([...existant.incertitudes, ...article.incertitudes])];
    }

    const articles = [...parCle.values()];
    const doublons = (brut.articles || []).length - articles.length;
    if (doublons > 0) {
        alertes.push(`${doublons} doublon(s) fusionné(s) entre les captures`);
    }

    // Réconciliation avec le total lu en bas d'écran. Elle ne vaut que si le
    // panier entier est coché : sinon le total ne couvre qu'une partie des
    // articles et l'écart est attendu, pas suspect.
    const totalAffiche = brut.total_affiche ?? null;
    const tousSelectionnes = articles.length > 0 && articles.every((a) => a.selectionne);
    const sousTotal = arrondi(
        articles.reduce((s, a) => s + (a.prix_unitaire || 0) * a.quantite, 0)
    );

    let ecart = null;
    if (totalAffiche != null && tousSelectionnes && articles.length > 0) {
        ecart = arrondi(sousTotal - totalAffiche);
        // Tolérance : les frais de port et taxes ne figurent pas dans les
        // lignes d'articles, un écart de quelques dizaines de centimes est
        // normal. Au-delà de 1 unité ou 5 %, il y a probablement une ligne
        // manquante ou un prix mal lu.
        const seuil = Math.max(1, totalAffiche * 0.05);
        if (Math.abs(ecart) > seuil) {
            alertes.push(
                `Le total des articles (${sousTotal}) s'écarte du total affiché (${totalAffiche}). ` +
                "Il manque peut-être un article, ou un prix a été mal lu."
            );
        }
    }

    // Le compteur « Panier(N) » de SHEIN compte les articles distincts. S'il
    // ne correspond pas au nombre de lignes extraites, il manque une capture.
    const nbAnnonce = brut.nb_articles_panier ?? null;
    if (nbAnnonce != null && nbAnnonce > articles.length) {
        alertes.push(
            `SHEIN annonce ${nbAnnonce} articles au panier, ${articles.length} ont été détectés. ` +
            "Il manque probablement une capture (pense à faire défiler le panier entier)."
        );
    }

    return {
        devise: brut.devise ?? null,
        couponApplique: brut.coupon_applique === true,
        articles,
        totalAffiche,
        totalAvantReduction: brut.total_avant_reduction ?? null,
        nbArticlesPanier: nbAnnonce,
        nbArticlesSelectionnes: brut.nb_articles_selectionnes ?? null,
        sousTotal,
        ecart,
        alertes,
        // Permet au front de mettre en évidence uniquement les lignes à
        // relire, au lieu de demander au client de tout revérifier.
        aVerifier: articles.filter((a) => a.confiance !== "haute").length,
    };
};

/**
 * Extraction proprement dite. `captures` = [{ buffer, mimetype }].
 * Lève une erreur portant un `codeClient` exploitable par le contrôleur.
 */
export const extrairePanier = async (captures) => {
    const blocsImages = captures.map((f) => ({
        type: "image",
        source: {
            type: "base64",
            media_type: f.mimetype,
            data: f.buffer.toString("base64"),
        },
    }));

    let message;
    try {
        // Streaming : l'entrée peut atteindre une dizaine d'images haute
        // résolution, et la réflexion du modèle s'ajoute au temps de réponse.
        // En non-streaming, ces requêtes tapent le délai HTTP du SDK.
        const stream = getClient().messages.stream({
            model: MODELE,
            max_tokens: 16000,
            output_config: {
                effort: EFFORT,
                format: { type: "json_schema", schema: SCHEMA_PANIER },
            },
            messages: [
                {
                    role: "user",
                    content: [
                        ...blocsImages,
                        {
                            type: "text",
                            text:
                                captures.length > 1
                                    ? `${captures.length} captures du même panier, dans l'ordre de défilement. Extrais le panier complet.`
                                    : "Extrais le panier de cette capture.",
                        },
                    ],
                },
            ],
        });
        message = await stream.finalMessage();
    } catch (error) {
        if (error instanceof Anthropic.RateLimitError) {
            const e = new Error("Service momentanément saturé, réessaie dans une minute.");
            e.codeClient = 429;
            throw e;
        }
        if (error instanceof Anthropic.AuthenticationError) {
            console.error("[shein-scan] ANTHROPIC_API_KEY invalide ou absente");
            const e = new Error("Analyse indisponible, saisis les articles manuellement.");
            e.codeClient = 502;
            throw e;
        }
        console.error("[shein-scan] Erreur API vision:", error?.message);
        const e = new Error("Analyse indisponible, réessaie ou saisis les articles manuellement.");
        e.codeClient = 502;
        throw e;
    }

    // Un refus des classifieurs de sécurité renvoie un HTTP 200 avec un
    // contenu vide : sans ce test, la lecture de content[0] planterait.
    if (message.stop_reason === "refusal") {
        console.error("[shein-scan] Refus du modèle:", message.stop_details);
        const e = new Error("Ces captures n'ont pas pu être analysées. Saisis les articles manuellement.");
        e.codeClient = 422;
        throw e;
    }

    // Troncature : le JSON est coupé au milieu et ne parsera pas. On le dit
    // franchement plutôt que de renvoyer un panier partiel silencieusement.
    if (message.stop_reason === "max_tokens") {
        const e = new Error("Panier trop volumineux pour une seule analyse — envoie moins de captures à la fois.");
        e.codeClient = 413;
        throw e;
    }

    const texte = message.content.find((b) => b.type === "text")?.text;
    if (!texte) {
        const e = new Error("Analyse vide, réessaie ou saisis les articles manuellement.");
        e.codeClient = 502;
        throw e;
    }

    let brut;
    try {
        brut = JSON.parse(texte);
    } catch {
        // Avec les sorties structurées ce cas ne devrait plus se produire ;
        // on le garde comme filet et on journalise pour pouvoir le détecter.
        console.error("[shein-scan] JSON invalide malgré le schéma:", texte.slice(0, 500));
        const e = new Error("Résultat d'analyse illisible, réessaie ou saisis les articles manuellement.");
        e.codeClient = 502;
        throw e;
    }

    const resultat = normaliser(brut);
    resultat.usage = {
        entree: message.usage?.input_tokens,
        sortie: message.usage?.output_tokens,
    };
    return resultat;
};

export default { validerCaptures, extrairePanier, normaliser };
