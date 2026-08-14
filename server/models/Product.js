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

    // ✅ Code article — référence courte pour retrouver un produit (voir
    // server/utils/sku.js). Volontairement SANS `default` : un champ absent
    // est ignoré par l'index partiel ci-dessous, alors qu'un `null` explicite
    // y serait indexé et ferait entrer en collision tous les produits qui
    // n'en ont pas encore.
    sku: {
        type: String,
        uppercase: true,
        trim: true,
    },

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
    },

    // ✅ NOUVEAU PHASE 3 : Boutique du produit
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'boutique',
        default: null, // null = produit de l'admin principal
        index: true,
    },

    // ✅ SYNCHRO AIRTABLE : coût d'achat, pour calculer la marge côté tableau
    // récapitulatif. N'est jamais exposé publiquement (routes /list, /id) —
    // seules les routes admin/staff le renvoient.
    purchasePrice: {
        type: Number,
        default: 0,
    },

    // ✅ SYNCHRO AIRTABLE : lien libre optionnel (ex: fiche fournisseur,
    // annonce SHEIN d'origine, etc.). Rien à voir avec les liens internes
    // Ramci — rempli à la main uniquement pour les produits qui en ont besoin.
    externalLink: {
        type: String,
        default: null,
        trim: true,
    }

}, { timestamps: true });

// ✅ AJOUT : Index pour les requêtes "top ventes"
productSchema.index({ salesCount: -1 });

// ✅ Unicité du code article. `partialFilterExpression` plutôt que `sparse` :
// sparse n'écarte que les documents où le champ est ABSENT, pas ceux où il
// vaut `null` — avec sparse seul, le deuxième produit sans code déclencherait
// une erreur de clé dupliquée. Le filtre par type ne retient que les vraies
// chaînes et laisse donc passer autant de produits sans code qu'on veut.
productSchema.index(
    { sku: 1 },
    { unique: true, partialFilterExpression: { sku: { $type: 'string' } } }
);

const Product = mongoose.models.product || mongoose.model('product', productSchema);
export default Product;