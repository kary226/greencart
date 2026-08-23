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
import authUser from '../middlewares/authUser.js';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import { requirePermission } from '../middlewares/permission.js';
import requireBoutiqueActive from '../middlewares/requireBoutiqueActive.js';
import { couponLimiter } from '../middlewares/rateLimiters.js';

const couponRouter = express.Router();

// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Seul appelant
// vivant pour ces 5 routes : pages/admin/Coupons.jsx, sous
// SuperAdminLayout (staffToken). pages/seller/CouponManager.jsx (l'autre
// appelant historique) n'est routé nulle part dans App.jsx (mort).
// catalog.coupons est la permission déjà réservée aux coupons dans
// seedRolePermissions.js (bloc catalog_admin), au même titre que
// catalog.banners et catalog.categories pour leurs modules respectifs.
couponRouter.get('/admin-list', authStaff, requirePermission('catalog.coupons'), getAllCoupons);
couponRouter.post('/add', authStaff, requirePermission('catalog.coupons'), addCoupon);
couponRouter.post('/update', authStaff, requirePermission('catalog.coupons'), updateCoupon);
couponRouter.post('/delete', authStaff, requirePermission('catalog.coupons'), deleteCoupon);
couponRouter.post('/toggle', authStaff, requirePermission('catalog.coupons'), toggleCouponStatus);

// Routes commerçant (scopées à sa propre boutique)
couponRouter.get('/mes-coupons', authStaff, requireRole('commercant'), getMesCoupons);
couponRouter.post('/mes-coupons/add', authStaff, requireRole('commercant'), requireBoutiqueActive, addMonCoupon);
couponRouter.post('/mes-coupons/update', authStaff, requireRole('commercant'), requireBoutiqueActive, updateMonCoupon);
couponRouter.post('/mes-coupons/delete', authStaff, requireRole('commercant'), requireBoutiqueActive, deleteMonCoupon);
couponRouter.post('/mes-coupons/toggle', authStaff, requireRole('commercant'), requireBoutiqueActive, toggleMonCouponStatus);

// Routes client
couponRouter.post('/validate', authUser, couponLimiter, validateCoupon);
couponRouter.post('/apply', authUser, couponLimiter, applyCoupon);

export default couponRouter;