import express from 'express';
import { upload } from '../configs/multer.js';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission, requireAnyPermission } from '../middlewares/permission.js';
import requireBoutiqueActive from '../middlewares/requireBoutiqueActive.js';
import requireDroitCreation from '../middlewares/requireDroitCreation.js';
import attachStaffOptionnel from '../middlewares/attachStaffOptionnel.js';
import { valider } from '../middlewares/valider.js';
import { schemaStock, schemaAffectationBoutique } from '../schemas/index.js';
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
    checkAvailability,
    changeStockCommercant,
    assignerBoutique,
    productCatalogue
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
// Catalogue complet allégé : source de vérité de l'état global du client
// (panier, fiche produit, recherche). Voir le commentaire du contrôleur.
productRouter.get('/catalogue', cacheControl(60), publicCatalogLimiter, productCatalogue);
productRouter.get('/bestsellers', cacheControl(120), publicCatalogLimiter, getBestSellers);
productRouter.get('/id', cacheControl(60), publicCatalogLimiter, productById);
productRouter.post('/variant', publicCatalogLimiter, getVariantDetails);
productRouter.post('/check-availability', publicCatalogLimiter, checkAvailability);

// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Seuls appelants
// vivants pour ce bloc de 10 routes : pages/admin/Products.jsx et
// pages/seller/AddProduct.jsx (cette dernière montée sous
// /admin/products/add et /admin/products/edit/:id dans SuperAdminLayout),
// toutes deux authentifiées via staffToken. pages/seller/ProductList.jsx,
// pages/seller/BannerManager.jsx et pages/seller/Dashboard.jsx (les autres
// appelants historiques de /admin-list, /sync-airtable, /assign-boutique,
// /update, /add-images) ne sont routés nulle part dans App.jsx (morts).
//
// server/routes/adminRoutes.js expose déjà un jeu de routes RBAC
// équivalentes sous /api/admin/products/* (mêmes contrôleurs pour la
// plupart), construites lors d'un chantier antérieur mais jamais
// consommées par le frontend (aucun appel /api/admin/products dans
// client/src). Les permissions ci-dessous reprennent celles déjà en usage
// sur ce jeu de routes jumeau pour ne pas introduire une troisième
// convention de nommage.
//
// scrape-import et /stock ne servent que le back-office (adminProductList,
// non le flux commerçant) : catalog.* suffit, sans requireBoutiqueActive
// (qui ne s'applique de toute façon qu'au rôle commercant, absent de ces
// pages).
productRouter.get('/generate-sku', authStaff, requirePermission('catalog.create'), genererCodeArticle);
// Générer un SKU est une étape de CRÉATION d'article, pas une
// consultation : même droit que son jumeau ci-dessus. Avec catalog.view,
// l'Auditeur — qui a le droit de tout lire — y accédait.
productRouter.get('/staff/generate-sku', authStaff, requirePermission('catalog.create'), genererCodeArticle);

productRouter.post('/add', authStaff, requirePermission('catalog.create'), requireDroitCreation, (req, res, next) => {
    upload.fields([
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) return handleMulterError(err, req, res, next);
        next();
    });
}, addProduct);

productRouter.post('/add-images', authStaff, requirePermission('catalog.edit'), upload.array("images", 10), addProductImages);
productRouter.post('/stock', authStaff, requirePermission('catalog.edit'), changeStock);
productRouter.post('/update', authStaff, requirePermission('catalog.edit'), updateProduct);
productRouter.post('/delete', authStaff, requirePermission('catalog.delete'), deleteProduct);
productRouter.post('/unarchive', authStaff, requirePermission('catalog.edit'), unarchiveProduct);
productRouter.get('/admin-list', authStaff, requirePermission('catalog.view'), adminProductList);
productRouter.post('/scrape-import', authStaff, requirePermission('catalog.create'), scrapeImport);
// Attribution d'un article existant à une boutique (ou retour au catalogue
// principal). Réservé à l'admin : c'est lui qui décide de qui dépend un
// article, pas le commerçant qui le reçoit.
productRouter.post('/assign-boutique', authStaff, requirePermission('catalog.edit'), valider(schemaAffectationBoutique), assignerBoutique);
productRouter.post('/sync-airtable', authStaff, requirePermission('catalog.edit'), syncAirtable);

// Routes staff : dans le nouveau modèle, le Commerçant ne crée, ne modifie,
// ne supprime et ne publie plus aucun produit. Seul le Seller/Admin gère le
// catalogue. Le Commerçant conserve uniquement la gestion de son stock et la
// consultation de ses articles.
productRouter.post('/staff/update', authStaff, requirePermission('catalog.edit'), requireBoutiqueActive, updateProduct);
productRouter.post('/staff/delete', authStaff, requirePermission('catalog.delete'), requireBoutiqueActive, deleteProduct);
productRouter.post('/staff/unarchive', authStaff, requirePermission('catalog.edit'), requireBoutiqueActive, unarchiveProduct);
// Route partagée : le Super Admin et le Catalogue y voient tout le
// catalogue, le Commerçant sa propre boutique (le filtrage se fait dans
// le contrôleur). 'shop.view' est la permission du Commerçant.
productRouter.get('/staff/admin-list', authStaff, requireAnyPermission(['catalog.view', 'shop.view']), adminProductList);
productRouter.post('/staff/add-images', authStaff, requirePermission('catalog.edit'), requireBoutiqueActive, upload.array('images', 10), addProductImages);
productRouter.post('/staff/sync-airtable', authStaff, requirePermission('catalog.create'), syncAirtable);
// Le Commerçant peut uniquement ajuster les quantités de produits déjà créés
// par le Seller/Admin.
// [RAMCI §16] Ces routes listaient le rôle historique `admin` SANS
// `super_admin`. Migrer le compte principal vers super_admin — ce que le
// guide recommande — lui aurait donc fait perdre ces écrans du jour au
// lendemain. Elles vérifient désormais une permission : le Super Admin
// passe par admin.all, l'Assistant SHEIN par ses propres droits.
productRouter.post('/staff/stock', authStaff, requireAnyPermission(['products.edit', 'catalog.edit', 'admin.all']), requireBoutiqueActive, valider(schemaStock), changeStockCommercant);
productRouter.post('/staff/assign-boutique', authStaff, requirePermission('catalog.edit'), valider(schemaAffectationBoutique), assignerBoutique);

export default productRouter;