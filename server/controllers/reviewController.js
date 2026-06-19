import Review from "../models/Review.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

// Ajouter un avis
export const addReview = async (req, res) => {
    try {
        // userId est injecté par le middleware authUser (req.body.userId)
        const { productId, rating, comment, userId } = req.body;
        
        console.log("userId reçu:", userId);
        
        if (!userId) {
            return res.json({ success: false, message: "Vous devez être connecté" });
        }

        // Récupérer l'utilisateur
        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Vérifier si l'utilisateur a déjà donné un avis
        const existingReview = await Review.findOne({ productId, userId });
        if (existingReview) {
            return res.json({ success: false, message: "Vous avez déjà donné un avis pour ce produit" });
        }

        // Vérifier si l'utilisateur a acheté le produit
        const hasPurchased = await Order.findOne({
            userId,
            "items.product": productId,
            status: "Delivered"
        });

        const review = await Review.create({
            productId,
            userId,
            userName: user.name || "Client",
            rating: Number(rating),
            comment,
            verified: !!hasPurchased
        });

        res.json({ success: true, message: "Avis ajouté", review });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// Récupérer les avis d'un produit
export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ productId }).sort({ createdAt: -1 });
        
        const averageRating = reviews.length > 0 
            ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
            : 0;
        
        res.json({
            success: true,
            reviews,
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: reviews.length
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Marquer un avis comme utile (protégé + anti-doublon)
export const markHelpful = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.body.userId; // injecté par authUser (middleware requis)

        if (!userId) {
            return res.json({ success: false, message: "Authentification requise" });
        }

        // ⚠️ Nécessite d'avoir un champ `helpfulVoters` (tableau d'ObjectId) dans le modèle Review
        // Pour l'instant, on vérifie et on empêche les doublons
        const review = await Review.findById(id);
        if (!review) {
            return res.json({ success: false, message: "Avis introuvable" });
        }

        // Si le champ helpfulVoters n'existe pas, initialisez-le côté modèle
        if (review.helpfulVoters && review.helpfulVoters.includes(userId)) {
            return res.json({ success: false, message: "Vous avez déjà voté pour cet avis" });
        }

        // Incrémente et ajoute l'utilisateur
        await Review.findByIdAndUpdate(id, {
            $inc: { helpful: 1 },
            $push: { helpfulVoters: userId }
        });

        res.json({ success: true, message: "Merci !" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};