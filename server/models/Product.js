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

        // Traitement des variantes
        const processedVariants = (productData.variants || []).map(variant => ({
            color: variant.color,
            colorCode: variant.colorCode,
            size: variant.size || null,
            price: variant.price || 0,
            offerPrice: variant.offerPrice || 0,
            stock: variant.stock || 0,
            startImageIndex: variant.startImageIndex || 0
        }))

        // Déterminer si c'est un produit avec variantes ou simple
        const hasVariants = productData.variants && productData.variants.length > 0

        // Création du produit
        await Product.create({
            name: productData.name,
            description: productData.description,
            categories: productData.categories,
            price: productData.price,
            offerPrice: productData.offerPrice,
            image: imagesUrl,
            variants: processedVariants,
            // ⭐ Pour produit simple : on utilise productData.stock
            // ⭐ Pour produit avec variantes : le stock global est 0 (on utilise les stocks des variantes)
            stock: hasVariants ? 0 : (productData.stock || 0),
            inStock: hasVariants 
                ? processedVariants.some(v => v.stock > 0) 
                : (productData.stock > 0),
        })

        res.json({ success: true, message: "Product Added" })

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}