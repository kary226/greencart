import express from 'express';
import rateLimit from 'express-rate-limit';
import { addReview, getProductReviews, markHelpful } from '../controllers/reviewController.js';
import authUser from '../middlewares/authUser.js';

const reviewRouter = express.Router();

// [FIX] Limite le spam sur "avis utile" : route publique (pas de compte
// requis), donc protégée par IP plutôt que par utilisateur. 30 votes /
// 10 min / IP est largement suffisant pour un usage normal (personne ne
// clique "utile" 30 fois de suite en 10 minutes), mais bloque le spam
// automatisé.
const helpfulLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Trop de votes, réessayez plus tard." }
});

reviewRouter.post('/add', authUser, addReview);
reviewRouter.get('/product/:productId', getProductReviews);
reviewRouter.post('/helpful/:id', helpfulLimiter, markHelpful);

export default reviewRouter;