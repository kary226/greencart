import mongoose from "mongoose";

// Une transaction immuable. Le solde du wallet est toujours la somme
// des transactions. Les montants sont positifs (vente) ou négatifs (retrait).
const walletTransactionSchema = new mongoose.Schema({
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'wallet',
        required: true,
    },
    type: {
        type: String,
        enum: ['vente', 'retrait', 'ajustement'],
        required: true,
    },
    montant: {
        type: Number,
        required: true,
        // Positif pour une vente, négatif pour un retrait
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'order',
        default: null,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    // Pour les retraits, référence à la demande
    demandeRetraitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'demanderetrait',
        default: null,
    },
    soldeApres: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

// Index pour accélérer les requêtes
walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ orderId: 1 });
walletTransactionSchema.index({ demandeRetraitId: 1 });

const WalletTransaction = mongoose.models.wallettransaction || 
    mongoose.model('wallettransaction', walletTransactionSchema);

export default WalletTransaction;