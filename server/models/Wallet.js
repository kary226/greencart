import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
        unique: true,
    },
    solde: {
        type: Number,
        default: 0,
        min: 0,
    },
}, { timestamps: true });

// Recalculer le solde à partir des transactions
walletSchema.methods.recalculerSolde = async function() {
    const WalletTransaction = mongoose.model('wallettransaction');
    const result = await WalletTransaction.aggregate([
        { $match: { walletId: this._id } },
        { $group: { _id: null, total: { $sum: '$montant' } } }
    ]);
    this.solde = result.length > 0 ? result[0].total : 0;
    await this.save();
    return this.solde;
};

walletSchema.index({ ownerId: 1 });

const Wallet = mongoose.models.wallet || mongoose.model('wallet', walletSchema);

export default Wallet;