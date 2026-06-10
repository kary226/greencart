import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AppContextProvider } from './context/AppContext.jsx'
import { HelmetProvider } from 'react-helmet-async'

// ✅ Enregistrement du Service Worker pour la PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker enregistré avec succès:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <BrowserRouter>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </BrowserRouter>
  </HelmetProvider>,
);