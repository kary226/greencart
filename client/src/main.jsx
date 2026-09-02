import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AppContextProvider } from './context/AppContext.jsx'
import { HelmetProvider } from 'react-helmet-async'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import BandeauCookies, { mesureAcceptee } from './components/BandeauCookies.jsx'

/**
 * La mesure d'audience n'est montée QU'APRÈS accord.
 *
 * Avant, `<Analytics />` et `<SpeedInsights />` se chargeaient dès
 * l'ouverture de la page. Un bandeau posé par-dessus n'aurait rien changé :
 * la mesure serait partie avant même que le visiteur ait lu la question, et
 * son refus n'aurait rien arrêté. Demander l'accord après coup, c'est
 * demander pour la forme.
 */
const Racine = () => {
    const [mesureAutorisee, setMesureAutorisee] = useState(() => mesureAcceptee());

    return (
        <HelmetProvider>
            <BrowserRouter>
                <AppContextProvider>
                    <App />
                    <BandeauCookies onChoix={setMesureAutorisee} />
                    {mesureAutorisee && (
                        <>
                            <Analytics />
                            <SpeedInsights />
                        </>
                    )}
                </AppContextProvider>
            </BrowserRouter>
        </HelmetProvider>
    );
};

createRoot(document.getElementById('root')).render(<Racine />);
