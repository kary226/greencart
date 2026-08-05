import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Injecté automatiquement par vite-plugin-pwa (stratégie injectManifest) :
// la liste des fichiers de l'app à mettre en cache pour le mode hors-ligne.
precacheAndRoute(self.__WB_MANIFEST);

// Même comportement de cache qu'avant pour les polices Google Fonts.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })
    ]
  })
);

// ⚡ PHASE 1 - Cache des images produits/bannières (Cloudinary).
// Une fois uploadée, une image Cloudinary donnée (URL avec son public_id
// et sa version /v.../) ne change plus jamais de contenu : un remplacement
// d'image côté seller/commerçant génère une nouvelle URL. CacheFirst est
// donc sûr ici — pas de risque de servir une image périmée.
// Bénéfice : les images déjà vues (catalogue parcouru, fiche produit déjà
// ouverte) s'affichent instantanément et sans consommer de données au
// retour sur le site, y compris en 3G/4G.
registerRoute(
  ({ url }) => url.hostname === 'res.cloudinary.com',
  new CacheFirst({
    cacheName: 'cloudinary-images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 jours
        purgeOnQuotaError: true,
      }),
    ],
  })
);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 🔔 Réception d'une notification push envoyée par le serveur RAMCI
self.addEventListener('push', (event) => {
  let data = { title: 'RAMCI', body: 'Vous avez une nouvelle notification', url: '/' };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    // Payload non-JSON : on garde le message par défaut plutôt que de planter le SW.
  }

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Clic sur la notification : ouvre (ou ramène au premier plan) l'app sur la bonne page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existingClient = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (existingClient) {
        existingClient.navigate(targetUrl);
        return existingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});