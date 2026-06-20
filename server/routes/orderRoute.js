import express from 'express';
import authUser from '../middlewares/authUser.js';
import { getAllOrders, getUserOrders, placeOrderCOD, updateOrderStatus, getUserOrdersByAdmin } from '../controllers/orderController.js';
import authSeller from '../middlewares/authSeller.js';
import { initiateGeniusPay } from '../controllers/geniuspayController.js';
import Order from '../models/Order.js';

const orderRouter = express.Router();

orderRouter.post('/cod', authUser, placeOrderCOD);
orderRouter.get('/user', authUser, getUserOrders);
orderRouter.get('/seller', authSeller, getAllOrders);
orderRouter.post('/status', authSeller, updateOrderStatus);
orderRouter.post('/geniuspay/initiate', authUser, initiateGeniusPay);
orderRouter.get('/admin/user/:userId', authSeller, getUserOrdersByAdmin);

// [FIX] Stripe retiré : GreenCart n'utilise que GeniusPay et COD comme
// moyens de paiement. L'ancienne route 'POST /stripe' (placeOrderStripe)
// a été supprimée.

// ============================================================
// RÉCUPÉRER UNE COMMANDE PAR SON ID
// [FIX C3] Protégée par authUser + vérification de propriété.
// authUser place l'id du token dans req.body.userId — on filtre
// la requête Mongo sur ce champ pour empêcher tout IDOR.
// ============================================================
orderRouter.get('/:orderId', authUser, async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.body.userId });
        if (!order) {
            // Message volontairement générique : ne pas révéler si la commande
            // existe mais appartient à quelqu'un d'autre.
            return res.status(404).json({ success: false, message: "Commande non trouvée" });
        }
        res.json({ success: true, order });
    } catch (error) {
        console.error("Erreur récupération commande:", error);
        res.status(400).json({ success: false, message: error.message });
    }
});

// ============================================================
// [FIX C1] L'ancienne route POST /geniuspay/confirm a été
// SUPPRIMÉE. Elle permettait à n'importe qui (sans authentification
// ni vérification d'aucune sorte) de marquer une commande comme
// payée simplement en connaissant son orderId.
//
// La confirmation de paiement passe désormais EXCLUSIVEMENT par le
// webhook signé GeniusPay (voir controllers/geniuspayController.js
// -> geniuspayWebhook, monté dans server.js sur
// POST /api/geniuspay/webhook), qui vérifie une signature HMAC
// avant de faire confiance au payload.
//
// Si un jour un mécanisme de "confirmation manuelle" de secours est
// nécessaire (ex. webhook GeniusPay en panne), il doit être protégé
// par authSeller et déclenché uniquement depuis le back-office, jamais
// depuis une route publique appelable par le frontend client.
// ============================================================

// ============================================================
// [FIX C1] L'ancien webhook POST /geniuspay/webhook défini ICI
// (en doublon de controllers/geniuspayController.js, lui aussi
// sans vérification de signature) a été SUPPRIMÉ.
//
// Un seul point d'entrée webhook GeniusPay doit exister :
// POST /api/geniuspay/webhook -> geniuspayWebhook
// (monté dans server.js, signature HMAC vérifiée).
// ============================================================

export default orderRouter;