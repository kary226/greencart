import { v2 as cloudinary } from "cloudinary"
import Product from "../models/Product.js"

// ✅ Add Product - AVEC VIDÉO
export const addProduct = async (req, res) => {
    try {
        let productData = JSON.parse(req.body.productData)
        const images = req.files?.images || []
        const videoFile = req.files?.video ? req.files.video[0] : null

        // Upload des images
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
        )

        // ✅ Upload de la vidéo si présente
        let videoUrl = null
        let videoPublicId = null
        if (videoFile) {
            try {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { 
                            resource_type: 'video',
                            folder: 'products/videos',
                            chunk_size: 6000000 // 6MB chunks pour les gros fichiers
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(videoFile.buffer);
                });
                videoUrl = result.secure_url;
                videoPublicId = result.public_id;
                console.log('📹 Vidéo uploadée:', videoUrl);
            } catch (videoError) {
                console.error('❌ Erreur upload vidéo:', videoError);
                // On continue sans vidéo en cas d'erreur
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

        await Product.create({
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
            video: videoUrl,           // ✅ AJOUTÉ
            videoPublicId: videoPublicId // ✅ AJOUTÉ
        })

        res.json({ success: true, message: "Product Added" })

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
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

// Get Product : /api/product/list - AVEC PAGINATION
export const productList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const products = await Product.find({})
            .sort({ createdAt: -1 })
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

// ✅ UPDATE PRODUCT - AVEC VIDÉO
export const updateProduct = async (req, res) => {
    try {
        const { id, name, description, categories, price, offerPrice, variants, stock, size, videoUrl, videoPublicId } = req.body
        const videoFile = req.file // Si une nouvelle vidéo est uploadée

        console.log('📥 Données reçues:', { id, name, size, stock, hasVariants: variants?.length > 0 })

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
        }

        if (!hasVariants) {
            updateData.size = size || null
        } else {
            updateData.size = null
        }

        // ✅ Gestion de la vidéo
        // Si une nouvelle vidéo est uploadée
        if (videoFile) {
            // Supprimer l'ancienne vidéo si elle existe
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

            // Uploader la nouvelle vidéo
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
        // Si une URL vidéo est fournie (lien YouTube/Vimeo)
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
            // Supprimer la vidéo si elle existe
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
            
            // Supprimer les images (optionnel)
            // Les images sont déjà gérées ailleurs
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