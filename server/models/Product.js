import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
    color: { type: String, default: null },        // Nom de la couleur : "Rouge", "Bleu", "Noir"
    colorCode: { type: String, default: "#000000" }, // Code hexadécimal pour l'affichage
    size: { type: String, default: null },
    price: { type: Number, default: 0 },            // Prix spécifique à cette variante
    offerPrice: { type: Number, default: 0 },       // Prix promo spécifique
    stock: { type: Number, default: 0 },
    startImageIndex: { type: Number, default: 0 }   // ← NOUVEAU : index de la première photo associée (ex: 0, 3, 6...)
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: Array, required: true },
    price: { type: Number, required: true },        // Prix par défaut
    offerPrice: { type: Number, required: true },   // Prix promo par défaut
    image: { type: Array, required: true },         // TOUTES les images du produit (dans l'ordre)
    categories: [{ type: String, required: true }],
    inStock: { type: Boolean, default: true },
    variants: [variantSchema]
}, { timestamps: true });

const Product = mongoose.models.product || mongoose.model('product', productSchema);
export default Product;