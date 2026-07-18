import mongoose from "mongoose";

const ArticleSheinSchema = new mongoose.Schema({
    boutique: { type: String, default: "" },
    nom: { type: String, default: "" },
    variante: { type: String, default: "" },
    prixUnitaire: { type: Number, required: true },
    prixOriginal: { type: Number, default: null }, // prix barré, jamais utilisé dans les calculs
    quantite: { type: Number, required: true, min: 1 },
}, { _id: false });

const HistoriqueSchema = new mongoose.Schema({
    action: { type: String, required: true },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: "seller", default: null },
    date: { type: Date, default: Date.now },
    note: { type: String, default: "" },
}, { _id: false });

const colisSheinSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },

    statut: {
        type: String,
        enum: [
            "soumis",
            "en_verification",
            "devis_envoye",
            "acompte_paye",
            "achete",
            "en_entrepot",
            "pese",
            "solde_du",
            "solde_paye",
            "en_livraison",
            "livre",
            "annule",
        ],
        default: "soumis",
    },

    lienPartage: { type: String, default: "" }, // référence uniquement, jamais une source de données
    captures: [{ type: String }],                // URLs Cloudinary des captures panier

    // Résultat brut de l'extraction vision, avant toute correction
    extraction: {
        articles: [ArticleSheinSchema],
        totalAffiche: { type: Number, default: null }, // null si le panier n'était pas entièrement coché
    },

    // Version éditée par le client puis validée par l'agent — sert seule au calcul
    articlesValides: [ArticleSheinSchema],

    devis: {
        montantArticles: { type: Number, default: 0 },
        fraisLivraisonEstime: { type: Number, default: 0 },
        montantInitial: { type: Number, default: 0 },
        tauxParKilo: { type: Number, default: 0 },
        poidsReel: { type: Number, default: null },
        montantFinal: { type: Number, default: null },
    },

    paiement: {
        acompteMontant: { type: Number, default: 0 },
        acomptePaye: { type: Boolean, default: false },
        acompteDate: { type: Date, default: null },
        soldeMontant: { type: Number, default: 0 },
        soldePaye: { type: Boolean, default: false },
        soldeDate: { type: Date, default: null },
        methode: { type: String, enum: ["geniuspay", "cash", null], default: null },
    },

    agentAssigne: { type: mongoose.Schema.Types.ObjectId, ref: "seller", default: null },
    historique: [HistoriqueSchema],

}, { timestamps: true, minimize: false });

const ColisShein = mongoose.models.colisshein || mongoose.model("colisshein", colisSheinSchema);

export default ColisShein;