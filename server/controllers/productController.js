import { v2 as cloudinary } from "cloudinary"
import Product from "../models/Product.js"
import { scrapeProductPreview, fetchImagesAsDataUrls } from "../services/scraper.js"

// ✅ Add Product - AVEC VIDÉO (OPTIMISÉ)
export const addProduct = async (req, res) => {
    try {
        console.log('📥 Début addProduct');
        console.log('📦 req.files:', req.files ? 'Présent' : 'Absent');
        console.log('📦 req.body.productData:', req.body.productData ? 'Présent' : 'Absent');
        
        let productData = JSON.parse(req.body.productData)
        
        // ✅ Récupérer les fichiers avec sécurité
        const images = req.files?.images || [];
        const videoFile = req.files?.video ? req.files.video[0] : null;

        console.log(`📸 Images: ${images.length} fichier(s)`);
        console.log(`📹 Vidéo: ${videoFile ? videoFile.originalname + ' (' + (videoFile.size / 1024 / 1024).toFixed(2) + 'MB)' : 'Aucune'}`);

        // Upload des images
        let imagesUrl = []
        if (images.length > 0) {
            console.log('⏳ Upload des images...');
            imagesUrl = await Promise.all(
                images.map(async (item, index) => {
                    try {
                        console.log(`  📸 Image ${index + 1}/${images.length}...`);
                        let result = await new Promise((resolve, reject) => {
                            const uploadStream = cloudinary.uploader.upload_stream(
                                { 
                                    resource_type: 'image',
                                    folder: 'products/images'
                                },
                                (error, result) => {
                                    if (error) reject(error);
                                    else resolve(result);
                                }
                            );
                            uploadStream.end(item.buffer);
                        });
                        console.log(`  ✅ Image ${index + 1} uploadée: ${result.secure_url}`);
                        return result.secure_url;
                    } catch (error) {
                        console.error(`  ❌ Erreur image ${index + 1}:`, error.message);
                        throw error;
                    }
                })
            );
        }

        // ✅ Upload de la vidéo si présente
        let videoUrl = null
        let videoPublicId = null
        if (videoFile) {
            console.log('⏳ Upload de la vidéo...');
            console.log(`📹 Taille: ${(videoFile.size / 1024 / 1024).toFixed(2)}MB`);
            console.log(`📹 Type: ${videoFile.mimetype}`);
            
            try {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { 
                            resource_type: 'video',
                            folder: 'products/videos',
                            chunk_size: 6000000,
                            timeout: 180000,
                            eager: [
                                { 
                                    format: 'mp4',
                                    quality: 'auto',
                                    fetch_format: 'auto'
                                }
                            ]
                        },
                        (error, result) => {
                            if (error) {
                                console.error('❌ Erreur Cloudinary:', error);
                                reject(error);
                            } else {
                                resolve(result);
                            }
                        }
                    );
                    
                    const buffer = videoFile.buffer;
                    const CHUNK_SIZE = 1024 * 1024;
                    let offset = 0;
                    
                    while (offset < buffer.length) {
                        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
                        uploadStream.write(chunk);
                        offset += CHUNK_SIZE;
                    }
                    uploadStream.end();
                });
                
                videoUrl = result.secure_url;
                videoPublicId = result.public_id;
                console.log('📹 Vidéo uploadée avec succès:', videoUrl);
                console.log('📹 Public ID:', videoPublicId);
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
        }))

        const hasVariants = productData.variants && productData.variants.length > 0
        
        let totalStock = 0
        if (hasVariants) {
            totalStock = processedVariants.reduce((sum, v) => sum + v.stock, 0)
        } else {
            totalStock = productData.stock || 0
        }

        console.log('📝 Création du produit...');

        // ✅ Récupérer labelType avec valeur par défaut 'size'
        const labelType = productData.labelType || 'size';

        const product = await Product.create({
            name: productData.name,
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
            labelType: labelType, // ✅ NOUVEAU
            // ✅ salesCount est ajouté automatiquement avec default: 0
        });

        console.log('✅ Produit créé avec succès:', product._id);
        console.log(`📹 Vidéo: ${videoUrl ? 'Présente' : 'Absente'}`);
        console.log(`📋 LabelType: ${labelType}`);

        res.json({ 
            success: true, 
            message: "Product Added",
            product: {
                id: product._id,
                video: videoUrl
            }
        })

    } catch (error) {
        console.error('❌ Erreur addProduct:', error.message);
        console.error('📚 Stack:', error.stack);
        res.json({ 
            success: false, 
            message: error.message 
        })
    }
}

