import express from 'express';
import { upload } from '../configs/multer.js';
import authSeller from '../middlewares/authSeller.js';
import { 
    addProduct, 
    addProductImages,
    addImages,
    addVideo,
    deleteVideo,
    changeStock, 
    productList, 
    productById, 
    updateProduct, 
    deleteProduct, 
    getBestSellers, 
    getVariantDetails 
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

// ==================== ROUTES PRINCIPALES ====================

// ✅ Ajouter un produit (avec images et vidéo)
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

// ==================== GESTION DES IMAGES ====================

// ✅ Ajouter des images à un produit existant
productRouter.post('/add-images', authSeller, upload.array("images", 10), addImages);

// ==================== GESTION DE LA VIDÉO ====================

// ✅ Ajouter une vidéo à un produit existant
productRouter.post('/add-video', authSeller, (req, res, next) => {
    upload.fields([
        { name: 'video', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }
        next();
    });
}, addVideo);

// ✅ Supprimer la vidéo d'un produit
productRouter.post('/delete-video', authSeller, deleteVideo);

// ==================== ROUTES DE LISTE ET RECHERCHE ====================

// ✅ Liste des produits (avec pagination et tri)
// Utilisation: /api/product/list?sort=salesCount&page=1&limit=12
productRouter.get('/list', productList);

// ✅ Best-sellers (utile pour la page d'accueil)
productRouter.get('/bestsellers', getBestSellers);

// ==================== ROUTES CRUD ====================

// ✅ Récupérer un produit par son ID
productRouter.get('/id', productById);

// ✅ Modifier le stock d'un produit
productRouter.post('/stock', authSeller, changeStock);

// ✅ Mettre à jour un produit
productRouter.post('/update', authSeller, updateProduct);

// ✅ Supprimer un produit (avec suppression de la vidéo)
productRouter.post('/delete', authSeller, deleteProduct);

// ✅ Récupérer les détails d'une variante
productRouter.post('/variant', getVariantDetails);

export default productRouter;