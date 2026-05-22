import express from 'express';
import { addReview, getProductReviews, markHelpful } from '../controllers/reviewController.js';
import authUser from '../middlewares/authUser.js';

const reviewRouter = express.Router();

reviewRouter.post('/add', authUser, addReview);
reviewRouter.get('/product/:productId', getProductReviews);
reviewRouter.post('/helpful/:id', markHelpful);

export default reviewRouter;