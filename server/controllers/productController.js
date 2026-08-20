import { v2 as cloudinary } from "cloudinary";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Boutique from "../models/Boutique.js";
import mongoose from "mongoose";
import { scrapeProductPreview, fetchImagesAsDataUrls } from "../services/scraper.js";
import { withCache, CACHE_KEYS } from "../configs/redisCache.js";
import { appliquerFiltreBoutiquesActives, getIdsBoutiquesSuspendues } from "../services/boutiqueService.js";
import { genererSkuUnique, normaliserSku, skuEstDisponible, skuEstValide } from "../utils/sku.js";
import { estErreurUrlBloquee } from "../utils/urlGuard.js";
import { construireFiltreRecherche } from "../utils/recherche.js";
import { acteurDepuisRequete } from "../middlewares/authActeur.js";
import { journaliser, apercuProduit } from "../services/journalService.js";
import { assainirRiche } from "../utils/assainir.js";
import {
    normaliserVariantes,
    calculerStockTotal,
    determinerDisponibilite,
    appliquerQuantites,
    estArticlePlateforme,
    appliquerVerrouillagePlateforme,
} from "../services/productService.js";
import { syncProductToAirtable, deleteProductFromAirtable, resyncAllProducts } from "../services/airtableSync.js";

/**
 * Extrait le public_id Cloudinary d'une secure_url, pour pouvoir supprimer
 * l'image correspondante. Ex :
 * https://res.cloudinary.com/xxx/image/upload/v123/products/images/abc.jpg
 * -> products/images/abc
 * Renvoie null si l'URL ne correspond pas au format attendu (mieux vaut
 * ignorer une image que planter la suppression du produit).
 */
const extraireCloudinaryPublicId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+(?:\?.*)?$/);
    return match ? match[1] : null;
};

/**
 * Résout le code article à enregistrer.
 *  - champ vide  → on en génère un, pour qu'aucun produit ne se retrouve
 *                  sans référence même quand le vendeur n'y pense pas ;
 *  - champ saisi → on valide la forme puis l'unicité.
 * Renvoie { sku } ou { erreur }.
 */
const resoudreSku = async (valeurBrute, exclureId = null) => {
    const sku = normaliserSku(valeurBrute);
    if (!sku) return { sku: await genererSkuUnique(Product) };

    if (!skuEstValide(sku)) {
        return { erreur: "Le code article n'accepte que des lettres, des chiffres et des tirets (2 à 24 caractères)." };
    }
    if (!(await skuEstDisponible(Product, sku, exclureId))) {
        return { erreur: `Le code « ${sku} » est déjà utilisé par un autre produit.` };
    }
    return { sku };
};

/**
 * Vérifie qu'un lien fournisseur (« Lien supplémentaire ») n'est pas déjà
 * utilisé par un autre produit encore ACTIF — c-à-d non archivé et avec du
 * stock (stock > 0). But : éviter qu'une même fiche/annonce (ex. SHEIN)
 * soit ré-importée par erreur pendant qu'elle est toujours en vente.
 *
 * Un produit dont le stock est retombé à 0 (ou qui a été archivé) libère
 * son lien : le réutiliser pour un réassort ne déclenche pas l'erreur.
 *
 * `exclureId` sert à l'édition : on ne doit pas se signaler soi-même comme
 * conflit quand on resauvegarde un produit sans changer son lien.
 *
 * Renvoie le produit en conflit (juste de quoi composer un message utile),
 * ou null si le lien est libre.
 */
const trouverProduitActifAvecLien = async (lien, exclureId = null) => {
    if (!lien) return null;
    const filtre = {
        externalLink: lien,
        isArchived: false,
        stock: { $gt: 0 },
    };
    if (exclureId) filtre._id = { $ne: exclureId };
    return Product.findOne(filtre).select('name sku stock');
};

