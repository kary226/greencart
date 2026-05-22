import { v2 as cloudinary } from "cloudinary"
import Product from "../models/Product.js"

// Add Product : /api/product/add
export const addProduct = async (req, res)=>{
    try {
        let productData = JSON.parse(req.body.productData)
        const images = req.files

        let imagesUrl = await Promise.all(
            images.map(async (item)=>{
                let result = await cloudinary.uploader.upload(item.path, {resource_type: 'image'});
                return result.secure_url
            })
        )

        await Product.create({
            ...productData,
            image: imagesUrl,
            variants: productData.variants || [],
            inStock: productData.variants?.some(v => v.stock > 0) ?? true,
        })

        res.json({success: true, message: "Product Added"})

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Get Product : /api/product/list
export const productList = async (req, res)=>{
    try {
        const products = await Product.find({})
        res.json({success: true, products})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Get single Product : /api/product/id
export const productById = async (req, res)=>{
    try {
        const { id } = req.body
        const product = await Product.findById(id)
        res.json({success: true, product})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Change Product inStock : /api/product/stock
export const changeStock = async (req, res)=>{
    try {
        const { id, inStock } = req.body
        await Product.findByIdAndUpdate(id, {inStock})
        res.json({success: true, message: "Stock Updated"})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Update Product : /api/product/update
export const updateProduct = async (req, res)=>{
    try {
        const { id, name, description, category, price, offerPrice, variants } = req.body

        const inStock = variants?.some(v => v.stock > 0) ?? true

        await Product.findByIdAndUpdate(id, {
            name,
            description: typeof description === 'string' ? description.split('\n') : description,
            category,
            price,
            offerPrice,
            variants: variants || [],
            inStock,
        })

        res.json({success: true, message: "Product Updated"})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// Delete Product : /api/product/delete
export const deleteProduct = async (req, res)=>{
    try {
        const { id } = req.body
        await Product.findByIdAndDelete(id)
        res.json({success: true, message: "Product Deleted"})
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

    // Mettre à jour inStock
    product.inStock = product.variants.some(v => v.stock > 0)
    await product.save()
}