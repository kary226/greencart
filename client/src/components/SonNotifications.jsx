import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useToasterStore } from 'react-hot-toast';
import { sonSucces, sonErreur, sonInfo } from '../utils/notifications';

/**
 * SON SUR LES MESSAGES
 * ====================
 *
 * Monté une seule fois à côté du `<Toaster>`, ce composant écoute le flux de
 * messages et joue un son quand il en apparaît un.
 *
 * POURQUOI ICI PLUTÔT QU'À CHAQUE APPEL
 * -------------------------------------
 * Le projet compte près de 300 `toast.success(...)` / `toast.error(...)`.
 * Les remplacer un par un aurait voulu dire toucher 37 fichiers pour un
 * comportement identique partout — et rater les appels ajoutés ensuite.
 * En s'abonnant au flux, un message écrit demain sonne sans qu'on y pense.
 *
 * OÙ LE SON SE JUSTIFIE
 * ---------------------
 * Dans les espaces de TRAVAIL : ce sont des écrans qu'on laisse ouverts en
 * faisant autre chose, où un message de 2,5 s passe inaperçu.
 *
 * Pas sur la boutique. Un client qui ajoute un article au panier voit son
 * panier changer sous ses yeux : le bip n'apprendrait rien et ferait du
 * bruit sur un téléphone en public. C'est le « n'ajoute pas où ce n'est pas
 * nécessaire » appliqué.
 */

const ESPACES_DE_TRAVAIL = ['/admin', '/commercant', '/livreur', '/staff'];

const SonNotifications = () => {
    const { toasts } = useToasterStore();
    const location = useLocation();
    const dejaSonnes = useRef(new Set());

    const dansUnEspaceDeTravail = ESPACES_DE_TRAVAIL.some(
        (prefixe) => location.pathname.startsWith(prefixe)
    );

    useEffect(() => {
        if (!dansUnEspaceDeTravail) return;

        for (const t of toasts) {
            // `visible` écarte les messages en cours de disparition, que le
            // store garde un instant après leur fermeture.
            if (!t.visible || dejaSonnes.current.has(t.id)) continue;
            dejaSonnes.current.add(t.id);

            if (t.type === 'success') sonSucces();
            else if (t.type === 'error') sonErreur();
            else if (t.type !== 'loading') sonInfo();
            // 'loading' reste muet : il annonce une attente, pas un résultat,
            // et il est presque toujours suivi d'un second message.
        }

        // Le Set ne doit pas grandir indéfiniment sur une session longue.
        // Au-delà de 50, on ne garde que les identifiants encore affichés.
        if (dejaSonnes.current.size > 50) {
            dejaSonnes.current = new Set(toasts.map((t) => t.id));
        }
    }, [toasts, dansUnEspaceDeTravail]);

    return null;
};

export default SonNotifications;
