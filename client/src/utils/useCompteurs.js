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

// [FIX] 60s -> 15s à la demande, MAIS avec une compensation : sans elle,
// un onglet Admin oublié en arrière-plan toute la journée interrogerait le
// serveur 4x plus souvent pour rien, ce qui pèse vraiment sur le budget
// gratuit Vercel (chaque appel à /api/console fait 16 requêtes à la base).
// On met donc en pause dès que l'onglet n'est plus visible, et on relance
// immédiatement (pas d'attente jusqu'au prochain tick) dès qu'on y revient.
const INTERVALLE = 15_000;

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
        let minuterie = setInterval(charger, INTERVALLE);

        // Onglet en arrière-plan = plus de raison d'interroger le serveur
        // toutes les 15 secondes ; on reprend, et on recharge tout de suite
        // (pas d'attente jusqu'au prochain tick), dès qu'on revient dessus.
        const surChangementVisibilite = () => {
            clearInterval(minuterie);
            if (document.hidden) return;
            charger();
            minuterie = setInterval(charger, INTERVALLE);
        };
        document.addEventListener('visibilitychange', surChangementVisibilite);

        return () => {
            vivant = false;
            clearInterval(minuterie);
            document.removeEventListener('visibilitychange', surChangementVisibilite);
        };
    }, [axios, actif]);

    /**
     * Compteurs regroupés par écran de destination, pour que le menu n'ait
     * qu'à demander « combien pour ce lien ? ».
     */
    const parChemin = {};
    // [NOUVEAU] Même regroupement, mais séparé par urgence : deux tâches
    // différentes peuvent pointer vers le même écran (ex: "nouvelles
    // commandes" et "collectes en cours" pointent toutes les deux vers
    // /admin/orders) sans vouloir dire la même chose. `parChemin` reste le
    // total fusionné (utile pour le sous-total d'une rubrique) ; ces deux-là
    // permettent d'afficher une pastille rouge et une pastille grise
    // distinctes sur le même lien.
    const parCheminHaute = {};
    const parCheminAutre = {};
    for (const t of taches) {
        const base = (t.lien || '').split('?')[0];
        if (!base) continue;
        parChemin[base] = (parChemin[base] || 0) + t.nombre;
        const cible = t.urgence === 'haute' ? parCheminHaute : parCheminAutre;
        cible[base] = (cible[base] || 0) + t.nombre;
    }

    return { taches, total, parChemin, parCheminHaute, parCheminAutre };
};

export default useCompteurs;