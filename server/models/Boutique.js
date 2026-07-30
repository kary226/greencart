import mongoose from "mongoose";

// Une boutique appartient à un commerçant (StaffUser avec role: 'commercant').
// Créée automatiquement lors de l'activation du compte.
const boutiqueSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true,
        trim: true,
        default: 'Ma boutique',
    },
    description: {
        type: String,
        default: '',
        trim: true,
    },
    logo: {
        type: String, // URL Cloudinary
        default: null,
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
        unique: true, // Un commerçant = une boutique
    },
    statut: {
        type: String,
        enum: ['active', 'suspendue'],
        default: 'active',
    },
}, { timestamps: true });

// Index pour accélérer les requêtes
boutiqueSchema.index({ ownerId: 1 });
boutiqueSchema.index({ nom: 1 });

const Boutique = mongoose.models.boutique || mongoose.model('boutique', boutiqueSchema);

export default Boutique;