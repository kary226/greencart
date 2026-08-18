import express from 'express';
import { upload } from '../configs/multer.js';
import authSeller from '../middlewares/authSeller.js';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import requireBoutiqueActive from '../middlewares/requireBoutiqueActive.js';
import attachStaffOptionnel from '../middlewares/attachStaffOptionnel.js';
import cacheControl from '../middlewares/cacheControl.js';
import { publicCatalogLimiter } from '../middlewares/rateLimiters.js';
import { 
    addProduct, 
    addProductImages, 
    changeStock, 
    productList, 
    productById, 
    updateProduct, 
    deleteProduct, 
    unarchiveProduct,
    adminProductList,
    getBestSellers, 
    getVariantDetails,
    scrapeImport,
    genererCodeArticle,
    syncAirtable,
    checkAvailability
} from '../controllers/productController.js';

const productRouter = express.Router();

// ✅ MIDDLEWARE DE GESTION D'ERREUR MULTER
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false, 
                message: `Le fichier "${err.field}" est trop volumineux. Taille max: 150MB` 
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
                success: false, 
                message: `Trop de fichiers pour le champ "${err.field}". Max: ${err.limit}` 
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ 
                success: false, 
                message: `Champ inattendu: "${err.field}". Seuls "images" et "video" sont acceptés.` 
            });
        }
        return res.status(400).json({ 
            success: false, 
            message: `Erreur d'upload: ${err.message}` 
        });
    }
    if (err.message && err.message.includes('Format non autorisé')) {
        return res.status(400).json({ 
            success: false, 
            message: err.message 
        });
    }
    next(err);
};

// ✅ Routes publiques
// [PHASE 0 - PERF] Cache-Control côté edge/navigateur : ces listings sont
// identiques pour tous les visiteurs et ne changent pas seconde par
// seconde, un TTL court suffit à absorber l'essentiel du trafic répété.
productRouter.get('/list', cacheControl(60), publicCatalogLimiter, attachStaffOptionnel, productList);
productRouter.get('/bestsellers', cacheControl(120), publicCatalogLimiter, getBestSellers);
productRouter.get('/id', cacheControl(60), publicCatalogLimiter, productById);
productRouter.post('/variant', publicCatalogLimiter, getVariantDetails);
productRouter.post('/check-availability', publicCatalogLimiter, checkAvailability);

// ✅ Code article : un code libre à la demande, pour le bouton « Générer »
// des formulaires produit. Monté deux fois car les deux espaces (compte
// technique vendeur / staff) passent par des authentifications différentes.
productRouter.get('/generate-sku', authSeller, genererCodeArticle);
productRouter.get('/staff/generate-sku', authStaff, requireRole('admin', 'commercant'), genererCodeArticle);

// ✅ Routes admin SELLER (compte technique existant)
productRouter.post('/add', authSeller, (req, res, next) => {
    upload.fields([
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) return handleMulterError(err, req, res, next);
        next();
    });
}, addProduct);

productRouter.post('/add-images', authSeller, upload.array("images", 10), addProductImages);
productRouter.post('/stock', authSeller, changeStock);
productRouter.post('/update', authSeller, updateProduct);
productRouter.post('/delete', authSeller, deleteProduct);
productRouter.post('/unarchive', authSeller, unarchiveProduct);
productRouter.get('/admin-list', authSeller, adminProductList);
productRouter.post('/scrape-import', authSeller, scrapeImport);
productRouter.post('/sync-airtable', authSeller, syncAirtable);

// ✅ PHASE 3 : Routes pour les commerçants (via authStaff)
productRouter.post('/staff/add', authStaff, requireRole('admin', 'commercant'), requireBoutiqueActive, (req, res, next) => {
    upload.fields([
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) return handleMulterError(err, req, res, next);
        next();
    });
}, addProduct);

productRouter.post('/staff/update', authStaff, requireRole('admin', 'commercant'), requireBoutiqueActive, updateProduct);
productRouter.post('/staff/delete', authStaff, requireRole('admin', 'commercant'), requireBoutiqueActive, deleteProduct);
productRouter.post('/staff/unarchive', authStaff, requireRole('admin', 'commercant'), requireBoutiqueActive, unarchiveProduct);
productRouter.get('/staff/admin-list', authStaff, requireRole('admin', 'commercant'), adminProductList);
productRouter.post('/staff/add-images', authStaff, requireRole('admin', 'commercant'), requireBoutiqueActive, upload.array('images', 10), addProductImages);
productRouter.post('/staff/sync-airtable', authStaff, requireRole('admin', 'commercant'), syncAirtable);

export default productRouter;