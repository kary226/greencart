import mongoose from "mongoose";

const demandeRetraitSchema = new mongoose.Schema({
    commercialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
    },
    montant: {
        type: Number,
        required: true,
        min: 1000,
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
    },
    preuvePaiement: {
        type: String,
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

demandeRetraitSchema.index({ commercialId: 1, createdAt: -1 });
demandeRetraitSchema.index({ statut: 1 });

const DemandeRetrait = mongoose.models.demanderetrait || 
    mongoose.model('demanderetrait', demandeRetraitSchema);

export default DemandeRetrait;