import webpush from 'web-push';
import 'dotenv/config';

// [FIX] setVapidDetails() lève une exception synchrone si les clés VAPID
// sont absentes, ce qui plantait le chargement du module — et donc TOUT
// le serveur, y compris en local sans configuration push — dès l'import de
// ce fichier, avant même la connexion à la base de données. Les notifications
// push sont une fonctionnalité optionnelle : on suit ici le même principe de
// dégradation que pour SMTP (configs/email.js) et Redis (configs/cache.js) —
// avertir et continuer, plutôt que de refuser de démarrer.
//
// ⚠️ Remplace l'email par une adresse valide de ton domaine.
// C'est utilisé par les navigateurs pour te contacter en cas d'abus, ce n'est jamais affiché à l'utilisateur.
const vapidConfigure = () => {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.warn(
            '⚠️ Variables VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquantes : les notifications push sont désactivées.'
        );
        return;
    }
    webpush.setVapidDetails(
        'mailto:rami.yao@ensea.edu.ci',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
};

vapidConfigure();

export default webpush;