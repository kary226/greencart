import mongoose from "mongoose";

// Demande de retrait faite par un commerçant, traitée par l'admin.
const demandeRetraitSchema = new mongoose.Schema({
    commercialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
    },
    montant: {
        type: Number,
        required: true,
        min: 1000, // Montant minimum de retrait
    },
    statut: {
        type: String,
        enum: ['en_attente', 'approuvee', 'rejetee', 'payee'],
        default: 'en_attente',
    },
    moyenPaiement: {
        type: String,
        required: true,
        trim: true,
        // ex: "Orange Money 07 12 34 56 78" ou "Banque ABC - Compte 12345"
    },
    preuvePaiement: {
        type: String, // URL Cloudinary (uploadé par l'admin)
        default: null,
    },
    traitePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },
    noteAdmin: {
        type: String,
        default: '',
        trim: true,
    },
}, { timestamps: true });

// Index pour accélérer les requêtes
demandeRetraitSchema.index({ commercialId: 1, createdAt: -1 });
demandeRetraitSchema.index({ statut: 1 });

const DemandeRetrait = mongoose.models.demanderetrait || 
    mongoose.model('demanderetrait', demandeRetraitSchema);

export default DemandeRetrait;