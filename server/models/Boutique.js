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
        type: String,
        default: null,
    },
    logoPublicId: {
        type: String,
        default: null,
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
        unique: true,
    },
    statut: {
        type: String,
        enum: ['active', 'suspendue'],
        default: 'active',
    },
    // Renseigné par l'admin au moment d'une suspension, affiché tel quel au
    // commerçant pour qu'il sache quoi corriger.
    motifSuspension: {
        type: String,
        default: '',
        trim: true,
    },
    // Zones où le commerçant livre lui-même. Uniquement les villes/communes
    // (pas de prix ici : les tarifs de livraison restent gérés par l'admin
    // au niveau plateforme). communeId à null = livre toute la ville.
    zonesLivraison: [{
        cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'city', required: true },
        communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'commune', default: null },
    }],
}, { timestamps: true });

boutiqueSchema.index({ ownerId: 1 });
boutiqueSchema.index({ nom: 1 });

const Boutique = mongoose.models.boutique || mongoose.model('boutique', boutiqueSchema);

export default Boutique;