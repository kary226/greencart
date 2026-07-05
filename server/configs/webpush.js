import webpush from 'web-push';
import 'dotenv/config';

// ⚠️ Remplace l'email par une adresse valide de ton domaine.
// C'est utilisé par les navigateurs pour te contacter en cas d'abus, ce n'est jamais affiché à l'utilisateur.
webpush.setVapidDetails(
    'mailto:rami.yao@ensea.edu.ci',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

export default webpush;