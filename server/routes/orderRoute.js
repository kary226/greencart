import express from 'express';
import authUser from '../middlewares/authUser.js';
import authStaff, { requireRole } from '../middlewares/authStaff.js';
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
import authActeur, { requireRoleActeur } from '../middlewares/authActeur.js';
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
// [PHASE 3 — migration authSeller → RBAC, 23 août 2026] /seller et
// /admin/user/:userId sont appelées par pages/admin/Orders.jsx et
// pages/admin/Clients.jsx (staffToken, SuperAdminLayout).
// pages/seller/Orders.jsx, pages/seller/ClientsManager.jsx et
// pages/seller/DeliveryManager.jsx (appelants historiques de /seller) ne
// sont routés nulle part dans App.jsx (morts). Migrées vers authActeur,
// pas vers authStaff+requirePermission : c'est le pont déjà posé sur ce
// fichier pour /status (voir note ci-dessous, conservée) et
// /admin/recherche — mieux vaut réutiliser la convention déjà en place
// ici que d'en introduire une troisième dans le même fichier.
//
// [FIX] N'acceptait QUE le vieux compte technique unique (authSeller) :
// un vrai compte staff admin (2FA, panel /staff/admin/...) ne pouvait pas
// changer le statut d'une commande, notamment déclencher un retour colis.
// authActeur accepte les DEUX sessions (staffToken ET sellerToken), donc
// rien ne casse côté ancien panel /seller.
orderRouter.get('/seller', authActeur, requireRoleActeur('admin'), getAllOrders);
orderRouter.post('/status', authActeur, requireRoleActeur('admin'), updateOrderStatus);
orderRouter.get('/admin/user/:userId', authActeur, requireRoleActeur('admin'), getUserOrdersByAdmin);
// [NOUVEAU] Recherche de commande pour l'écran admin de retour colis.
orderRouter.get('/admin/recherche', authActeur, requireRoleActeur('admin'), rechercherCommandeAdmin);

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
orderRouter.post('/seller/mark-shipped', authActeur, requireRoleActeur('admin'), sellerMarkShipped);

// [NOUVEAU] Remise physique du colis au livreur — verrou avant "En livraison".
orderRouter.get('/seller/a-remettre', authActeur, requireRoleActeur('admin'), listCommandesARemettre);
orderRouter.post('/seller/remettre-livreur', authActeur, requireRoleActeur('admin'), confirmerRemiseLivreur);

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