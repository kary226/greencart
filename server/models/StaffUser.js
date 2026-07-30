import mongoose from "mongoose";

// StaffUser = le compte unique pour toute personne travaillant pour
// GreenCart, quel que soit son rôle. Remplace à terme le compte "seller"
// unique codé en dur dans les variables d'environnement.
//
// Un seul rôle par compte (pas de multi-rôle pour l'instant, ça reste
// simple à raisonner et à sécuriser). Le champ boutiqueId n'est renseigné
// que pour les comptes de rôle "commercant".
const staffUserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true, // toujours hashé (bcrypt), jamais en clair
    },
    nom: {
        type: String,
        required: true,
        trim: true,
    },
    telephone: {
        type: String,
        default: '',
        trim: true,
    },
    role: {
        type: String,
        enum: ['admin', 'commercant', 'livreur', 'assistant_shein'],
        required: true,
    },
    statut: {
        type: String,
        enum: ['actif', 'suspendu', 'en_attente'],
        default: 'en_attente',
    },
    // Secret TOTP propre à CE compte (contrairement au compte seller qui
    // partage un seul secret global via l'environnement). Généré à
    // l'activation du compte, jamais renvoyé au client après la mise en
    // place initiale.
    totpSecret: {
        type: String,
        default: null,
    },
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'boutique',
        default: null,
    },
    creePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },
    derniereConnexion: {
        type: Date,
        default: null,
    },
}, { timestamps: true, minimize: false });

// Index pour accélérer les requêtes courantes
staffUserSchema.index({ email: 1 });
staffUserSchema.index({ role: 1 });
staffUserSchema.index({ statut: 1 });

const StaffUser = mongoose.models.staffuser || mongoose.model('staffuser', staffUserSchema);

export default StaffUser;