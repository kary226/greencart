import mongoose from "mongoose";

const ArticleSheinSchema = new mongoose.Schema({
    boutique: { type: String, default: "" },
    nom: { type: String, default: "" },
    variante: { type: String, default: "" },
    prixUnitaire: { type: Number, required: true },
    prixOriginal: { type: Number, default: null },
    quantite: { type: Number, required: true, min: 1 },
}, { _id: false });

const HistoriqueSchema = new mongoose.Schema({
    action: { type: String, required: true },
    agent: { type: String, default: null },
    date: { type: Date, default: Date.now },
    note: { type: String, default: "" },
}, { _id: false });

const colisSheinSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },

    numeroSuivi: { type: String, unique: true, sparse: true },

    devise: { type: String, enum: ["USD", "EUR", null], default: null },

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

    // ✅ PHASE 5 : Assistant assigné
    agentAssigneld: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
        index: true,
    },

    // ✅ PHASE 5 : Créé par (admin ou assistant)
    creePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },

    lienPartage: { type: String, default: "" },
    captures: [{ type: String }],

    extraction: {
        articles: [ArticleSheinSchema],
        totalAffiche: { type: Number, default: null },
    },

    articlesValides: [ArticleSheinSchema],

    devis: {
        montantArticles: { type: Number, default: 0 },
        tauxApplique: { type: Number, default: null },
        montantArticlesFCFA: { type: Number, default: null },
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
        methode: { type: String, enum: ["jeko", "cash", null], default: null },
    },

    estimationArrivee: {
        dateDebut: { type: Date, default: null },
        dateFin: { type: Date, default: null },
        confirmee: { type: Boolean, default: false },
        dateConfirmee: { type: Date, default: null },
    },

    livraison: {
        dateDebut: { type: Date, default: null },
        dateFin: { type: Date, default: null },
    },

    historique: [HistoriqueSchema],

    // Suivi de lecture du chat
    dernierMessageClientAt: { type: Date, default: null },
    dernierMessageAgentAt: { type: Date, default: null },
    adminDernierLu: { type: Date, default: null },
    clientDernierLu: { type: Date, default: null },

    agentTypingAt: { type: Date, default: null },
    clientTypingAt: { type: Date, default: null },

}, { timestamps: true, minimize: false });

// Index pour accélérer les requêtes
colisSheinSchema.index({ statut: 1 });
colisSheinSchema.index({ agentAssigneld: 1 });
colisSheinSchema.index({ numeroSuivi: 1 });
colisSheinSchema.index({ userId: 1 });

// Génère un numéro lisible du type SHEIN-2607-014
colisSheinSchema.pre("save", async function (next) {
    if (this.numeroSuivi) return next();
    const prefix = `SHEIN-${new Date().toISOString().slice(2, 7).replace("-", "")}`;
    const count = await mongoose.models.colisshein.countDocuments({
        numeroSuivi: { $regex: `^${prefix}` },
    });
    this.numeroSuivi = `${prefix}-${String(count + 1).padStart(3, "0")}`;
    next();
});

const ColisShein = mongoose.models.colisshein || mongoose.model("colisshein", colisSheinSchema);

export default ColisShein;