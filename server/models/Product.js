import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
    color: { type: String, default: null },
    colorCode: { type: String, default: "#000000" },
    size: { type: String, default: null },
    price: { type: Number, default: 0 },
    offerPrice: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    startImageIndex: { type: Number, default: 0 }
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    offerPrice: { type: Number, required: true },
    image: { type: Array, required: true },
    categories: [{ type: String, required: true }],
    inStock: { type: Boolean, default: true },
    variants: [variantSchema],
    
    // Stock pour les produits SIMPLES (sans variantes)
    stock: { type: Number, default: 0 },
    size: { type: String, default: null },  // Taille optionnelle pour produit simple
    
    // ✅ VIDEO DU PRODUIT (optionnel)
    video: { 
        type: String, 
        default: null 
    },
    // ✅ Public ID pour la suppression de la vidéo sur Cloudinary
    videoPublicId: { 
        type: String, 
        default: null 
    },
    
    // ✅ AJOUT : Compteur de ventes pour les tendances GLOBALES
    salesCount: {
        type: Number,
        default: 0,
        index: true  // Pour trier rapidement
    },

    // ✅ NOUVEAU : Type de libellé pour le mode multi-tailles
    // 'size' → affiche "Taille" (S, M, L...)
    // 'variant' → affiche "Variante" (Pastèque, Orange, ALOE VERA...)
    labelType: {
        type: String,
        enum: ['size', 'variant'],
        default: 'size'
    }
    
}, { timestamps: true });

// ✅ AJOUT : Index pour les requêtes "top ventes"
productSchema.index({ salesCount: -1 });

const Product = mongoose.models.product || mongoose.model('product', productSchema);
export default Product;