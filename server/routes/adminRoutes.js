import express from 'express';
import { upload } from '../configs/multer.js';
import authStaff from '../middlewares/authStaff.js';
import { requirePermission, requireAnyPermission } from '../middlewares/permission.js';
import requireBoutiqueActive from '../middlewares/requireBoutiqueActive.js';
import requireDroitCreation from '../middlewares/requireDroitCreation.js';
import cacheControl from '../middlewares/cacheControl.js';
import { valider } from '../middlewares/valider.js';
import { schemaStock, schemaAffectationBoutique, schemaStatutBoutique, schemaAutorisationsBoutique } from '../schemas/index.js';
import { publicCatalogLimiter } from '../middlewares/rateLimiters.js';

// ─── Contrôleurs ──────────────────────────────────────────────────────────

// Produits
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

// Commandes
import {
    getAllOrders,
    getUserOrders,
    placeOrderCOD,
    cancelOrder,
    updateOrderStatus,
    getUserOrdersByAdmin,
    assignerLivreur,
    getLivraisonsLivreur,
    updateLivraisonStatus,
    getCollectesLivreur,
    reserverCollecte,
    collecterArticle,
    terminerCollecte,
    reserverCollecteLivreur,
    collecterArticleLivreur,
    terminerCollecteLivreur,
    sellerMarkShipped,
    getMesVentesCommercant,
    confirmerCommandeCommercant,
    confirmerDisponibiliteCommercant,
    listCommandesAValider,
    confirmerCommandeAdmin,
    declarerLitige,
    resoudreLitige,
    listLitiges,
    confirmerRemiseLivreur,
    listCommandesARemettre,
    rechercherCommandeAdmin
} from '../controllers/orderController.js';

// Bannières
import {
    getBanners,
    getAllBanners,
    addBanner,
    updateBanner,
    deleteBanner
} from '../controllers/bannerController.js';

// Catégories
import {
    getCategories,
    getAllCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus
} from '../controllers/categoryController.js';

// Coupons
import {
    getAllCoupons,
    addCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,
    validateCoupon,
    applyCoupon,
    getMesCoupons,
    addMonCoupon,
    updateMonCoupon,
    deleteMonCoupon,
    toggleMonCouponStatus
} from '../controllers/couponController.js';

// Wallet
import {
    getMyWallet,
    getMyTransactions,
    getWalletByCommercial,
    adminAjustement
} from '../controllers/walletController.js';

// Retraits
import {
    createRetrait,
    getMesRetraits,
    listOperateurs,
    listAllRetraits,
    traiterRetrait
} from '../controllers/retraitController.js';

// Localisations
import {
    getCities,
    getAllCities,
    addCity,
    updateCity,
    deleteCity,
    getCommunesByCity,
    getAllCommunes,
    addCommune,
    updateCommune,
    deleteCommune
} from '../controllers/locationController.js';

// Livraisons
import {
    getAllDeliveryTypes,
    getActiveDeliveryTypes,
    addDeliveryType,
    updateDeliveryType,
    deleteDeliveryType,
    getAllDeliveryPrices,
    getDeliveryPrice,
    addDeliveryPrice,
    addBulkDeliveryPrices,
    updateDeliveryPrice,
    deleteDeliveryPrice
} from '../controllers/deliveryController.js';

// Settings
import {
    getSetting,
    updateSetting,
    getAllSettings
} from '../controllers/settingController.js';

// Clients
import { getAllClients } from '../controllers/userController.js';

// Boutiques
import {
    getMaBoutique,
    updateMaBoutique,
    updateMesZonesLivraison,
    getBoutiqueById,
    listAllBoutiques,
    createBoutiqueForCommercial,
    updateBoutiqueStatut,
    listBoutiqueOptions,
    getBoutiqueApercu,
    updateAutorisationsBoutique
} from '../controllers/boutiqueController.js';

// Approbations
import {
    listApprovals,
    approuverApproval,
    rejeterApproval
} from '../controllers/approvalController.js';