// Ajouter des images à un produit existant
export const addProductImages = async (req, res) => {
    try {
        const { productId } = req.body;
        const images = req.files;

        if (!productId) {
            return res.json({ success: false, message: "ID produit requis" });
        }

        if (!images || images.length === 0) {
            return res.json({ success: false, message: "Aucune image fournie" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.json({ success: false, message: "Produit non trouvé" });
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
        res.json({ success: false, message: error.message });
    }
};

// ✅ Get Product : /api/product/list - AVEC TRI PAR salesCount
export const productList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const sort = req.query.sort || 'createdAt';
        const skip = (page - 1) * limit;

        let sortOption = { createdAt: -1 };
        if (sort === 'salesCount') {
            sortOption = { salesCount: -1 };
        } else if (sort === 'createdAt') {
            sortOption = { createdAt: -1 };
        } else if (sort === 'price') {
            sortOption = { price: 1 };
        } else if (sort === 'price-desc') {
            sortOption = { price: -1 };
        }

        console.log(`📊 Tri par: ${sort}`);

        const products = await Product.find({})
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments({});
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
        })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Get single Product : /api/product/id
export const productById = async (req, res) => {
    try {
        const { id } = req.body
        const product = await Product.findById(id)
        res.json({ success: true, product })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Change Product inStock : /api/product/stock
export const changeStock = async (req, res) => {
    try {
        const { id, inStock } = req.body
        await Product.findByIdAndUpdate(id, { inStock })
        res.json({ success: true, message: "Stock Updated" })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// ✅ UPDATE PRODUCT - AVEC VIDÉO (OPTIMISÉ)
export const updateProduct = async (req, res) => {
    try {
        const { id, name, description, categories, price, offerPrice, variants, stock, size, videoUrl, videoPublicId, labelType } = req.body
        const videoFile = req.file

        console.log('📥 Données reçues:', { id, name, size, stock, labelType, hasVariants: variants?.length > 0 })

        const hasVariants = variants && variants.length > 0
        
        let processedVariants = []
        let totalStock = 0
        
        if (hasVariants) {
            processedVariants = (variants || []).map(v => ({
                color: v.color,
                colorCode: v.colorCode,
                size: v.size || null,
                price: v.price || 0,
                offerPrice: v.offerPrice || 0,
                stock: v.stock || 0,
                startImageIndex: v.startImageIndex || 0
            }))
            totalStock = processedVariants.reduce((sum, v) => sum + v.stock, 0)
        } else {
            totalStock = stock || 0
        }

        const inStock = hasVariants 
            ? processedVariants.some(v => v.stock > 0) 
            : totalStock > 0

        let descriptionToSave = description
        if (typeof description === 'string') {
            descriptionToSave = description
        } else if (Array.isArray(description)) {
            descriptionToSave = description.join('\n')
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
            labelType: labelType || 'size', // ✅ NOUVEAU
        }

        if (!hasVariants) {
            updateData.size = size || null
        } else {
            updateData.size = null
        }

        // ✅ Gestion de la vidéo
        if (videoFile) {
            const existingProduct = await Product.findById(id);
            if (existingProduct?.videoPublicId) {
                try {
                    await cloudinary.uploader.destroy(existingProduct.videoPublicId, {
                        resource_type: 'video'
                    });
                    console.log('🗑️ Ancienne vidéo supprimée:', existingProduct.videoPublicId);
                } catch (error) {
                    console.error('❌ Erreur suppression vidéo:', error);
                }
            }

            try {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { 
                            resource_type: 'video',
                            folder: 'products/videos',
                            chunk_size: 6000000
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(videoFile.buffer);
                });
                updateData.video = result.secure_url;
                updateData.videoPublicId = result.public_id;
                console.log('📹 Nouvelle vidéo uploadée:', result.secure_url);
            } catch (videoError) {
                console.error('❌ Erreur upload vidéo:', videoError);
            }
        } 
        else if (videoUrl) {
            updateData.video = videoUrl;
            updateData.videoPublicId = null;
        }

        console.log('📤 Données à enregistrer:', updateData)

        await Product.findByIdAndUpdate(id, updateData)

        res.json({ success: true, message: "Product Updated" })
    } catch (error) {
        console.log('❌ Erreur updateProduct:', error.message);
        res.json({ success: false, message: error.message })
    }
}

// ✅ Delete Product - AVEC SUPPRESSION VIDÉO
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.body
        const product = await Product.findById(id)
        
        if (product) {
            if (product.videoPublicId) {
                try {
                    await cloudinary.uploader.destroy(product.videoPublicId, {
                        resource_type: 'video'
                    });
                    console.log('🗑️ Vidéo supprimée:', product.videoPublicId);
                } catch (error) {
                    console.error('❌ Erreur suppression vidéo:', error);
                }
            }
        }
        
        await Product.findByIdAndDelete(id)
        res.json({ success: true, message: "Product Deleted" })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Reduce stock after order : internal function
export const reduceVariantStock = async (productId, color, size, quantity) => {
    const product = await Product.findById(productId)
    if (!product) return

    if (product.variants.length === 0) {
        product.stock = Math.max(0, (product.stock || 0) - quantity)
        product.inStock = product.stock > 0
        await product.save()
        return
    }

    const variant = product.variants.find(v =>
        (color ? v.color === color : true) &&
        (size ? v.size === size : true)
    )

    if (variant) {
        variant.stock = Math.max(0, variant.stock - quantity)
    }

    product.inStock = product.variants.some(v => v.stock > 0)
    await product.save()
}

// Get Les plus populaires : /api/product/bestsellers
export const getBestSellers = async (req, res) => {
    try {
        const Order = await import('../models/Order.js').then(m => m.default);
        
        const orders = await Order.find({
            $or: [{ paymentType: "COD" }, { isPaid: true }]
        });

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
        });

        const orderedBestSellers = sortedProducts
            .filter(id => bestSellers.some(p => p._id.toString() === id))
            .slice(0, 10)
            .map(id => bestSellers.find(p => p._id.toString() === id));

        res.json({ success: true, products: orderedBestSellers });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// Récupérer les détails d'une variante spécifique
export const getVariantDetails = async (req, res) => {
    try {
        const { productId, color } = req.body
        const product = await Product.findById(productId)
        
        if (!product) {
            return res.json({ success: false, message: "Product not found" })
        }
        
        const variant = product.variants.find(v => v.color === color)
        
        if (!variant) {
            return res.json({ success: false, message: "Variant not found" })
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
        })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}
// ✅ Import produit par URL (scraping) — nom, description, images uniquement.
// Le prix, le stock et les variantes restent saisis manuellement par le vendeur.
export const scrapeImport = async (req, res) => {
    try {
        const { url } = req.body

        if (!url || typeof url !== "string") {
            return res.json({ success: false, message: "URL manquante" })
        }

        let parsedUrl
        try {
            parsedUrl = new URL(url)
        } catch {
            return res.json({ success: false, message: "URL invalide" })
        }
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            return res.json({ success: false, message: "URL invalide" })
        }

        const preview = await scrapeProductPreview(url)
        const imageDataUrls = await fetchImagesAsDataUrls(preview.images)

        res.json({
            success: true,
            preview: {
                name: preview.name,
                description: preview.description,
                images: imageDataUrls
            }
        })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: "Impossible de récupérer les informations de cette page : " + error.message })
    }
}