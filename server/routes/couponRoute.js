import express from 'express';
import { 
    getAllCoupons, 
    addCoupon, 
    updateCoupon, 
    deleteCoupon, 
    toggleCouponStatus,
    validateCoupon,
    applyCoupon
} from '../controllers/couponController.js';
import authSeller from '../middlewares/authSeller.js';
import authUser from '../middlewares/authUser.js';

const couponRouter = express.Router();

// Routes admin
couponRouter.get('/admin-list', authSeller, getAllCoupons);
couponRouter.post('/add', authSeller, addCoupon);
couponRouter.post('/update', authSeller, updateCoupon);
couponRouter.post('/delete', authSeller, deleteCoupon);
couponRouter.post('/toggle', authSeller, toggleCouponStatus);

// Routes client
couponRouter.post('/validate', authUser, validateCoupon);
couponRouter.post('/apply', authUser, applyCoupon);

export default couponRouter;