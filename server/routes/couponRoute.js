import express from 'express';
import { 
    getAllCoupons, 
    addCoupon, 
    updateCoupon, 
    deleteCoupon, 
    toggleCouponStatus,
    validateCoupon,
    applyCoupon,
    getMesCoupons,
    addMonCoupon,
    updateMonCoupon,
    deleteMonCoupon,
    toggleMonCouponStatus
} from '../controllers/couponController.js';
import authSeller from '../middlewares/authSeller.js';
import authUser from '../middlewares/authUser.js';
import authStaff, { requireRole } from '../middlewares/authStaff.js';

const couponRouter = express.Router();

// Routes admin
couponRouter.get('/admin-list', authSeller, getAllCoupons);
couponRouter.post('/add', authSeller, addCoupon);
couponRouter.post('/update', authSeller, updateCoupon);
couponRouter.post('/delete', authSeller, deleteCoupon);
couponRouter.post('/toggle', authSeller, toggleCouponStatus);

// Routes commerçant (scopées à sa propre boutique)
couponRouter.get('/mes-coupons', authStaff, requireRole('commercant'), getMesCoupons);
couponRouter.post('/mes-coupons/add', authStaff, requireRole('commercant'), addMonCoupon);
couponRouter.post('/mes-coupons/update', authStaff, requireRole('commercant'), updateMonCoupon);
couponRouter.post('/mes-coupons/delete', authStaff, requireRole('commercant'), deleteMonCoupon);
couponRouter.post('/mes-coupons/toggle', authStaff, requireRole('commercant'), toggleMonCouponStatus);

// Routes client
couponRouter.post('/validate', authUser, validateCoupon);
couponRouter.post('/apply', authUser, applyCoupon);

export default couponRouter;