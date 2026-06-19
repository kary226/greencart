import { v2 as cloudinary } from "cloudinary";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

// Add Product : /api/product/add
export const addProduct = async (req, res) => {
    try {
        let productData = JSON.parse(req.body.productData);
        const images = req.files;

        let imagesUrl = await Promise.all(
            images.map(async (item) => {
                let result = await cloudinary.uploader.upload(item.path, { resource_type: 'image' });
                return result.secure_url;
            })
        );

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
            : productData.stock || 0;

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
        });

        res.json({ success: true, message: "Product Added" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Get Products avec pagination : /api/product/list
export const productList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const [products, totalProducts] = await Promise.all([
            Product.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Product.countDocuments({})
        ]);

        res.json({
            success: true,
            products,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalProducts / limit),
                totalProducts,
                hasMore: page < Math.ceil(totalProducts / limit)
            }
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Get single Product : /api/product/id
export const productById = async (req, res) => {
    try {
        const { id } = req.body;
        const product = await Product.findById(id);
        res.json({ success: true, product });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
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
        res.json({ success: false, message: error.message });
    }
};

// Update Product : /api/product/update
export const updateProduct = async (req, res) => {
    try {
        const { id, name, description, categories, price, offerPrice, variants, stock, size } = req.body;
        const hasVariants = variants && variants.length > 0;

        let processedVariants = [];
        let totalStock = 0;

        if (hasVariants) {
            processedVariants = variants.map(v => ({
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

        await Product.findByIdAndUpdate(id, {
            name,
            description: typeof description === 'string' ? description.split('\n') : description,
            categories,
            price,
            offerPrice,
            variants: hasVariants ? processedVariants : [],
            stock: totalStock,
            size: hasVariants ? null : (size || null),
            inStock,
        });

        res.json({ success: true, message: "Product Updated" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Delete Product : /api/product/delete
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.body;
        await Product.findByIdAndDelete(id);
        res.json({ success: true, message: "Product Deleted" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Reduce stock after order
export const reduceVariantStock = async (productId, color, size, quantity) => {
    const product = await Product.findById(productId);
    if (!product) return;

    if (product.variants.length === 0) {
        await Product.findOneAndUpdate(
            { _id: productId, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } }
        );
        const updated = await Product.findById(productId);
        if (updated) {
            updated.inStock = updated.stock > 0;
            await updated.save();
        }
        return;
    }

    const variant = product.variants.find(v =>
        (color ? v.color === color : true) && (size ? v.size === size : true)
    );
    if (variant) {
        variant.stock = Math.max(0, variant.stock - quantity);
    }
    product.inStock = product.variants.some(v => v.stock > 0);
    await product.save();
};

// ✅ getBestSellers avec aggregation MongoDB (ne charge plus tout en mémoire)
export const getBestSellers = async (req, res) => {
    try {
        const bestSellers = await Order.aggregate([
            // Uniquement les commandes payées
            { $match: { $or: [{ paymentType: "COD" }, { isPaid: true }] } },
            // Décomposer les items
            { $unwind: "$items" },
            // Grouper par produit et sommer les quantités
            { $group: { _id: "$items.product", totalSold: { $sum: "$items.quantity" } } },
            // Trier par les plus vendus
            { $sort: { totalSold: -1 } },
            // Prendre les 10 premiers
            { $limit: 10 },
            // Joindre avec la collection products
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            // Garder uniquement les produits en stock
            { $match: { "product.inStock": true } },
            { $replaceRoot: { newRoot: "$product" } }
        ]);

        res.json({ success: true, products: bestSellers });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// Détails d'une variante
export const getVariantDetails = async (req, res) => {
    try {
        const { productId, color } = req.body;
        const product = await Product.findById(productId);

        if (!product) return res.json({ success: false, message: "Product not found" });

        const variant = product.variants.find(v => v.color === color);
        if (!variant) return res.json({ success: false, message: "Variant not found" });

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
        res.json({ success: false, message: error.message });
    }
};
