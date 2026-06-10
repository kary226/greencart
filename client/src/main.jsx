import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AppContextProvider } from './context/AppContext.jsx'
import { HelmetProvider } from 'react-helmet-async'

// ❌ SUPPRIMÉ : l'enregistrement manuel du Service Worker
// C'est vite-plugin-pwa qui gère déjà cela automatiquement

createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <BrowserRouter>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </BrowserRouter>
  </HelmetProvider>,
);