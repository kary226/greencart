import express from 'express';
import { upload } from '../configs/multer.js';
import { getCategories, getAllCategories, addCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import authSeller from '../middlewares/authSeller.js';

const categoryRouter = express.Router();

categoryRouter.get('/list', getCategories);
categoryRouter.get('/admin-list', authSeller, getAllCategories);
categoryRouter.post('/add', authSeller, upload.single('image'), addCategory);
categoryRouter.post('/update', authSeller, upload.single('image'), updateCategory);
categoryRouter.post('/delete', authSeller, deleteCategory);

export default categoryRouter;