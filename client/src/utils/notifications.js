import toast from 'react-hot-toast';

/**
 * NOTIFICATIONS — son et messages
 * ===============================
 *
 * Deux besoins que le projet n'avait pas :
 *
 *   1. UN SON. Les toasts passaient en silence. Sur les écrans qu'on laisse
 *      ouverts en travaillant — retraits, retours, colis — un message qui
 *      apparaît et disparaît en 2,5 s sans bruit ne se voit pas.
 *
 *   2. UNE DISTINCTION. Le succès et l'échec sonnaient pareil, c'est-à-dire
 *      pas du tout. Deux sons différents évitent de devoir relire l'écran
 *      pour savoir si l'action est passée.
 *
 * Le son est SYNTHÉTISÉ, pas chargé depuis un fichier : aucun octet à
 * télécharger, rien à héberger, et pas de requête réseau au moment précis
 * où l'on veut un retour immédiat.
 */

const CLE_SON = 'ramci_son_notifications';

/** Le son est-il activé ? Coupé par défaut nulle part — mais coupable. */
export const sonActive = () => {
    try {
        return localStorage.getItem(CLE_SON) !== 'off';
    } catch {
        // Navigation privée, stockage bloqué : on garde le son.
        return true;
    }
};

export const basculerSon = () => {
    const nouveau = !sonActive();
    try {
        localStorage.setItem(CLE_SON, nouveau ? 'on' : 'off');
    } catch { /* sans stockage, le réglage ne survit pas au rechargement */ }
    return nouveau;
};

let contexteAudio = null;

/**
 * Un bip court, en deux notes.
 *
 * Le contexte audio n'est créé qu'au premier son : les navigateurs refusent
 * d'en ouvrir un avant la première interaction de l'utilisateur, et en créer
 * un au chargement produit une erreur dans la console à chaque visite.
 */
const bip = (frequences, duree = 0.09) => {
    if (!sonActive()) return;

    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        contexteAudio = contexteAudio || new AudioCtx();
        // Suspendu tant que l'utilisateur n'a rien cliqué : on réveille.
        if (contexteAudio.state === 'suspended') contexteAudio.resume();

        frequences.forEach((frequence, index) => {
            const oscillateur = contexteAudio.createOscillator();
            const volume = contexteAudio.createGain();

            oscillateur.type = 'sine';
            oscillateur.frequency.value = frequence;

            const depart = contexteAudio.currentTime + index * duree;
            // Enveloppe courte : sans elle, le son claque au début et à la
            // fin — désagréable quand il se répète toute la journée.
            volume.gain.setValueAtTime(0, depart);
            volume.gain.linearRampToValueAtTime(0.09, depart + 0.012);
            volume.gain.exponentialRampToValueAtTime(0.0001, depart + duree);

            oscillateur.connect(volume).connect(contexteAudio.destination);
            oscillateur.start(depart);
            oscillateur.stop(depart + duree);
        });
    } catch {
        // Le son est un confort : jamais une raison d'interrompre l'action.
    }
};

/** Deux notes qui montent : c'est passé. */
export const sonSucces = () => bip([660, 880]);
/** Deux notes qui descendent : quelque chose n'a pas marché. */
export const sonErreur = () => bip([420, 300], 0.13);
/** Une note seule, discrète : quelque chose est arrivé, sans urgence. */
export const sonInfo = () => bip([780], 0.08);

/**
 * Messages.
 *
 * CES FONCTIONS NE JOUENT PAS DE SON ELLES-MÊMES.
 *
 * Le son est branché une fois pour toutes sur le flux de toasts, dans
 * components/SonNotifications.jsx. Le rejouer ici le ferait retentir DEUX
 * fois — défaut constaté en mesurant les oscillateurs créés : deux notes
 * partaient là où une seule était attendue.
 *
 * Ces raccourcis ne servent donc plus qu'à donner une allure cohérente aux
 * messages ; `toast` directement fait le même effet.
 */
export const notifier = {
    succes: (message, options = {}) => toast.success(message, options),
    erreur: (message, options = {}) => toast.error(message, options),
    info: (message, options = {}) => toast(message, options),
    /**
     * Une nouveauté arrivée seule, sans que l'utilisateur ait rien fait :
     * un retrait qui tombe, une collecte qui se libère. Durée plus longue —
     * personne ne regardait l'écran au moment où c'est apparu.
     */
    nouveaute: (message, options = {}) =>
        toast(message, { duration: 5000, icon: '🔔', ...options }),
};

export default notifier;
