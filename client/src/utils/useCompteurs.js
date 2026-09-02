import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { notifier } from './notifications';

/**
 * COMPTEURS DE LA CONSOLE — les pastilles du menu
 * ==============================================
 *
 * `/api/console` calculait déjà tout ce qu'il faut : combien de retraits
 * attendent, combien de retours à inspecter, combien d'exceptions à
 * trancher. Seule la page « À faire » s'en servait. Le menu, lui, n'affichait
 * rien — il fallait ouvrir la page d'accueil pour savoir s'il y avait du
 * travail, et rien n'avertissait quand quelque chose tombait pendant qu'on
 * travaillait sur un autre écran.
 *
 * Ce hook rend ces mêmes compteurs disponibles partout, et signale les
 * nouveautés.
 *
 * DEUX PRÉCAUTIONS :
 *
 *   · pas d'alerte au premier chargement — tout paraîtrait nouveau ;
 *   · on n'alerte que sur une AUGMENTATION. Un compteur qui descend, c'est
 *     un collègue qui a traité le dossier : ce n'est pas une nouvelle.
 */

const INTERVALLE = 60_000;

export const useCompteurs = ({ actif = true } = {}) => {
    const { axios } = useAppContext();
    const [taches, setTaches] = useState([]);
    const [total, setTotal] = useState(0);
    const precedents = useRef(null);

    useEffect(() => {
        if (!actif) return undefined;

        let vivant = true;

        const charger = async () => {
            try {
                const { data } = await axios.get('/api/console');
                if (!vivant || !data.success) return;

                const liste = data.taches || [];
                setTaches(liste);
                setTotal(liste.reduce((n, t) => n + t.nombre, 0));

                const actuels = Object.fromEntries(liste.map((t) => [t.cle, t.nombre]));

                // Premier passage : on mémorise sans rien annoncer.
                if (precedents.current === null) {
                    precedents.current = actuels;
                    return;
                }

                const nouveautes = liste.filter(
                    (t) => t.nombre > (precedents.current[t.cle] || 0)
                );
                precedents.current = actuels;

                // Une seule annonce, même si trois compteurs bougent : trois
                // toasts empilés pour un même rafraîchissement, c'est du bruit.
                if (nouveautes.length === 1) {
                    const t = nouveautes[0];
                    notifier.nouveaute(`${t.libelle} — ${t.nombre} en attente`);
                } else if (nouveautes.length > 1) {
                    notifier.nouveaute(`${nouveautes.length} nouvelles choses à traiter`);
                }
            } catch {
                // Un compteur indisponible ne doit pas casser l'écran :
                // on garde les derniers chiffres connus.
            }
        };

        charger();
        const minuterie = setInterval(charger, INTERVALLE);
        return () => { vivant = false; clearInterval(minuterie); };
    }, [axios, actif]);

    /**
     * Compteurs regroupés par écran de destination, pour que le menu n'ait
     * qu'à demander « combien pour ce lien ? ».
     */
    const parChemin = {};
    for (const t of taches) {
        const base = (t.lien || '').split('?')[0];
        if (!base) continue;
        parChemin[base] = (parChemin[base] || 0) + t.nombre;
    }

    return { taches, total, parChemin };
};

export default useCompteurs;
