import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    // [PHASE 0 - PERF] productId/userId étaient stockés en String malgré le
    // `ref` (ce qui ne permettait ni populate() fiable, ni index efficace
    // pour comparer avec les ObjectId de product/user ailleurs dans la
    // base). Convertis en véritables ObjectId. Les contrôleurs passent déjà
    // des chaînes hexadécimales valides (req.body/req.params), Mongoose les
    // caste automatiquement en ObjectId — aucun changement requis côté
    // reviewController.js.
    productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'product', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'user', index: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    verified: { type: Boolean, default: false }, // Vérifie si l'utilisateur a acheté
    helpful: { type: Number, default: 0 }, // Nombre de "utile"
    createdAt: { type: Date, default: Date.now }
});

// [PHASE 0 - PERF] Index composé pour la vérification "l'utilisateur a-t-il
// déjà laissé un avis sur ce produit ?" (addReview), qui filtre sur les
// deux champs à la fois.
reviewSchema.index({ productId: 1, userId: 1 });

const Review = mongoose.models.review || mongoose.model('review', reviewSchema);
export default Review;