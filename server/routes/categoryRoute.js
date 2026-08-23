import express from 'express';
import { upload } from '../configs/multer.js';
import { getCategories, getAllCategories, addCategory, updateCategory, deleteCategory, toggleCategoryStatus } from '../controllers/categoryController.js';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission } from '../middlewares/permission.js';
import cacheControl from '../middlewares/cacheControl.js';

const categoryRouter = express.Router();

// [PHASE 0 - PERF] Les catégories changent rarement : TTL plus long.
categoryRouter.get('/list', cacheControl(300), getCategories);

// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Seul appelant
// vivant pour ces 5 routes : pages/admin/Categories.jsx, sous
// SuperAdminLayout (staffToken). pages/seller/CategoryManager.jsx (l'autre
// appelant historique) n'est routé nulle part dans App.jsx (mort). Les
// autres consommateurs de /api/category/* (Home, Navbar, AllCategories,
// pages commerçant...) n'appellent que /list, public et inchangé.
categoryRouter.get('/admin-list', authStaff, requirePermission('catalog.categories'), getAllCategories);
categoryRouter.post('/add', authStaff, requirePermission('catalog.categories'), upload.single('image'), addCategory);
categoryRouter.post('/update', authStaff, requirePermission('catalog.categories'), upload.single('image'), updateCategory);
categoryRouter.post('/delete', authStaff, requirePermission('catalog.categories'), deleteCategory);
categoryRouter.post('/toggle-status', authStaff, requirePermission('catalog.categories'), toggleCategoryStatus);

export default categoryRouter;