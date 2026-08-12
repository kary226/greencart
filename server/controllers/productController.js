import { v2 as cloudinary } from "cloudinary";
import Product from "../models/Product.js";
import { scrapeProductPreview, fetchImagesAsDataUrls } from "../services/scraper.js";
import { withCache, CACHE_KEYS } from "../configs/redisCache.js";
import { genererSkuUnique, normaliserSku, skuEstDisponible, skuEstValide } from "../utils/sku.js";

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

// ✅ Add Product - AVEC VIDÉO ET BOUTIQUE
export const addProduct = async (req, res) => {
    try {
        let productData = JSON.parse(req.body.productData);
        const images = req.files?.images || [];
        const videoFile = req.files?.video ? req.files.video[0] : null;

        let boutiqueId = null;
        
        if (req.staffUser) {
            if (req.staffUser.role === 'commercant') {
                if (!req.staffUser.boutiqueId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Vous n\'avez pas de boutique. Contactez l\'administrateur.'
                    });
                }
                boutiqueId = req.staffUser.boutiqueId;
            } else if (req.staffUser.role === 'admin') {
                boutiqueId = null;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé - Rôle non autorisé'
                });
            }
        } 
        else if (req.isTechnicalSeller) {
            boutiqueId = null;
        } 
        else {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Non authentifié'
            });
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

// ✅ Get Product : /api/product/list
export const productList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const sort = req.query.sort || 'createdAt';
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.boutiqueId) {
            filter.boutiqueId = req.query.boutiqueId;
        }
        if (req.staffUser && req.staffUser.role === 'commercant') {
            filter.boutiqueId = req.staffUser.boutiqueId;
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
                { $limit: limit }
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
        const product = await Product.findById(id).lean(); // [PHASE 2 - PERF] lecture pure
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
        res.json({ success: true, message: "Stock Updated" });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ UPDATE PRODUCT - VERSION CORRIGÉE
export const updateProduct = async (req, res) => {
    try {
        const { id, name, description, categories, price, offerPrice, variants, stock, size, videoUrl, videoPublicId, labelType, image, sku } = req.body;
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

        res.json({ success: true, message: "Product Updated" });
    } catch (error) {
        console.log('❌ Erreur updateProduct:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Delete Product - AVEC VÉRIFICATION BOUTIQUE
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
        
        if (product.videoPublicId) {
            try {
                await cloudinary.uploader.destroy(product.videoPublicId, {
                    resource_type: 'video'
                });
            } catch (error) {
                console.error('❌ Erreur suppression vidéo:', error);
            }
        }
        
        await Product.findByIdAndDelete(id);
        res.json({ success: true, message: "Product Deleted" });
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
            const bestSellers = await Product.find({
                _id: { $in: sortedProducts.slice(0, 10) },
                inStock: true
            }).lean();

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
        res.status(500).json({ success: false, message: "Impossible de récupérer les informations de cette page : " + error.message });
    }
};