// Staff
import {
    createInvitation,
    listInvitations,
    activateAccount,
    staffLogin,
    isStaffAuth,
    staffLogout,
    listStaffAccounts,
    updateStaffStatus,
    updateStaffRole,
    getSuppressionApercu,
    deleteStaffAccount
} from '../controllers/staffController.js';

// Journal
import { listJournal, listBoutiquesJournal } from '../controllers/journalController.js';

// =============================================================
// ROUTEUR ADMIN UNIFIÉ
// =============================================================

const adminRouter = express.Router();

// ─── Toutes les routes admin sont protégées par authStaff ──────

// =============================================================
// 1. TABLEAU DE BORD
// =============================================================

adminRouter.get(
    '/dashboard/stats',
    authStaff,
    requirePermission('admin.dashboard'),
    async (req, res) => {
        try {
            const Order = await import('../models/Order.js').then(m => m.default);
            const Product = await import('../models/Product.js').then(m => m.default);
            const User = await import('../models/User.js').then(m => m.default);
            const Wallet = await import('../models/Wallet.js').then(m => m.default);
            const DemandeRetrait = await import('../models/DemandeRetrait.js').then(m => m.default);
            const ApprovalRequest = await import('../models/ApprovalRequest.js').then(m => m.default);
            const CustomerCreditTransaction = await import('../models/CustomerCreditTransaction.js').then(m => m.default);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Commandes
            const orders = await Order.find({ status: { $ne: 'pending_payment' } });
            const ordersToday = orders.filter(o => new Date(o.createdAt) >= today);
            const ordersPending = orders.filter(o => ['Order Placed', 'Checking Availability', 'Confirmed'].includes(o.status));
            const ordersDelivered = orders.filter(o => o.status === 'Delivered');
            const ordersReturned = orders.filter(o => o.status === 'Returned');
            const ordersCancelled = orders.filter(o => o.status === 'Cancelled');
            const ordersDisputed = orders.filter(o => o.status === 'Disputed');

            // Livraisons — dérivées du statut de la commande : "en attente"
            // (prête à partir mais pas encore prise en charge par un livreur)
            // vs "en cours" (effectivement en route chez le client).
            const deliveriesPending = orders.filter(o => ['Ready for Shipment', 'Shipped'].includes(o.status));
            const deliveriesInProgress = orders.filter(o => o.status === 'Out for Delivery');

            // Produits
            const products = await Product.find({ isArchived: { $ne: true } });
            const outOfStock = products.filter(p => {
                if (p.variants?.length > 0) return p.variants.every(v => v.stock === 0);
                return p.stock === 0;
            });
            const lowStock = products.filter(p => {
                if (p.variants?.length > 0) return p.variants.some(v => v.stock > 0 && v.stock <= 5);
                return p.stock > 0 && p.stock <= 5;
            });

            // Utilisateurs
            const totalUsers = await User.countDocuments();
            const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });

            // Finance
            const wallets = await Wallet.find({});
            const totalBalance = wallets.reduce((sum, w) => sum + (w.solde || 0), 0);
            const pendingBalance = wallets.reduce((sum, w) => sum + (w.soldeEnAttente || 0), 0);
            const pendingWithdrawals = await DemandeRetrait.countDocuments({ statut: 'en_attente' });
            const revenue = ordersDelivered.reduce((sum, o) => sum + (o.amount || 0), 0);
            const totalWithdrawalsAgg = await DemandeRetrait.aggregate([
                { $match: { statut: 'payee' } },
                { $group: { _id: null, total: { $sum: '$montant' } } },
            ]);
            const totalWithdrawals = totalWithdrawalsAgg[0]?.total || 0;

            // RCOINS (solde crédité aux clients + volume de transactions)
            const rcoinsBalanceAgg = await User.aggregate([
                { $group: { _id: null, total: { $sum: { $ifNull: ['$creditBalance', 0] } } } },
            ]);
            const rcoinsTotalBalance = rcoinsBalanceAgg[0]?.total || 0;
            const rcoinsTransactions = await CustomerCreditTransaction.countDocuments();

            // Approbations
            const pendingApprovals = await ApprovalRequest.countDocuments({ statut: 'en_attente' });

            res.json({
                success: true,
                stats: {
                    orders: {
                        total: orders.length,
                        today: ordersToday.length,
                        pending: ordersPending.length,
                        delivered: ordersDelivered.length,
                        returned: ordersReturned.length,
                        cancelled: ordersCancelled.length,
                        disputed: ordersDisputed.length,
                    },
                    products: {
                        total: products.length,
                        outOfStock: outOfStock.length,
                        lowStock: lowStock.length,
                    },
                    users: {
                        total: totalUsers,
                        newToday: newUsersToday,
                    },
                    deliveries: {
                        pending: deliveriesPending.length,
                        inProgress: deliveriesInProgress.length,
                    },
                    finance: {
                        totalBalance,
                        pendingBalance,
                        pendingWithdrawals,
                        revenue,
                        totalWithdrawals,
                    },
                    rcoins: {
                        totalBalance: rcoinsTotalBalance,
                        transactions: rcoinsTransactions,
                    },
                    approvals: {
                        pending: pendingApprovals,
                    },
                }
            });
        } catch (error) {
            console.error('Erreur dashboard stats:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }
);

// =============================================================
// 2. CATALOGUE
// =============================================================

// Routes publiques (sans auth)
adminRouter.get('/catalogue', cacheControl(60), publicCatalogLimiter, productCatalogue);
adminRouter.get('/products/list', cacheControl(60), publicCatalogLimiter, productList);
adminRouter.get('/products/bestsellers', cacheControl(120), publicCatalogLimiter, getBestSellers);
adminRouter.get('/products/id', cacheControl(60), publicCatalogLimiter, productById);
adminRouter.post('/products/variant', publicCatalogLimiter, getVariantDetails);
adminRouter.post('/products/check-availability', publicCatalogLimiter, checkAvailability);

// Code article (génération)
adminRouter.get('/products/generate-sku', authStaff, requirePermission('catalog.create'), genererCodeArticle);

// Gestion des produits
adminRouter.get(
    '/products',
    authStaff,
    requireAnyPermission(['catalog.view', 'products.view_own']),
    adminProductList
);

adminRouter.post(
    '/products/add',
    authStaff,
    requirePermission('catalog.create'),
    requireDroitCreation,
    (req, res, next) => {
        upload.fields([
            { name: 'images', maxCount: 10 },
            { name: 'video', maxCount: 1 }
        ])(req, res, (err) => {
            if (err) return next(err);
            next();
        });
    },
    addProduct
);

adminRouter.post(
    '/products/add-images',
    authStaff,
    requirePermission('catalog.edit'),
    requireBoutiqueActive,
    upload.array('images', 10),
    addProductImages
);

adminRouter.post(
    '/products/update',
    authStaff,
    requirePermission('catalog.edit'),
    requireBoutiqueActive,
    updateProduct
);

adminRouter.post(
    '/products/stock',
    authStaff,
    requireAnyPermission(['catalog.edit', 'products.edit_own']),
    requireBoutiqueActive,
    valider(schemaStock),
    changeStockCommercant
);

adminRouter.post(
    '/products/delete',
    authStaff,
    requirePermission('catalog.delete'),
    requireBoutiqueActive,
    deleteProduct
);

adminRouter.post(
    '/products/unarchive',
    authStaff,
    requirePermission('catalog.edit'),
    requireBoutiqueActive,
    unarchiveProduct
);

adminRouter.post(
    '/products/assign-boutique',
    authStaff,
    requirePermission('catalog.edit'),
    valider(schemaAffectationBoutique),
    assignerBoutique
);

adminRouter.post(
    '/products/scrape-import',
    authStaff,
    requirePermission('catalog.create'),
    scrapeImport
);

adminRouter.post(
    '/products/sync-airtable',
    authStaff,
    requirePermission('catalog.edit'),
    syncAirtable
);

// Bannières
adminRouter.get(
    '/banners',
    authStaff,
    requirePermission('catalog.banners'),
    getAllBanners
);

adminRouter.post(
    '/banners/add',
    authStaff,
    requirePermission('catalog.banners'),
    upload.single('image'),
    addBanner
);

adminRouter.post(
    '/banners/update',
    authStaff,
    requirePermission('catalog.banners'),
    upload.single('image'),
    updateBanner
);

adminRouter.post(
    '/banners/delete',
    authStaff,
    requirePermission('catalog.banners'),
    deleteBanner
);

// Catégories
adminRouter.get(
    '/categories',
    authStaff,
    requirePermission('catalog.categories'),
    getAllCategories
);

adminRouter.post(
    '/categories/add',
    authStaff,
    requirePermission('catalog.categories'),
    upload.single('image'),
    addCategory
);

adminRouter.post(
    '/categories/update',
    authStaff,
    requirePermission('catalog.categories'),
    upload.single('image'),
    updateCategory
);

adminRouter.post(
    '/categories/delete',
    authStaff,
    requirePermission('catalog.categories'),
    deleteCategory
);

adminRouter.post(
    '/categories/toggle',
    authStaff,
    requirePermission('catalog.categories'),
    toggleCategoryStatus
);

// Coupons
adminRouter.get(
    '/coupons',
    authStaff,
    requirePermission('catalog.coupons'),
    getAllCoupons
);

adminRouter.post(
    '/coupons/add',
    authStaff,
    requirePermission('catalog.coupons'),
    addCoupon
);

adminRouter.post(
    '/coupons/update',
    authStaff,
    requirePermission('catalog.coupons'),
    updateCoupon
);

adminRouter.post(
    '/coupons/delete',
    authStaff,
    requirePermission('catalog.coupons'),
    deleteCoupon
);

adminRouter.post(
    '/coupons/toggle',
    authStaff,
    requirePermission('catalog.coupons'),
    toggleCouponStatus
);

// =============================================================
// 3. COMMANDES & OPÉRATIONS
// =============================================================

adminRouter.get(
    '/orders',
    authStaff,
    requireAnyPermission(['orders.view', 'orders.view_own']),
    getAllOrders
);

adminRouter.post(
    '/orders/status',
    authStaff,
    requirePermission('orders.edit'),
    updateOrderStatus
);

adminRouter.get(
    '/orders/admin/a-valider',
    authStaff,
    requirePermission('orders.approve'),
    listCommandesAValider
);

adminRouter.post(
    '/orders/admin/confirmer',
    authStaff,
    requirePermission('orders.approve'),
    confirmerCommandeAdmin
);

adminRouter.get(
    '/orders/admin/litiges',
    authStaff,
    requirePermission('orders.disputes'),
    listLitiges
);

adminRouter.post(
    '/orders/admin/litige/declarer',
    authStaff,
    requirePermission('orders.disputes'),
    declarerLitige
);

adminRouter.post(
    '/orders/admin/litige/resoudre',
    authStaff,
    requirePermission('orders.disputes'),
    resoudreLitige
);

adminRouter.get(
    '/orders/admin/recherche',
    authStaff,
    requirePermission('orders.view'),
    rechercherCommandeAdmin
);

adminRouter.get(
    '/orders/admin/user/:userId',
    authStaff,
    requirePermission('orders.view'),
    getUserOrdersByAdmin
);

adminRouter.get(
    '/orders/commercant/mes-ventes',
    authStaff,
    requirePermission('orders.view_own'),
    getMesVentesCommercant
);

adminRouter.post(
    '/orders/commercant/confirmer',
    authStaff,
    requirePermission('orders.confirm'),
    requireBoutiqueActive,
    confirmerCommandeCommercant
);

adminRouter.post(
    '/orders/commercant/disponibilite',
    authStaff,
    requirePermission('orders.confirm'),
    requireBoutiqueActive,
    confirmerDisponibiliteCommercant
);

adminRouter.post(
    '/orders/admin/assigner-livreur',
    authStaff,
    requirePermission('deliveries.assign'),
    assignerLivreur
);

adminRouter.get(
    '/orders/seller/a-remettre',
    authStaff,
    requirePermission('orders.edit'),
    listCommandesARemettre
);

adminRouter.post(
    '/orders/seller/remettre-livreur',
    authStaff,
    requirePermission('orders.edit'),
    confirmerRemiseLivreur
);

adminRouter.post(
    '/orders/seller/mark-shipped',
    authStaff,
    requirePermission('orders.edit'),
    sellerMarkShipped
);

// =============================================================
// 4. RÉSEAU (Clients, Commerçants, Boutiques)
// =============================================================

// Clients
adminRouter.get(
    '/clients',
    authStaff,
    requirePermission('clients.view'),
    getAllClients
);

// Boutiques
adminRouter.get(
    '/boutiques',
    authStaff,
    requirePermission('clients.view'),
    listAllBoutiques
);

adminRouter.get(
    '/boutiques/options',
    authStaff,
    requirePermission('clients.view'),
    listBoutiqueOptions
);

adminRouter.post(
    '/boutiques',
    authStaff,
    requirePermission('clients.edit'),
    createBoutiqueForCommercial
);

adminRouter.patch(
    '/boutiques/:id/statut',
    authStaff,
    requirePermission('clients.edit'),
    valider(schemaStatutBoutique),
    updateBoutiqueStatut
);

adminRouter.patch(
    '/boutiques/:id/autorisations',
    authStaff,
    requirePermission('clients.edit'),
    valider(schemaAutorisationsBoutique),
    updateAutorisationsBoutique
);

// Comptes staff
adminRouter.get(
    '/staff/comptes',
    authStaff,
    requirePermission('admin.roles'),
    listStaffAccounts
);

adminRouter.post(
    '/staff/invitations',
    authStaff,
    requirePermission('admin.roles'),
    createInvitation
);

adminRouter.get(
    '/staff/invitations',
    authStaff,
    requirePermission('admin.roles'),
    listInvitations
);

adminRouter.patch(
    '/staff/comptes/:id/statut',
    authStaff,
    requirePermission('admin.roles'),
    updateStaffStatus
);

adminRouter.patch(
    '/staff/comptes/:id/role',
    authStaff,
    requirePermission('admin.roles'),
    updateStaffRole
);

adminRouter.get(
    '/staff/comptes/:id/suppression',
    authStaff,
    requirePermission('admin.roles'),
    getSuppressionApercu
);

adminRouter.delete(
    '/staff/comptes/:id',
    authStaff,
    requirePermission('admin.roles'),
    deleteStaffAccount
);

// =============================================================
// 5. LOGISTIQUE (Livraisons, Zones)
// =============================================================

adminRouter.get(
    '/delivery/types',
    authStaff,
    requirePermission('deliveries.view'),
    getAllDeliveryTypes
);

adminRouter.post(
    '/delivery/type/add',
    authStaff,
    requirePermission('deliveries.configure'),
    addDeliveryType
);

adminRouter.post(
    '/delivery/type/update',
    authStaff,
    requirePermission('deliveries.configure'),
    updateDeliveryType
);

adminRouter.post(
    '/delivery/type/delete',
    authStaff,
    requirePermission('deliveries.configure'),
    deleteDeliveryType
);

adminRouter.get(
    '/delivery/prices',
    authStaff,
    requirePermission('deliveries.configure'),
    getAllDeliveryPrices
);

adminRouter.post(
    '/delivery/price/add',
    authStaff,
    requirePermission('deliveries.configure'),
    addDeliveryPrice
);

adminRouter.post(
    '/delivery/price/bulk',
    authStaff,
    requirePermission('deliveries.configure'),
    addBulkDeliveryPrices
);

adminRouter.post(
    '/delivery/price/update',
    authStaff,
    requirePermission('deliveries.configure'),
    updateDeliveryPrice
);

adminRouter.post(
    '/delivery/price/delete',
    authStaff,
    requirePermission('deliveries.configure'),
    deleteDeliveryPrice
);

// Localisations
adminRouter.get(
    '/locations/cities',
    authStaff,
    requirePermission('deliveries.configure'),
    getAllCities
);

adminRouter.post(
    '/locations/city/add',
    authStaff,
    requirePermission('deliveries.configure'),
    addCity
);

adminRouter.post(
    '/locations/city/update',
    authStaff,
    requirePermission('deliveries.configure'),
    updateCity
);

adminRouter.post(
    '/locations/city/delete',
    authStaff,
    requirePermission('deliveries.configure'),
    deleteCity
);

adminRouter.get(
    '/locations/communes',
    authStaff,
    requirePermission('deliveries.configure'),
    getAllCommunes
);

adminRouter.post(
    '/locations/commune/add',
    authStaff,
    requirePermission('deliveries.configure'),
    addCommune
);

adminRouter.post(
    '/locations/commune/update',
    authStaff,
    requirePermission('deliveries.configure'),
    updateCommune
);

adminRouter.post(
    '/locations/commune/delete',
    authStaff,
    requirePermission('deliveries.configure'),
    deleteCommune
);

// =============================================================
// 6. FINANCE
// =============================================================

// Wallet
adminRouter.get(
    '/wallet/admin/:commercialId',
    authStaff,
    requirePermission('wallet.view'),
    getWalletByCommercial
);

adminRouter.post(
    '/wallet/admin/ajustement',
    authStaff,
    requirePermission('wallet.adjust'),
    adminAjustement
);

// Retraits
adminRouter.get(
    '/retraits',
    authStaff,
    requireAnyPermission(['withdrawals.view', 'wallet.view']),
    listAllRetraits
);

adminRouter.patch(
    '/retraits/:id',
    authStaff,
    requireAnyPermission(['withdrawals.approve', 'wallet.adjust']),
    traiterRetrait
);

// Approbations
adminRouter.get(
    '/approvals',
    authStaff,
    requirePermission('wallet.view'),
    listApprovals
);

adminRouter.post(
    '/approvals/:id/approuver',
    authStaff,
    requirePermission('wallet.adjust'),
    approuverApproval
);

adminRouter.post(
    '/approvals/:id/rejeter',
    authStaff,
    requirePermission('wallet.adjust'),
    rejeterApproval
);

// =============================================================
// 7. ADMINISTRATION
// =============================================================

// Paramètres généraux
adminRouter.get(
    '/settings/all',
    authStaff,
    requirePermission('admin.configure'),
    getAllSettings
);

adminRouter.get(
    '/settings/:key',
    authStaff,
    requirePermission('admin.configure'),
    getSetting
);

adminRouter.post(
    '/settings/update',
    authStaff,
    requirePermission('admin.configure'),
    updateSetting
);

// Journal d'audit
adminRouter.get(
    '/audit',
    authStaff,
    requirePermission('audit.view'),
    listJournal
);

adminRouter.get(
    '/audit/boutiques',
    authStaff,
    requirePermission('audit.view'),
    listBoutiquesJournal
);

// =============================================================
// 8. ROUTES PUBLIQUES (sans auth - réexposées)
// =============================================================

// Bannières publiques
adminRouter.get('/banners/public', cacheControl(120), getBanners);
adminRouter.get('/categories/public', cacheControl(300), getCategories);
adminRouter.get('/delivery/types/public', cacheControl(300), getActiveDeliveryTypes);
adminRouter.get('/delivery/price/:communeId/:deliveryTypeId', cacheControl(300), getDeliveryPrice);
adminRouter.get('/locations/cities/public', getCities);
adminRouter.get('/locations/communes/:cityId', getCommunesByCity);
adminRouter.get('/boutiques/:id/apercu', getBoutiqueApercu);
adminRouter.get('/boutiques/:id', getBoutiqueById);

export default adminRouter;