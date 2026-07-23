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
    agent: { type: String, default: null }, // email de l'admin (pas d'ObjectId — auth mono-compte, pas de collection Seller)
    date: { type: Date, default: Date.now },
    note: { type: String, default: "" },
}, { _id: false });

const colisSheinSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },

    numeroSuivi: { type: String, unique: true, sparse: true }, // ex. SHEIN-2607-001, généré à la création

    // Devise détectée sur les captures ($ ou €) — jamais devinée côté client,
    // toujours renvoyée par l'extraction vision. Sert à choisir le bon taux FCFA.
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
        montantArticles: { type: Number, default: 0 },        // dans la devise d'origine ($ ou €)
        tauxApplique: { type: Number, default: null },          // FCFA par unité, figé au moment de la validation agent
        montantArticlesFCFA: { type: Number, default: null },   // montantArticles × tauxApplique, calculé côté serveur
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

    // Estimation d'arrivée à Abidjan — renseignée par l'agent juste après le paiement
    // du premier devis (acompte). Distincte de "livraison" (fenêtre remise au client),
    // celle-ci couvre l'achat + le transit jusqu'à l'entrepôt d'Abidjan.
    estimationArrivee: {
        dateDebut: { type: Date, default: null },
        dateFin: { type: Date, default: null },
        confirmee: { type: Boolean, default: false }, // true dès que l'agent clique "Confirmer l'arrivée"
        dateConfirmee: { type: Date, default: null },  // date réelle de la confirmation, indépendante de l'estimation
    },

    // Fenêtre de livraison estimée — renseignée par l'agent au moment du passage
    // au statut "en_livraison" (ex. entre le 12/01/2026 et le 19/01/2026).
    livraison: {
        dateDebut: { type: Date, default: null },
        dateFin: { type: Date, default: null },
    },

    historique: [HistoriqueSchema],

    // Suivi de lecture du chat — sert uniquement à afficher les badges "nouveau message"
    // des deux côtés, jamais à bloquer l'accès aux messages.
    dernierMessageClientAt: { type: Date, default: null },
    dernierMessageAgentAt: { type: Date, default: null },
    adminDernierLu: { type: Date, default: null },
    clientDernierLu: { type: Date, default: null },

    // Indicateur "en train d'écrire" — horodatage mis à jour à chaque frappe,
    // considéré valide quelques secondes seulement (voir TYPING_TTL_MS côté client).
    agentTypingAt: { type: Date, default: null },
    clientTypingAt: { type: Date, default: null },

}, { timestamps: true, minimize: false });

// Génère un numéro lisible du type SHEIN-2607-014 (mois+année + compteur du jour)
// au premier enregistrement seulement — jamais régénéré ensuite.
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