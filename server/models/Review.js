import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    productId: { type: String, required: true, ref: 'product' },
    userId: { type: String, required: true, ref: 'user' },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    verified: { type: Boolean, default: false }, // Vérifie si l'utilisateur a acheté
    helpful: { type: Number, default: 0 }, // Nombre de "utile"
    createdAt: { type: Date, default: Date.now }
});

const Review = mongoose.models.review || mongoose.model('review', reviewSchema);
export default Review;