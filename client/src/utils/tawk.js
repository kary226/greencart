/**
 * CHAT D'ASSISTANCE (Tawk.to)
 * ===========================
 *
 * Deux choses vivent ici, qui étaient auparavant recopiées à l'identique
 * dans Footer.jsx et Navbar.jsx :
 *
 *   1. le chargement du widget, à la demande — le script ne part qu'au
 *      premier clic, pour que les visiteurs qui n'ouvrent jamais le chat
 *      n'en paient pas le poids ;
 *
 *   2. l'identification du visiteur, qui n'existait pas. L'agent voyait
 *      « Visiteur 1 » et commençait chaque conversation par « bonjour, vous
 *      êtes ? quelle commande ? » alors que le site connaissait déjà la
 *      réponse pour un client connecté.
 */

const ID_WIDGET = '6a26a25d683c831c304cb5ea/1jqjekfae';

/**
 * Transmettre l'ADRESSE E-MAIL du client à Tawk.to, ou seulement son nom ?
 *
 * `true`  — l'agent peut retrouver le compte et les commandes du client
 *           sans les lui demander. C'est ce qui rend l'identification
 *           réellement utile.
 * `false` — seul le prénom sort du site. L'agent sait à qui il parle, mais
 *           devra demander la référence de commande.
 *
 * L'e-mail est une donnée personnelle transmise à un prestataire externe.
 * Basculer sur `false` suffit à l'en retirer : rien d'autre à modifier.
 */
const TRANSMETTRE_EMAIL = true;

/**
 * Ce que l'agent verra. On envoie un prénom plutôt que le nom complet
 * quand on l'a : c'est ce qui rend la conversation naturelle, et ça évite
 * d'exposer le nom de famille sans nécessité.
 */
const identiteVisiteur = (user) => {
    if (!user) return null;

    const nom = (user.firstName || user.name || '').trim();
    if (!nom) return null;

    const identite = { name: nom.split(' ')[0] };
    if (TRANSMETTRE_EMAIL && user.email) identite.email = user.email;

    return identite;
};

/**
 * Ouvre le chat, en identifiant le visiteur s'il est connecté.
 *
 * @param {object|null} user  le client connecté, ou null s'il ne l'est pas
 */
export const ouvrirChat = (user = null) => {
    const identite = identiteVisiteur(user);

    // Déjà chargé : on met à jour l'identité puis on ouvre.
    if (window.Tawk_API?.maximize) {
        appliquerIdentite(identite);
        window.Tawk_API.showWidget?.();
        window.Tawk_API.maximize();
        return;
    }

    // Premier appel. `Tawk_API.visitor` doit être posé AVANT que le script
    // ne s'exécute : c'est ce que Tawk.to lit à l'initialisation. Renseigné
    // après coup, il est ignoré pour la session en cours.
    window.Tawk_API = window.Tawk_API || {};
    if (identite) window.Tawk_API.visitor = identite;

    // Ouvrir dès que le widget est prêt, plutôt qu'après un délai fixe :
    // l'ancienne version attendait 1 seconde en aveugle, ce qui ratait
    // l'ouverture sur une connexion lente et faisait patienter pour rien
    // sur une connexion rapide.
    const ouvrirQuandPret = window.Tawk_API.onLoad;
    window.Tawk_API.onLoad = function () {
        if (typeof ouvrirQuandPret === 'function') ouvrirQuandPret();
        window.Tawk_API.showWidget?.();
        window.Tawk_API.maximize?.();
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://embed.tawk.to/${ID_WIDGET}`;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    document.body.appendChild(script);
};

/**
 * Met à jour l'identité sur un widget déjà chargé — le cas du client qui se
 * connecte après avoir ouvert le chat une première fois en anonyme.
 *
 * `setAttributes` échoue si le mode sécurisé est activé côté Tawk.to sans
 * signature. On avale l'erreur : le chat doit s'ouvrir même sans identité,
 * un visiteur non identifié valant mieux qu'un bouton qui ne répond pas.
 */
const appliquerIdentite = (identite) => {
    if (!identite || typeof window.Tawk_API?.setAttributes !== 'function') return;
    try {
        window.Tawk_API.setAttributes(identite, () => {});
    } catch {
        /* sans effet sur l'ouverture du chat */
    }
};

export default ouvrirChat;
