import express from 'express';
import { upload } from '../configs/multer.js';
import { getBanners, getAllBanners, addBanner, updateBanner, deleteBanner } from '../controllers/bannerController.js';
import authSeller from '../middlewares/authSeller.js';

const bannerRouter = express.Router();

bannerRouter.get('/list', getBanners);
bannerRouter.get('/admin-list', authSeller, getAllBanners);
bannerRouter.post('/add', authSeller, upload.single('image'), addBanner);
bannerRouter.post('/update', authSeller, upload.single('image'), updateBanner);
bannerRouter.post('/delete', authSeller, deleteBanner);

export default bannerRouter;