import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'product' }, // ✅ ObjectId
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'user' },       // ✅ ObjectId
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    verified: { type: Boolean, default: false },
    helpful: { type: Number, default: 0 }
}, { timestamps: true });

// ✅ Index pour accélérer les recherches
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true }); // ✅ Empêche les doublons en BDD

const Review = mongoose.models.review || mongoose.model('review', reviewSchema);
export default Review;