// ✅ Fournit un code libre au formulaire (bouton « Générer »).
export const genererCodeArticle = async (req, res) => {
    try {
        res.json({ success: true, sku: await genererSkuUnique(Product) });
    } catch (error) {
        console.error('❌ Erreur genererCodeArticle:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Sentinelle : « une boutique a été demandée, mais elle n'existe pas ».
// Distinguer ce cas de « aucune boutique demandée » (null) évite de créer
// silencieusement un article au catalogue principal alors que l'intention
// était de l'attribuer à un commerçant.
const INVALIDE = Symbol('boutique-introuvable');

const resoudreBoutiqueDemandee = async (boutiqueIdDemande) => {
    if (!boutiqueIdDemande) return null;
    if (!mongoose.Types.ObjectId.isValid(boutiqueIdDemande)) return INVALIDE;

    const boutique = await Boutique.findById(boutiqueIdDemande).select('_id');
    return boutique ? boutique._id : INVALIDE;
};

// ✅ Add Product - AVEC VIDÉO ET BOUTIQUE
export const addProduct = async (req, res) => {
    try {
        // Le corps arrive en multipart : productData est une chaîne JSON.
        // Sans ce garde, une requête malformée produisait une 500 avec un
        // message de parsing — illisible pour l'appelant, et bruyant dans
        // les logs d'erreur.
        let productData;
        try {
            productData = JSON.parse(req.body.productData);
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Données du produit illisibles (productData attendu au format JSON).',
            });
        }
        const images = req.files?.images || [];
        const videoFile = req.files?.video ? req.files.video[0] : null;

        // Acteur normalisé (voir middlewares/authActeur.js) : le compte
        // technique vendeur et le staff admin ont désormais la même forme,
        // donc un seul chemin de code au lieu de deux à tenir en parallèle.
        const acteur = acteurDepuisRequete(req);
        if (!acteur) {
            return res.status(403).json({ success: false, message: 'Accès refusé - Non authentifié' });
        }

        let boutiqueId = null;

        if (acteur.role === 'commercant') {
            // Un commerçant publie forcément dans SA boutique : un
            // boutiqueId envoyé par le client est ignoré.
            if (!acteur.boutiqueId) {
                return res.status(400).json({
                    success: false,
                    message: 'Vous n\'avez pas de boutique. Contactez l\'administrateur.'
                });
            }
            // Le droit de création est vérifié en amont par le middleware
            // requireDroitCreation (avant l'upload). On le revérifie ici :
            // ce contrôleur est monté sur deux routes, et une seule ligne de
            // route oubliée suffirait à ouvrir la création à tout le monde.
            const saBoutique = await Boutique.findById(acteur.boutiqueId).select('peutCreerProduits');
            if (!saBoutique?.peutCreerProduits) {
                return res.status(403).json({
                    success: false,
                    creationNonAutorisee: true,
                    message: "L'ajout d'articles n'est pas activé pour votre boutique. Contactez l'administrateur.",
                });
            }

            boutiqueId = acteur.boutiqueId;
        } else if (acteur.role === 'admin') {
            // Un admin — staff ou compte vendeur technique — peut créer un
            // article POUR une boutique : il le saisit une fois, et l'article
            // appartient ensuite au commerçant (il apparaît dans son espace,
            // celui-ci en gère les quantités, et les ventes créditent son
            // portefeuille). Sans boutiqueId, l'article reste au catalogue
            // principal, comme avant.
            boutiqueId = await resoudreBoutiqueDemandee(productData.boutiqueId);
        } else {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Rôle non autorisé'
            });
        }

        if (boutiqueId === INVALIDE) {
            return res.status(400).json({ success: false, message: 'Boutique introuvable' });
        }

        // ✅ Anti-doublon : un lien fournisseur déjà utilisé par un produit
        // encore en stock signale probablement qu'on est en train de
        // ré-ajouter le même article. On bloque avant l'upload (inutile de
        // dépenser du Cloudinary pour un envoi qui va échouer).
        const lienExterneBrut = productData.externalLink?.trim();
        if (lienExterneBrut) {
            const conflit = await trouverProduitActifAvecLien(lienExterneBrut);
            if (conflit) {
                return res.status(400).json({
                    success: false,
                    message: `Ce lien est déjà utilisé par « ${conflit.name} » (SKU ${conflit.sku}), encore en stock (${conflit.stock}). Vérifiez qu'il ne s'agit pas du même article avant d'en créer un nouveau.`,
                });
            }
        }

        let imagesUrl = [];
        if (images.length > 0) {
            imagesUrl = await Promise.all(
                images.map(async (item) => {
                    try {
                        let result = await new Promise((resolve, reject) => {
                            const uploadStream = cloudinary.uploader.upload_stream(
                                { resource_type: 'image', folder: 'products/images' },
                                (error, result) => {
                                    if (error) reject(error);
                                    else resolve(result);
                                }
                            );
                            uploadStream.end(item.buffer);
                        });
                        return result.secure_url;
                    } catch (error) {
                        console.error('❌ Erreur image:', error.message);
                        throw error;
                    }
                })
            );
        }

        let videoUrl = null;
        let videoPublicId = null;
        if (videoFile) {
            try {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { resource_type: 'video', folder: 'products/videos', chunk_size: 6000000 },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(videoFile.buffer);
                });
                videoUrl = result.secure_url;
                videoPublicId = result.public_id;
            } catch (videoError) {
                console.error('❌ Erreur upload vidéo:', videoError.message);
            }
        }

        const processedVariants = (productData.variants || []).map(variant => ({
            color: variant.color,
            colorCode: variant.colorCode,
            size: variant.size || null,
            price: variant.price || 0,
            offerPrice: variant.offerPrice || 0,
            stock: variant.stock || 0,
            startImageIndex: variant.startImageIndex || 0
        }));

        const hasVariants = productData.variants && productData.variants.length > 0;
        let totalStock = hasVariants 
            ? processedVariants.reduce((sum, v) => sum + v.stock, 0) 
            : (productData.stock || 0);

        const labelType = productData.labelType || 'size';

        const resultatSku = await resoudreSku(productData.sku);
        if (resultatSku.erreur) {
            return res.status(400).json({ success: false, message: resultatSku.erreur });
        }

        const product = await Product.create({
            name: productData.name,
            sku: resultatSku.sku,
            // Assaini à la source : la description est du HTML riche (Quill).
            description: assainirRiche(productData.description),
            categories: productData.categories,
            price: productData.price,
            offerPrice: productData.offerPrice,
            purchasePrice: productData.purchasePrice || 0,
            externalLink: productData.externalLink || null,
            image: imagesUrl,
            variants: processedVariants,
            stock: hasVariants ? totalStock : (productData.stock || 0),
            size: hasVariants ? null : (productData.size || null),
            inStock: hasVariants ? processedVariants.some(v => v.stock > 0) : (productData.stock > 0),
            video: videoUrl,
            videoPublicId: videoPublicId,
            labelType: labelType,
            boutiqueId: boutiqueId,
            // Qui a saisi la fiche décide de qui pourra en changer le prix
            // et les médias plus tard (voir productService). C'est figé à la
            // création : un article reste « du commerçant » même si le
            // vendeur le déplace ensuite d'une boutique à l'autre.
            origine: acteur.role === 'commercant' ? 'commercant' : 'plateforme',
        });

        journaliser({
            acteur,
            action: 'produit.creation',
            cible: { id: product._id, libelle: product.name },
            boutiqueId,
            apercu: apercuProduit(product),
        });

        // Synchro Airtable en tâche de fond — ne doit jamais retarder ni
        // faire échouer la réponse au vendeur.
        syncProductToAirtable(product._id);

        res.json({ 
            success: true, 
            message: "Product Added",
            product: { id: product._id, video: videoUrl }
        });

    } catch (error) {
        console.error('❌ Erreur addProduct:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Ajouter des images à un produit existant
export const addProductImages = async (req, res) => {
    try {
        const { productId } = req.body;
        const images = req.files;

        if (!productId) {
            return res.status(400).json({ success: false, message: "ID produit requis" });
        }

        if (!images || images.length === 0) {
            return res.status(400).json({ success: false, message: "Aucune image fournie" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Produit non trouvé" });
        }

        if (req.staffUser && req.staffUser.role === 'commercant') {
            if (!product.boutiqueId) {
                return res.status(403).json({
                    success: false,
                    message: "Ce produit n'appartient à aucune boutique"
                });
            }
            if (product.boutiqueId.toString() !== req.staffUser.boutiqueId?.toString()) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Vous n'êtes pas autorisé à modifier ce produit" 
                });
            }
        }

        // Les médias d'un article saisi par la plateforme sont verrouillés
        // dans updateProduct : sans ce contrôle, cet endpoint serait la porte
        // dérobée qui permet d'en ajouter quand même.
        if (req.staffUser?.role === 'commercant' && estArticlePlateforme(product)) {
            return res.status(403).json({
                success: false,
                message: "Les photos de cet article sont fixées par la plateforme.",
            });
        }

        let imagesUrl = await Promise.all(
            images.map(async (item) => {
                let result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { resource_type: 'image' },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(item.buffer);
                });
                return result.secure_url;
            })
        );

        product.image = [...(product.image || []), ...imagesUrl];
        await product.save();

        res.json({ success: true, message: `${imagesUrl.length} image(s) ajoutée(s)`, product });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Vérification par lot : quels produits d'un panier sont encore
// disponibles (ni supprimés, ni archivés) ? Utilisé pour nettoyer le
// panier côté client sans dépendre de la liste paginée /list (qui ne
// contient qu'une page de produits et donnerait de faux positifs).
export const checkAvailability = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.json({ success: true, availableIds: [] });
        }

        const uniqueIds = [...new Set(ids)].filter(id => typeof id === 'string' && id.length === 24);
        const available = await Product.find({
            _id: { $in: uniqueIds },
            isArchived: { $ne: true }
        }).select('_id').lean();

        res.json({ success: true, availableIds: available.map(p => p._id.toString()) });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Champs strictement nécessaires à l'affichage d'un article dans une liste
