import { v2 as cloudinary } from "cloudinary"
import Product from "../models/Product.js"

// Add Product : /api/product/add
export const addProduct = async (req, res) => {
    try {
        let productData = JSON.parse(req.body.productData)
        const images = req.files

        let imagesUrl = await Promise.all(
            images.map(async (item) => {
                let result = await cloudinary.uploader.upload(item.path, { resource_type: 'image' });
                return result.secure_url
            })
        )

        // Traitement des variantes avec images
        let variantIndex = 0
        const processedVariants = (productData.variants || []).map(variant => {
            const variantImages = []
            
            // Chaque variante peut avoir plusieurs images
            // On suppose que les images sont uploadées dans l'ordre :
            // d'abord les images par défaut, puis images variante1, variante2...
            const imagesPerVariant = productData.imagesPerVariant || 1
            
            for (let i = 0; i < imagesPerVariant; i++) {
                if (imagesUrl[variantIndex]) {
                    variantImages.push(imagesUrl[variantIndex])
                    variantIndex++
                }
            }
            
            return {
                ...variant,
                images: variantImages.length > 0 ? variantImages : [imagesUrl[0]] // fallback
            }
        })

        await Product.create({
            ...productData,
            image: imagesUrl.slice(variantIndex), // images par défaut
            variants: processedVariants,
            inStock: productData.variants?.some(v => v.stock > 0) ?? true,
        })

        res.json({ success: true, message: "Product Added" })

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Get Product : /api/product/list
export const productList = async (req, res) => {
    try {
        const products = await Product.find({})
        res.json({ success: true, products })
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

// Update Product : /api/product/update
export const updateProduct = async (req, res) => {
    try {
        const { id, name, description, categories, price, offerPrice, variants } = req.body

        const inStock = variants?.some(v => v.stock > 0) ?? true

        // Traiter les variantes (garder les images existantes)
        const processedVariants = (variants || []).map(v => ({
            ...v,
            images: v.images || [] // conserver les images existantes
        }))

        await Product.findByIdAndUpdate(id, {
            name,
            description: typeof description === 'string' ? description.split('\n') : description,
            categories: categories,
            price,
            offerPrice,
            variants: processedVariants,
            inStock,
        })

        res.json({ success: true, message: "Product Updated" })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Delete Product : /api/product/delete
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.body
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

    if (product.variants.length === 0) return

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

// NOUVEAU : Récupérer les détails d'une variante spécifique
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
                images: variant.images.length > 0 ? variant.images : product.image
            }
        })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}