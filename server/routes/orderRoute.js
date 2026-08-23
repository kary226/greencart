import express from 'express';
import authUser from '../middlewares/authUser.js';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
import { requirePermission, requireAnyPermission } from '../middlewares/permission.js';
import { orderCreationLimiter, paymentLimiter } from '../middlewares/rateLimiters.js';
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
import { initiateJeko } from '../controllers/jekoController.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

const orderRouter = express.Router();

// Routes client
orderRouter.post('/cod', authUser, orderCreationLimiter, placeOrderCOD);
orderRouter.post('/cancel', authUser, cancelOrder);
orderRouter.get('/user', authUser, getUserOrders);
orderRouter.get('/user/credit', authUser, async (req, res) => {
    try {
        const user = await User.findById(req.body.userId).select('creditBalance');
        return res.json({ success: true, creditBalance: user?.creditBalance || 0 });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
orderRouter.post('/jeko/initiate', authUser, paymentLimiter, initiateJeko);

// Routes admin (seller)
// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] Complète la
// migration : /seller et /admin/user/:userId sont appelées par
// pages/admin/Orders.jsx et pages/admin/Clients.jsx (staffToken,
// SuperAdminLayout). pages/seller/Orders.jsx, pages/seller/ClientsManager.jsx
// et pages/seller/DeliveryManager.jsx (appelants historiques de /seller) ne
// sont routés nulle part dans App.jsx (morts).
//
// Migrées vers authStaff + requirePermission, comme les 9 autres fichiers
// du périmètre — pas vers le pont authActeur (staffToken OU sellerToken)
// utilisé temporairement ici. Ce pont avait été introduit en [FIX] pour
// qu'un vrai compte staff (2FA) puisse changer le statut d'une commande,
// jusque-là réservé au compte technique unique (authSeller/sellerToken).
// Le sujet initial de ce FIX (staff bloqué) est réglé par ce commit lui-même
// (authStaff est maintenant le SEUL chemin) ; quant au compte technique,
// sellerRoute.js (/is-auth) reste son unique usage légitime — il n'est plus
// étendu à de nouvelles capacités, conformément à la décision prise sur ce
// fichier.
//
// Permissions : 'orders.view' et 'orders.edit' sont déjà accordées à
// support_admin (voir seedRolePermissions.js) ; 'orders.view' est aussi
// accordée à warehouse_admin, qui a besoin de /admin/recherche pour
// l'écran de retour colis. 'clients.view' est ajouté en option sur
// /admin/user/:userId car c'est aussi un usage " fiche client ", pas
// seulement " historique commandes ".
orderRouter.get('/seller', authStaff, requirePermission('orders.view'), getAllOrders);
orderRouter.post('/status', authStaff, requirePermission('orders.edit'), updateOrderStatus);
orderRouter.get('/admin/user/:userId', authStaff, requireAnyPermission(['orders.view', 'clients.view']), getUserOrdersByAdmin);
// [NOUVEAU] Recherche de commande pour l'écran admin de retour colis.
orderRouter.get('/admin/recherche', authStaff, requirePermission('orders.view'), rechercherCommandeAdmin);

// ✅ PHASE 4 : Route pour assigner un livreur (admin)
orderRouter.post('/admin/assigner-livreur', authStaff, requireRole('admin', 'super_admin'), assignerLivreur);

// ✅ PHASE 4 : Routes pour livreur
orderRouter.get('/livreur/mes-livraisons', authStaff, requireRole('livreur'), getLivraisonsLivreur);
orderRouter.patch('/livreur/statut', authStaff, requireRole('livreur'), updateLivraisonStatus);
orderRouter.get('/livreur/collectes', authStaff, requireRole('livreur'), getCollectesLivreur);
orderRouter.post('/livreur/collectes/reserver', authStaff, requireRole('livreur'), reserverCollecte);
orderRouter.post('/livreur/collectes/collecter', authStaff, requireRole('livreur'), collecterArticle);
orderRouter.post('/livreur/collectes/terminer', authStaff, requireRole('livreur'), terminerCollecte);
// [FIX] Variantes REST à paramètres attendues par la page Collectes.jsx et
// par la doc (section 18) — voir commentaire au-dessus des contrôleurs.
orderRouter.post('/livreur/collectes/:orderId/reserver', authStaff, requireRole('livreur'), reserverCollecteLivreur);
orderRouter.post('/livreur/collectes/:orderId/items/:itemId/collecter', authStaff, requireRole('livreur'), collecterArticleLivreur);
orderRouter.post('/livreur/collectes/:orderId/terminer', authStaff, requireRole('livreur'), terminerCollecteLivreur);

// [PHASE 3] Aucun appelant frontend vivant pour ces 3 routes (ni
// pages/admin/*, ni pages/seller/* qui ne sont de toute façon pas routés).
// Migrées par cohérence avec le reste du fichier plutôt que laissées sur
// authSeller, mais candidates à un nettoyage séparé si confirmé mortes.
// 'orders.ship' (logistics_admin) plutôt que 'orders.edit' : ces 3 routes
// relèvent du même geste métier que le reste des routes /livreur/* de ce
// fichier (remise physique avant "En livraison"), pas d'une édition
// générale de commande.
orderRouter.post('/seller/mark-shipped', authStaff, requirePermission('orders.ship'), sellerMarkShipped);

// [NOUVEAU] Remise physique du colis au livreur — verrou avant "En livraison".
orderRouter.get('/seller/a-remettre', authStaff, requirePermission('orders.ship'), listCommandesARemettre);
orderRouter.post('/seller/remettre-livreur', authStaff, requirePermission('orders.ship'), confirmerRemiseLivreur);

// ✅ Commerçant : ses ventes uniquement (scopées à sa boutique)
orderRouter.get('/commercant/mes-ventes', authStaff, requireRole('commercant'), getMesVentesCommercant);
// Le commerçant confirme avoir vu la commande et mis son colis de côté.
orderRouter.post('/commercant/confirmer', authStaff, requireRole('commercant'), confirmerCommandeCommercant);
// [FIX] Route manquante appelée par Commandes.jsx (voir commentaire du contrôleur).
orderRouter.post('/commercant/disponibilite', authStaff, requireRole('commercant'), confirmerDisponibiliteCommercant);

// Validation finale par l'admin : c'est elle qui libère les fonds.
orderRouter.get('/admin/a-valider', authStaff, requireRole('admin', 'super_admin'), listCommandesAValider);
orderRouter.post('/admin/confirmer', authStaff, requireRole('admin', 'super_admin'), confirmerCommandeAdmin);

// [NOUVEAU] Litiges (doc §15) : un litige déclaré avant libération bloque
// confirmerCommandeAdmin ; la résolution peut créer une retenue commerçant
// ou un remboursement client exceptionnel.
orderRouter.get('/admin/litiges', authStaff, requireRole('admin', 'super_admin'), listLitiges);
orderRouter.post('/admin/litige/declarer', authStaff, requireRole('admin', 'super_admin'), declarerLitige);
orderRouter.post('/admin/litige/resoudre', authStaff, requireRole('admin', 'super_admin'), resoudreLitige);

// Récupérer une commande par son ID (client)
orderRouter.get('/:orderId', authUser, async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.body.userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Commande non trouvée" });
        }
        res.json({ success: true, order });
    } catch (error) {
        console.error("Erreur récupération commande:", error);
        res.status(400).json({ success: false, message: error.message });
    }
});

export default orderRouter;