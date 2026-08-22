import mongoose from "mongoose";

/**
 * StaffUser = le compte unique pour toute personne travaillant pour GreenCart.
 * 
 * Un seul rôle par compte (pour simplifier la sécurité et la gestion).
 * Le champ boutiqueId n'est renseigné que pour les comptes de rôle "commercant".
 * 
 * [PHASE 1] Ajout du champ 'permissions' pour permettre des permissions sur mesure,
 * ainsi que de nouveaux rôles (super_admin, finance_admin, etc.)
 */
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
    // [PHASE 1] Rôles étendus
    role: {
        type: String,
        enum: [
            // Nouveaux rôles granulaires
            'super_admin',
            'finance_admin',
            'warehouse_admin',
            'logistics_admin',
            'catalog_admin',
            'support_admin',
            'read_only_auditor',
            // Rôles existants (conservés pour compatibilité)
            'admin',
            'commercant',
            'livreur',
            'assistant_shein',
        ],
        required: true,
    },
    statut: {
        type: String,
        enum: ['actif', 'suspendu', 'en_attente'],
        default: 'en_attente',
    },
    // Secret TOTP propre à CE compte
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
    // [PHASE 1] Permissions sur mesure (optionnel)
    // Si ce champ est rempli, il écrase les permissions du rôle.
    // Sinon, elles sont chargées depuis RolePermission.
    permissions: {
        type: [String],
        default: [],
    },
}, { timestamps: true, minimize: false });

// Index pour accélérer les requêtes courantes
staffUserSchema.index({ role: 1 });
staffUserSchema.index({ statut: 1 });

const StaffUser = mongoose.models.staffuser || mongoose.model('staffuser', staffUserSchema);

export default StaffUser;