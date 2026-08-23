import express from 'express';
import { upload } from '../configs/multer.js';
import { getBanners, getAllBanners, addBanner, updateBanner, deleteBanner } from '../controllers/bannerController.js';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission } from '../middlewares/permission.js';
import cacheControl from '../middlewares/cacheControl.js';

const bannerRouter = express.Router();

// [PHASE 0 - PERF] Bannières identiques pour tous les visiteurs.
bannerRouter.get('/list', cacheControl(120), getBanners);

// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Seul appelant
// vivant pour ces 4 routes : pages/admin/Banners.jsx, sous
// SuperAdminLayout (staffToken). pages/seller/BannerManager.jsx (l'autre
// appelant historique) n'est routé nulle part dans App.jsx (mort).
// catalog.banners est la permission déjà utilisée pour ce module dans
// adminRoutes.js.
bannerRouter.get('/admin-list', authStaff, requirePermission('catalog.banners'), getAllBanners);
bannerRouter.post('/add', authStaff, requirePermission('catalog.banners'), upload.single('image'), addBanner);
bannerRouter.post('/update', authStaff, requirePermission('catalog.banners'), upload.single('image'), updateBanner);
bannerRouter.post('/delete', authStaff, requirePermission('catalog.banners'), deleteBanner);

export default bannerRouter;