import PushSubscription from "../models/PushSubscription.js";
import webpush from "../configs/webpush.js";

// Enregistre (ou met à jour) l'abonnement push d'un utilisateur pour cet appareil/navigateur.
export const subscribePush = async (req, res) => {
    try {
        const { userId, subscription } = req.body;

        if (!userId || !subscription?.endpoint || !subscription?.keys) {
            return res.json({ success: false, message: "Données d'abonnement invalides" });
        }

        await PushSubscription.findOneAndUpdate(
            { endpoint: subscription.endpoint },
            {
                userId,
                endpoint: subscription.endpoint,
                keys: subscription.keys,
                userAgent: req.headers['user-agent'] || ''
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: "Abonnement enregistré" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Supprime un abonnement (ex: l'utilisateur désactive les notifications depuis cet appareil).
export const unsubscribePush = async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.json({ success: false, message: "Endpoint manquant" });
        }
        await PushSubscription.deleteOne({ endpoint });
        res.json({ success: true, message: "Désabonnement effectué" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Fonction interne (pas une route) — appelée depuis orderController.js quand le statut d'une commande change.
// Envoie la notification à tous les appareils enregistrés de l'utilisateur, et nettoie les abonnements
// devenus invalides (désinstallation de l'app, navigateur qui a révoqué l'abonnement, etc.).
export const sendPushToUser = async (userId, { title, body, url = '/' }) => {
    try {
        const subscriptions = await PushSubscription.find({ userId });
        if (!subscriptions.length) return;

        const payload = JSON.stringify({ title, body, url });

        await Promise.all(subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: sub.keys },
                    payload
                );
            } catch (error) {
                // 404/410 = le navigateur a révoqué cet abonnement : on le supprime silencieusement.
                if (error.statusCode === 404 || error.statusCode === 410) {
                    await PushSubscription.deleteOne({ _id: sub._id });
                } else {
                    console.error("Erreur envoi push:", error.message);
                }
            }
        }));
    } catch (error) {
        console.error("Erreur sendPushToUser:", error.message);
    }
};