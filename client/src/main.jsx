import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AppContextProvider } from './context/AppContext.jsx'
import { HelmetProvider } from 'react-helmet-async'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

// ❌ SUPPRIMÉ : l'enregistrement manuel du Service Worker
// C'est vite-plugin-pwa qui gère déjà cela automatiquement

// ⚡ PHASE 3 - Observabilité côté navigateur
//
// Les métriques serveur (/api/metrics) ne disent rien de ce que vit
// réellement l'utilisateur : un JSON rendu en 40 ms peut quand même donner
// une page qui s'affiche en 6 s sur un téléphone en 3G, à cause du poids du
// bundle et des images. C'est exactement ce que la Phase 1 (code splitting,
// transformations Cloudinary, lazy loading) cherchait à corriger — sans RUM,
// on n'a aucun moyen de vérifier que ça a marché sur le vrai trafic.
//
// SpeedInsights remonte les Core Web Vitals réels (LCP, CLS, INP, TTFB) par
// page. Analytics remonte le trafic par page, ce qui permet de pondérer :
// une régression sur une page vue 12 fois par mois n'a pas le même poids
// qu'une régression sur l'accueil.
//
// Les deux ne s'activent que sur un déploiement Vercel (no-op en local, et
// aucune requête réseau en développement). Les données doivent être activées
// côté dashboard Vercel : projet → onglets Analytics et Speed Insights.
createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <BrowserRouter>
      <AppContextProvider>
        <App />
        <Analytics />
        <SpeedInsights />
      </AppContextProvider>
    </BrowserRouter>
  </HelmetProvider>,
);