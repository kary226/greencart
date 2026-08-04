import express from 'express';
import { upload } from '../configs/multer.js';
import { getBanners, getAllBanners, addBanner, updateBanner, deleteBanner } from '../controllers/bannerController.js';
import authSeller from '../middlewares/authSeller.js';
import cacheControl from '../middlewares/cacheControl.js';

const bannerRouter = express.Router();

// [PHASE 0 - PERF] Bannières identiques pour tous les visiteurs.
bannerRouter.get('/list', cacheControl(120), getBanners);
bannerRouter.get('/admin-list', authSeller, getAllBanners);
bannerRouter.post('/add', authSeller, upload.single('image'), addBanner);
bannerRouter.post('/update', authSeller, upload.single('image'), updateBanner);
bannerRouter.post('/delete', authSeller, deleteBanner);

export default bannerRouter;