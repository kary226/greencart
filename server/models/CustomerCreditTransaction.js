import mongoose from "mongoose";

const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'order', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
}, { timestamps: true });

schema.index({ orderId: 1, itemId: 1, type: 1 }, { unique: true });
export default mongoose.models.customerCreditTransaction ||
    mongoose.model('customerCreditTransaction', schema);
