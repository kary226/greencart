import mongoose from "mongoose";

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

walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ orderId: 1 });
walletTransactionSchema.index({ demandeRetraitId: 1 });

const WalletTransaction = mongoose.models.wallettransaction || 
    mongoose.model('wallettransaction', walletTransactionSchema);

export default WalletTransaction;