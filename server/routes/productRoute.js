import express from 'express';
import { upload } from '../configs/multer.js';
import authSeller from '../middlewares/authSeller.js';
import { 
    addProduct, 
    addProductImages, 
    changeStock, 
    productList, 
    productById, 
    updateProduct, 
    deleteProduct, 
    getBestSellers, 
    getVariantDetails,
    scrapeImport
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

// ✅ ROUTE AVEC GESTION D'ERREUR
productRouter.post('/add', authSeller, (req, res, next) => {
    upload.fields([
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }
        next();
    });
}, addProduct);

productRouter.post('/add-images', authSeller, upload.array("images", 10), addProductImages);

// ✅ ROUTE DE LISTE AVEC TRI PAR salesCount
// Utilisation: /api/product/list?sort=salesCount&page=1&limit=12
productRouter.get('/list', productList);

// ✅ ROUTE POUR LES BEST-SELLERS (utile pour la page d'accueil)
productRouter.get('/bestsellers', getBestSellers);

// ✅ ROUTES SUPPLEMENTAIRES
productRouter.get('/id', productById);
productRouter.post('/stock', authSeller, changeStock);
productRouter.post('/update', authSeller, updateProduct);
productRouter.post('/delete', authSeller, deleteProduct);
productRouter.post('/variant', getVariantDetails);
productRouter.post('/scrape-import', authSeller, scrapeImport);

export default productRouter;