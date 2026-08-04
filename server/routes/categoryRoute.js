import express from 'express';
import { upload } from '../configs/multer.js';
import { getCategories, getAllCategories, addCategory, updateCategory, deleteCategory, toggleCategoryStatus } from '../controllers/categoryController.js';
import authSeller from '../middlewares/authSeller.js';
import cacheControl from '../middlewares/cacheControl.js';

const categoryRouter = express.Router();

// [PHASE 0 - PERF] Les catégories changent rarement : TTL plus long.
categoryRouter.get('/list', cacheControl(300), getCategories);
categoryRouter.get('/admin-list', authSeller, getAllCategories);
categoryRouter.post('/add', authSeller, upload.single('image'), addCategory);
categoryRouter.post('/update', authSeller, upload.single('image'), updateCategory);
categoryRouter.post('/delete', authSeller, deleteCategory);
categoryRouter.post('/toggle-status', authSeller, toggleCategoryStatus);

export default categoryRouter;