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
        let productData = JSON.parse(req.body.productData);
        const images = req.files?.images || [];
        const videoFile = req.files?.video ? req.files.video[0] : null;

        let boutiqueId = null;

        if (req.staffUser) {
            if (req.staffUser.role === 'commercant') {
                // Un commerçant publie forcément dans SA boutique : un
                // boutiqueId envoyé par le client est ignoré.
                if (!req.staffUser.boutiqueId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Vous n\'avez pas de boutique. Contactez l\'administrateur.'
                    });
                }
                boutiqueId = req.staffUser.boutiqueId;
            } else if (req.staffUser.role === 'admin') {
                boutiqueId = await resoudreBoutiqueDemandee(productData.boutiqueId);
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé - Rôle non autorisé'
                });
            }
        }
        else if (req.isTechnicalSeller) {
            // Le vendeur peut créer un article POUR une boutique : il le
            // saisit une fois, et l'article appartient ensuite au commerçant
            // (il apparaît dans son espace, celui-ci en gère les quantités,
            // et les ventes créditent son portefeuille). Sans boutiqueId,
            // l'article reste au catalogue principal, comme avant.
            boutiqueId = await resoudreBoutiqueDemandee(productData.boutiqueId);
        }
        else {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Non authentifié'
            });
        }

        if (boutiqueId === INVALIDE) {
            return res.status(400).json({ success: false, message: 'Boutique introuvable' });
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
            description: productData.description,
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

            // On ne remplace pas le tableau : on met à jour les quantités des
            // variantes reconnues (couleur + taille), et rien d'autre. Les
            // prix et images de variante restent la main du vendeur.
            const cle = (v) => `${v.color ?? ''}|${v.size ?? ''}`;
            const quantitesRecues = new Map(
                variants.map((v) => [cle(v), Math.max(0, Number(v.stock) || 0)])
            );

            product.variants.forEach((variante) => {
                const nouvelleQuantite = quantitesRecues.get(cle(variante));
                if (nouvelleQuantite !== undefined) variante.stock = nouvelleQuantite;
            });

            product.stock = product.variants.reduce((somme, v) => somme + (v.stock || 0), 0);
        } else if (stock !== undefined) {
            product.stock = Math.max(0, Number(stock) || 0);
        }

        // « Rupture » explicite : le commerçant peut retirer de la vente un
        // article qui a encore du stock (souci fournisseur, article réservé).
        // Sinon, la disponibilité découle des quantités.
        product.inStock = inStock === false ? false : product.stock > 0;

        await product.save();

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

        console.log('🔍 updateProduct - ID:', id);
        console.log('🔍 updateProduct - req.staffUser:', req.staffUser);

        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            return res.status(404).json({ success: false, message: "Produit non trouvé" });
        }

        console.log('🔍 updateProduct - existingProduct.boutiqueId:', existingProduct.boutiqueId);

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

        const hasVariants = variants && variants.length > 0;
        let processedVariants = [];
        let totalStock = 0;
        
        if (hasVariants) {
            processedVariants = (variants || []).map(v => ({
                color: v.color,
                colorCode: v.colorCode,
                size: v.size || null,
                price: v.price || 0,
                offerPrice: v.offerPrice || 0,
                stock: v.stock || 0,
                startImageIndex: v.startImageIndex || 0
            }));
            totalStock = processedVariants.reduce((sum, v) => sum + v.stock, 0);
        } else {
            totalStock = stock || 0;
        }

        const inStock = hasVariants 
            ? processedVariants.some(v => v.stock > 0) 
            : totalStock > 0;

        let descriptionToSave = description;
        if (typeof description === 'string') {
            descriptionToSave = description;
        } else if (Array.isArray(description)) {
            descriptionToSave = description.join('\n');
        }

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

        await Product.findByIdAndUpdate(id, updateData);

        syncProductToAirtable(id);

        res.json({ success: true, message: "Product Updated" });
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