// ou une carte. Tout le reste (description, vidéo, et surtout purchasePrice /
// externalLink qui sont des informations internes) est exclu explicitement :
// une liste publique ne doit jamais transporter la marge de la boutique.
const CHAMPS_CATALOGUE = 'name sku price offerPrice image categories variants stock inStock salesCount labelType size boutiqueId createdAt';

// GET /api/product/catalogue — Catalogue complet allégé (public)
//
// [CORRECTIF ARCHITECTURE] Le client garde un catalogue en mémoire dont
// dépendent le panier (calcul du total !), la fiche produit, les pages
// catégorie et la recherche. Il l'alimentait avec /api/product/list SANS
// paramètre, donc avec les 12 articles les plus récents seulement : au-delà,
// une fiche s'ouvrait vide et une ligne de panier inconnue était comptée
// zéro. Cet endpoint renvoie TOUT le catalogue, mais sans les champs lourds
// — c'est ce compromis qui rend l'état global tenable.
//
// Les articles en rupture sont inclus volontairement : ils peuvent être déjà
// dans un panier, et les masquer ferait à nouveau mentir le total.
export const productCatalogue = async (req, res) => {
    try {
        // [PERF] Ce catalogue est chargé au démarrage du client, sur chaque
        // visite. Sans cache, chaque chargement de page refaisait la requête
        // complète en base — lent, et coûteux en connexions Atlas depuis le
        // serverless. On le met en cache 60 s : le catalogue change rarement
        // (ajout/modif d'article) et 60 s de fraîcheur est sans conséquence
        // pour une vitrine. Aucune invalidation manuelle à maintenir : la
        // donnée se rafraîchit d'elle-même au pire une minute plus tard —
        // exactement la promesse du Cache-Control HTTP déjà posé sur la route.
        const products = await withCache(CACHE_KEYS.catalogueComplet, 60, async () => {
            const filter = await appliquerFiltreBoutiquesActives({ isArchived: { $ne: true } });
            return Product.find(filter)
                .select(CHAMPS_CATALOGUE)
                .sort({ createdAt: -1 })
                .lean();
        });

        res.json({ success: true, products, total: products.length });
    } catch (error) {
        console.error('Erreur productCatalogue:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Get Product : /api/product/list
export const productList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const sort = req.query.sort || 'createdAt';
        const skip = (page - 1) * limit;

        let filter = { isArchived: { $ne: true } };

        // [IMPORTANT] Le périmètre vient UNIQUEMENT de ?boutiqueId, jamais du
        // compte connecté. Restreindre implicitement la liste à la boutique
        // du commerçant connecté vidait la vitrine de tous les autres
        // articles (dont ceux de l'admin) dès qu'un commerçant naviguait sur
        // le site avec sa session ouverte. L'espace commerçant, lui, passe
        // toujours son boutiqueId explicitement.
        if (req.query.boutiqueId) {
            filter.boutiqueId = req.query.boutiqueId;
        }

        // [CORRECTIF] search / category / prix étaient déjà envoyés par
        // l'espace commerçant mais totalement ignorés ici : la barre de
        // recherche « fonctionnait » en n'ayant aucun effet. La construction
        // du filtre (et l'échappement des métacaractères) vit dans
        // utils/recherche.js, où elle est testée.
        Object.assign(filter, construireFiltreRecherche(req.query));

        // Vitrine publique : les articles des boutiques suspendues (ou dont
        // le compte commerçant n'est plus actif) en sortent. Un commerçant
        // connecté continue de voir les siens dans son espace, sinon il
        // n'aurait plus aucun moyen de les corriger.
        const estSonPropreCatalogue = req.staffUser?.role === 'commercant'
            && filter.boutiqueId?.toString() === req.staffUser.boutiqueId?.toString();
        if (!estSonPropreCatalogue && req.staffUser?.role !== 'admin') {
            filter = await appliquerFiltreBoutiquesActives(filter);
        }

        if (sort === 'discount') {
            const matchStage = {
                $match: {
                    ...filter,
                    $expr: {
                        $and: [
                            { $gt: ["$offerPrice", 0] },
                            { $lt: ["$offerPrice", "$price"] },
                            { $gt: ["$price", 0] }
                        ]
                    }
                }
            };

            const pipeline = [
                matchStage,
                {
                    $addFields: {
                        discountPercent: {
                            $multiply: [
                                { $divide: [{ $subtract: ["$price", "$offerPrice"] }, "$price"] },
                                100
                            ]
                        }
                    }
                },
                { $sort: { discountPercent: -1 } },
                { $skip: skip },
                { $limit: limit },
                { $unset: ['purchasePrice', 'externalLink'] } // infos internes, jamais exposées publiquement
            ];

            const products = await Product.aggregate(pipeline);
            const totalProducts = await Product.countDocuments({
                ...filter,
                $expr: {
                    $and: [
                        { $gt: ["$offerPrice", 0] },
                        { $lt: ["$offerPrice", "$price"] },
                        { $gt: ["$price", 0] }
                    ]
                }
            });
            const totalPages = Math.ceil(totalProducts / limit);

            return res.json({
                success: true,
                products,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProducts,
                    hasMore: page < totalPages
                }
            });
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'salesCount') sortOption = { salesCount: -1 };
        else if (sort === 'createdAt') sortOption = { createdAt: -1 };
        else if (sort === 'price') sortOption = { price: 1 };
        else if (sort === 'price-desc') sortOption = { price: -1 };

        const products = await Product.find(filter)
            .select('-purchasePrice -externalLink') // infos internes, jamais exposées publiquement
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean(); // [PHASE 2 - PERF] lecture pure, jamais .save() sur ces résultats

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({ 
            success: true, 
            products,
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts,
                hasMore: page < totalPages
            }
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single Product : /api/product/id
export const productById = async (req, res) => {
    try {
        const id = req.body?.id || req.query?.id;
        const product = await Product.findOne({ _id: id, isArchived: { $ne: true } })
            .select('-purchasePrice -externalLink') // infos internes, jamais exposées publiquement
            .lean(); // [PHASE 2 - PERF] lecture pure

        // Masquer la fiche d'un article dont la boutique est suspendue :
        // sinon un lien direct (favori, moteur de recherche) permettrait
        // encore de l'acheter alors qu'il a quitté le catalogue.
        if (product?.boutiqueId) {
            const suspendues = await getIdsBoutiquesSuspendues();
            if (suspendues.includes(product.boutiqueId.toString())) {
                return res.json({ success: true, product: null });
            }
        }

        res.json({ success: true, product });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Change Product inStock : /api/product/stock
export const changeStock = async (req, res) => {
    try {
        const { id, inStock } = req.body;
        await Product.findByIdAndUpdate(id, { inStock });

        syncProductToAirtable(id);

        res.json({ success: true, message: "Stock Updated" });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/product/staff/stock — Le commerçant ajuste ses quantités
//
// Volontairement séparé de updateProduct : ajuster un stock est le geste le
// plus fréquent d'un commerçant (réassort, rupture), et le faire passer par
// le formulaire produit complet l'obligeait à re-soumettre prix, images et
// variantes — avec le risque d'écraser au passage ce que le vendeur avait
// saisi sur un article qui lui a été attribué.
export const changeStockCommercant = async (req, res) => {
    try {
        const { id, stock, variants, inStock } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }

        // Cloisonnement : un commerçant ne touche qu'aux articles de SA
        // boutique — y compris ceux créés par le vendeur puis attribués.
        if (req.staffUser.role === 'commercant') {
            if (!product.boutiqueId
                || product.boutiqueId.toString() !== req.staffUser.boutiqueId?.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Cet article n'appartient pas à votre boutique",
                });
            }
        }

        const aDesVariantes = product.variants && product.variants.length > 0;

        if (aDesVariantes) {
            if (!Array.isArray(variants)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cet article a des variantes : envoyez leurs quantités',
                });
            }
            appliquerQuantites(product.variants, variants);
        } else if (stock !== undefined) {
            product.stock = Math.max(0, Number(stock) || 0);
        }

        product.stock = calculerStockTotal(product);
        product.inStock = determinerDisponibilite(product.stock, inStock === false);

        await product.save();

        journaliser({
            acteur: acteurDepuisRequete(req),
            action: 'produit.stock',
            cible: { id: product._id, libelle: product.name },
            boutiqueId: product.boutiqueId,
            apercu: apercuProduit(product),
            note: product.inStock ? '' : 'Article retiré de la vente.',
        });

        syncProductToAirtable(product._id);

        res.json({
            success: true,
            message: 'Stock mis à jour',
            product: {
                _id: product._id,
                stock: product.stock,
                inStock: product.inStock,
                variants: product.variants,
            },
        });
    } catch (error) {
        console.error('Erreur changeStockCommercant:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/product/assign-boutique — Vendeur / admin
//
// Attribue un article existant à une boutique (ou l'en détache avec
// boutiqueId vide). Après attribution, l'article apparaît dans l'espace du
// commerçant, qui en gère les quantités, et ses ventes créditent le
// portefeuille de la boutique.
export const assignerBoutique = async (req, res) => {
    try {
        const { id, boutiqueId } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }

        const cible = await resoudreBoutiqueDemandee(boutiqueId);
        if (cible === INVALIDE) {
            return res.status(400).json({ success: false, message: 'Boutique introuvable' });
        }

        product.boutiqueId = cible; // null = retour au catalogue principal
        await product.save();

        syncProductToAirtable(product._id);

        const boutique = cible ? await Boutique.findById(cible).select('nom') : null;

        res.json({
            success: true,
            message: boutique
                ? `Article attribué à « ${boutique.nom} »`
                : 'Article rattaché au catalogue principal',
            product: { _id: product._id, boutiqueId: product.boutiqueId },
        });
    } catch (error) {
        console.error('Erreur assignerBoutique:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ UPDATE PRODUCT - VERSION CORRIGÉE
export const updateProduct = async (req, res) => {
    try {
        const { id, name, description, categories, price, offerPrice, purchasePrice, externalLink, variants, stock, size, videoUrl, videoPublicId, labelType, image, sku } = req.body;
        const videoFile = req.file;


        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            return res.status(404).json({ success: false, message: "Produit non trouvé" });
        }

        const acteurProduit = acteurDepuisRequete(req);


        // ✅ Vérification des droits pour le commerçant
        if (req.staffUser && req.staffUser.role === 'commercant') {
            // Vérifier que le commerçant a une boutique
            if (!req.staffUser.boutiqueId) {
                return res.status(403).json({
                    success: false,
                    message: "Vous n'avez pas de boutique associée à votre compte"
                });
            }
            // Vérifier que le produit a une boutique
            if (!existingProduct.boutiqueId) {
                return res.status(403).json({
                    success: false,
                    message: "Ce produit n'appartient à aucune boutique"
                });
            }
            // Vérifier que le produit appartient bien à la boutique du commerçant
            if (existingProduct.boutiqueId.toString() !== req.staffUser.boutiqueId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Vous n'êtes pas autorisé à modifier ce produit"
                });
            }
        }

        // ✅ Anti-doublon (voir addProduct) : on ne vérifie que si le lien
        // est transmis ET non vide — un champ vidé volontairement ne peut
        // pas être « en conflit ». `exclureId` évite de se signaler
        // soi-même quand on resauvegarde le produit sans changer son lien.
        if (externalLink !== undefined) {
            const lienExterneBrut = externalLink?.trim();
            if (lienExterneBrut) {
                const conflit = await trouverProduitActifAvecLien(lienExterneBrut, existingProduct._id);
                if (conflit) {
                    return res.status(400).json({
                        success: false,
                        message: `Ce lien est déjà utilisé par « ${conflit.name} » (SKU ${conflit.sku}), encore en stock (${conflit.stock}). Vérifiez qu'il ne s'agit pas du même article.`,
                    });
                }
            }
        }

        const hasVariants = variants && variants.length > 0;
        const processedVariants = hasVariants ? normaliserVariantes(variants) : [];
        const totalStock = calculerStockTotal({ variants: processedVariants, stock });
        const inStock = determinerDisponibilite(totalStock);

        let descriptionToSave = description;
        if (Array.isArray(description)) {
            descriptionToSave = description.join('\n');
        }
        // HTML riche (Quill) : assaini à l'entrée, quel que soit le client.
        descriptionToSave = assainirRiche(descriptionToSave);

        const updateData = {
            name,
            description: descriptionToSave,
            categories: categories || [],
            price: price || 0,
            offerPrice: offerPrice || 0,
            purchasePrice: purchasePrice !== undefined ? purchasePrice : (existingProduct.purchasePrice || 0),
            // Chaîne vide envoyée volontairement = « effacer le lien » ; on ne
            // touche au champ que s'il est transmis (undefined = non géré par
            // le formulaire appelant), même logique que pour `sku` plus bas.
            ...(externalLink !== undefined ? { externalLink: externalLink || null } : {}),
            variants: hasVariants ? processedVariants : [],
            stock: totalStock,
            inStock,
            labelType: labelType || 'size',
        };

        if (!hasVariants) {
            updateData.size = size || null;
        } else {
            updateData.size = null;
        }

        // Le code n'est touché que s'il est transmis : un formulaire qui ne
        // gère pas encore le champ ne doit pas effacer le code existant.
        if (sku !== undefined) {
            const resultatSku = await resoudreSku(sku, id);
            if (resultatSku.erreur) {
                return res.status(400).json({ success: false, message: resultatSku.erreur });
            }
            updateData.sku = resultatSku.sku;
        }

        if (Array.isArray(image)) {
            updateData.image = image;
        }

        if (videoFile) {
            if (existingProduct?.videoPublicId) {
                try {
                    await cloudinary.uploader.destroy(existingProduct.videoPublicId, {
                        resource_type: 'video'
                    });
                } catch (error) {
                    console.error('❌ Erreur suppression vidéo:', error);
                }
            }

            try {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { resource_type: 'video', folder: 'products/videos', chunk_size: 6000000 },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(videoFile.buffer);
                });
                updateData.video = result.secure_url;
                updateData.videoPublicId = result.public_id;
            } catch (videoError) {
                console.error('❌ Erreur upload vidéo:', videoError);
            }
        } else if (videoUrl) {
            updateData.video = videoUrl;
            updateData.videoPublicId = null;
        }

        // Article saisi par la plateforme puis confié à cette boutique : le
        // commerçant en gère les quantités et les caractéristiques, mais ni
        // le prix ni les médias.
        //
        // Appliqué ICI, en tout dernier : les blocs image et vidéo ci-dessus
        // réécrivent `updateData`, un filtrage plus haut serait donc défait
        // juste après. Et on retire les champs plutôt que de rejeter toute la
        // requête — le reste de la modification est légitime.
        let champsRefuses = [];
        if (acteurProduit?.role === 'commercant' && estArticlePlateforme(existingProduct)) {
            const verrouillage = appliquerVerrouillagePlateforme(updateData, existingProduct);
            for (const cle of Object.keys(updateData)) delete updateData[cle];
            Object.assign(updateData, verrouillage.miseAJour);
            champsRefuses = verrouillage.champsRefuses;
        }

        await Product.findByIdAndUpdate(id, updateData);

        journaliser({
            acteur: acteurProduit,
            action: 'produit.modification',
            cible: { id: existingProduct._id, libelle: updateData.name || existingProduct.name },
            boutiqueId: existingProduct.boutiqueId,
            apercu: apercuProduit({ ...existingProduct.toObject(), ...updateData }),
            note: champsRefuses.length > 0
                ? `Champs verrouillés ignorés : ${champsRefuses.join(', ')}.`
                : '',
        });

        syncProductToAirtable(id);

        res.json({
            success: true,
            message: champsRefuses.length > 0
                ? 'Article mis à jour. Le prix et les médias sont fixés par la plateforme et n\'ont pas été modifiés.'
                : 'Product Updated',
            ...(champsRefuses.length > 0 ? { champsRefuses } : {}),
        });
    } catch (error) {
        console.log('❌ Erreur updateProduct:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Delete Product — AVEC VÉRIFICATION BOUTIQUE
// Un produit déjà commandé n'est JAMAIS supprimé en dur : ça casserait
// l'historique de commande des clients qui l'ont acheté. On l'archive à
// la place (voir models/Product.js). Seul un produit jamais vendu est
// vraiment effacé (base + images/vidéo Cloudinary + ligne Airtable).
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.body;
        const product = await Product.findById(id);
        
        if (!product) {
            return res.status(404).json({ success: false, message: "Produit non trouvé" });
        }

        if (req.staffUser && req.staffUser.role === 'commercant') {
            if (!product.boutiqueId) {
                return res.status(403).json({
                    success: false,
                    message: "Ce produit n'appartient à aucune boutique"
                });
            }
            if (product.boutiqueId.toString() !== req.staffUser.boutiqueId?.toString()) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Vous n'êtes pas autorisé à supprimer ce produit" 
                });
            }
        }

        const dejaCommande = await Order.exists({ 'items.product': id });

        if (dejaCommande) {
            // Archivage : disparaît de la boutique, reste en base pour ne
            // pas casser les commandes passées (nom/image/sku déjà copiés
            // dedans, mais on garde aussi le produit et ses médias intacts
            // par simplicité et cohérence visuelle avec l'historique).
            await Product.findByIdAndUpdate(id, {
                isArchived: true,
                archivedAt: new Date(),
                inStock: false,
            });

            syncProductToAirtable(id); // reste dans Airtable, "En stock" décoché

            journaliser({
                acteur: acteurDepuisRequete(req),
                action: 'produit.archivage',
                cible: { id: product._id, libelle: product.name },
                boutiqueId: product.boutiqueId,
                apercu: apercuProduit(product),
                note: "Déjà commandé : archivé au lieu d'être supprimé.",
            });

            return res.json({
                success: true,
                archived: true,
                message: "Produit déjà commandé par des clients : archivé plutôt que supprimé, pour préserver leur historique de commande."
            });
        }

        // Jamais commandé : suppression définitive, y compris les médias.
        if (product.videoPublicId) {
            try {
                await cloudinary.uploader.destroy(product.videoPublicId, {
                    resource_type: 'video'
                });
            } catch (error) {
                console.error('❌ Erreur suppression vidéo:', error);
            }
        }

        if (Array.isArray(product.image) && product.image.length > 0) {
            await Promise.all(product.image.map(async (url) => {
                const publicId = extraireCloudinaryPublicId(url);
                if (!publicId) return;
                try {
                    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
                } catch (error) {
                    console.error('❌ Erreur suppression image:', error);
                }
            }));
        }
        
        // La trace est écrite AVANT l'effacement : après, il ne reste plus
        // rien à recopier. C'est tout l'intérêt du journal ici — savoir
        // exactement ce qui a disparu, et par qui.
        journaliser({
            acteur: acteurDepuisRequete(req),
            action: 'produit.suppression',
            cible: { id: product._id, libelle: product.name },
            boutiqueId: product.boutiqueId,
            apercu: apercuProduit(product),
            note: 'Jamais commandé : suppression définitive, médias compris.',
        });

        await Product.findByIdAndDelete(id);

        deleteProductFromAirtable(id);

        res.json({ success: true, archived: false, message: "Product Deleted" });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Restaurer un produit archivé (le rend de nouveau visible en boutique)
export const unarchiveProduct = async (req, res) => {
    try {
        const { id } = req.body;
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ success: false, message: "Produit non trouvé" });
        }

        if (req.staffUser && req.staffUser.role === 'commercant') {
            if (product.boutiqueId?.toString() !== req.staffUser.boutiqueId?.toString()) {
                return res.status(403).json({ success: false, message: "Vous n'êtes pas autorisé à restaurer ce produit" });
            }
        }

        await Product.findByIdAndUpdate(id, { isArchived: false, archivedAt: null });

        syncProductToAirtable(id);

        res.json({ success: true, message: "Produit restauré" });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Liste complète pour l'espace admin/vendeur : contrairement à
// productList (publique, storefront), celle-ci renvoie AUSSI les produits
// archivés et les champs internes (purchasePrice, externalLink), pour que
// ProductList.jsx (admin) puisse tout afficher/éditer/restaurer. Pas de
// pagination : le catalogue d'un vendeur reste d'une taille gérable côté
// client, et ProductList.jsx filtre/trie déjà tout en mémoire.
export const adminProductList = async (req, res) => {
    try {
        const filter = {};
        if (req.staffUser && req.staffUser.role === 'commercant') {
            filter.boutiqueId = req.staffUser.boutiqueId;
        } else if (req.query.boutiqueId) {
            filter.boutiqueId = req.query.boutiqueId;
        }

        const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
        res.json({ success: true, products });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Reduce stock after order : internal function
export const reduceVariantStock = async (productId, color, size, quantity) => {
    const product = await Product.findById(productId);
    if (!product) return;

    if (product.variants.length === 0) {
        product.stock = Math.max(0, (product.stock || 0) - quantity);
        product.inStock = product.stock > 0;
        await product.save();
        return;
    }

    const variant = product.variants.find(v =>
        (color ? v.color === color : true) &&
        (size ? v.size === size : true)
    );

    if (variant) {
        variant.stock = Math.max(0, variant.stock - quantity);
    }

    product.inStock = product.variants.some(v => v.stock > 0);
    await product.save();
};

// Get Les plus populaires : /api/product/bestsellers
// [PHASE 2 - PERF] Ce calcul charge actuellement TOUTES les commandes payées
// en mémoire à chaque appel pour les agréger côté Node — ça ne passera pas
// à l'échelle au-delà de quelques milliers de commandes (à remplacer par un
// pipeline d'agrégation Mongo dès que le volume le justifie, cf Phase 4).
// En attendant, un cache Redis de quelques minutes absorbe l'essentiel du
// trafic répété sur cet endpoint déjà protégé par un Cache-Control (Phase 0).
export const getBestSellers = async (req, res) => {
    try {
        const products = await withCache(CACHE_KEYS.bestSellers, 300, async () => {
            const Order = await import('../models/Order.js').then(m => m.default);

            const orders = await Order.find({
                $or: [{ paymentType: "COD" }, { isPaid: true }]
            }).lean();

            const productSales = new Map();

            orders.forEach(order => {
                order.items.forEach(item => {
                    const productId = item.product.toString();
                    const quantity = item.quantity;

                    if (productSales.has(productId)) {
                        productSales.set(productId, productSales.get(productId) + quantity);
                    } else {
                        productSales.set(productId, quantity);
                    }
                });
            });

            const sortedProducts = Array.from(productSales.entries())
                .sort((a, b) => b[1] - a[1])
                .map(entry => entry[0]);

            const Product = await import('../models/Product.js').then(m => m.default);
            // Le résultat est mis en cache 5 min AVEC ce filtre : une
            // suspension invalide explicitement products:bestsellers.
            const suspendues = await getIdsBoutiquesSuspendues();
            const bestSellers = await Product.find({
                _id: { $in: sortedProducts.slice(0, 10) },
                inStock: true,
                isArchived: { $ne: true },
                ...(suspendues.length ? { boutiqueId: { $nin: suspendues } } : {}),
            }).select('-purchasePrice -externalLink').lean();

            return sortedProducts
                .filter(id => bestSellers.some(p => p._id.toString() === id))
                .slice(0, 10)
                .map(id => bestSellers.find(p => p._id.toString() === id));
        });

        res.json({ success: true, products });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Récupérer les détails d'une variante spécifique
export const getVariantDetails = async (req, res) => {
    try {
        const { productId, color } = req.body;
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        
        const variant = product.variants.find(v => v.color === color);
        
        if (!variant) {
            return res.status(404).json({ success: false, message: "Variant not found" });
        }
        
        res.json({
            success: true,
            variant: {
                color: variant.color,
                colorCode: variant.colorCode,
                price: variant.price || product.price,
                offerPrice: variant.offerPrice || product.offerPrice,
                stock: variant.stock,
                startImageIndex: variant.startImageIndex || 0
            }
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Resynchro manuelle complète vers Airtable (bouton « Synchroniser »)
// Un commerçant ne resynchronise que ses propres produits ; l'admin
// resynchronise tout le catalogue.
export const syncAirtable = async (req, res) => {
    try {
        const boutiqueId = (req.staffUser && req.staffUser.role === 'commercant')
            ? req.staffUser.boutiqueId
            : null;

        const result = await resyncAllProducts(boutiqueId);
        res.json({
            success: true,
            message: `${result.total} produit(s) synchronisé(s) avec Airtable.`,
            total: result.total,
        });
    } catch (error) {
        console.error('❌ Erreur syncAirtable:', error.message);
        const message = error.code === 'AIRTABLE_NOT_CONFIGURED'
            ? "La synchro Airtable n'est pas configurée sur le serveur (variables d'environnement manquantes)."
            : "Échec de la synchro Airtable : " + error.message;
        res.status(500).json({ success: false, message });
    }
};

// ✅ Import produit par URL (scraping)
export const scrapeImport = async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || typeof url !== "string") {
            return res.status(400).json({ success: false, message: "URL manquante" });
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return res.status(400).json({ success: false, message: "URL invalide" });
        }
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            return res.status(400).json({ success: false, message: "URL invalide" });
        }

        const preview = await scrapeProductPreview(url);
        const imageDataUrls = await fetchImagesAsDataUrls(preview.images);

        res.json({
            success: true,
            preview: {
                name: preview.name,
                description: preview.description,
                images: imageDataUrls
            }
        });
    } catch (error) {
        console.log(error.message);
        // Une URL refusée par le garde anti-SSRF est une mauvaise saisie du
        // client (400), pas une panne du serveur (500).
        if (estErreurUrlBloquee(error)) {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Impossible de récupérer les informations de cette page : " + error.message });
    }
};