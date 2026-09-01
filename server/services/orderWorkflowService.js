import { journaliser } from './journalService.js';

/**
 * OrderWorkflowService  —  Guide RAMCI §5, §6, §15
 * ================================================
 * « Service unique de transitions. »
 *
 * LE PROBLÈME QU'IL RÈGLE
 * -----------------------
 * `order.status = '...'` était écrit à quinze endroits d'orderController.js,
 * chacun avec ses propres conditions préalables. Personne ne pouvait
 * répondre à « depuis Collecting, où peut-on aller ? » sans relire 1700
 * lignes — et la réponse variait selon le chemin emprunté. Un même statut
 * était atteignable de deux façons dont l'une oubliait un contrôle.
 *
 * Ici, la réponse tient dans une table qu'on lit en dix secondes. Aucune
 * transition n'existe si elle n'y figure pas.
 *
 * LE CYCLE (§5, « comment une commande fonctionne de A à Z ») :
 *   1 COMMANDE      pending_payment → Order Placed
 *   2 DISPONIBILITÉ Checking Availability → Confirmed
 *   3 COLLECTE      Collecting → Ready for Shipment
 *   4 RÉCEPTION     Shipped                (Opérations ou Super Admin, §7)
 *   5 LIVRAISON     Out for Delivery → Delivered
 *   6 CLÔTURE       terminée, sauf retour ou litige
 */

/** Étape lisible par un humain — c'est ce que le §14 demande d'afficher. */
export const ETAPES = Object.freeze({
    pending_payment: { numero: 0, libelle: 'En attente de paiement', phase: 'commande' },
    'Order Placed': { numero: 1, libelle: 'Commande passée', phase: 'commande' },
    'Checking Availability': { numero: 2, libelle: 'Vérification de disponibilité', phase: 'disponibilite' },
    Confirmed: { numero: 2, libelle: 'Confirmée par les commerçants', phase: 'disponibilite' },
    Collecting: { numero: 3, libelle: 'Collecte en cours', phase: 'collecte' },
    'Ready for Shipment': { numero: 3, libelle: 'Collecte terminée', phase: 'collecte' },
    Shipped: { numero: 4, libelle: 'Réceptionnée à l’entrepôt', phase: 'reception' },
    'Out for Delivery': { numero: 5, libelle: 'En cours de livraison', phase: 'livraison' },
    Delivered: { numero: 6, libelle: 'Livrée', phase: 'cloture' },
    Returned: { numero: 6, libelle: 'Retournée', phase: 'cloture' },
    Cancelled: { numero: 6, libelle: 'Annulée', phase: 'cloture' },
    Disputed: { numero: 6, libelle: 'En litige', phase: 'exception' },
});

/**
 * LA table des transitions. Un seul endroit à lire, un seul à modifier.
 *
 * 'Disputed' est absent des cibles ordinaires : un litige n'est pas une
 * étape du flux normal, il l'INTERROMPT (§12). Il passe par
 * `declarerLitige`, qui mémorise le statut d'avant pour le restaurer.
 * §2 : « séparer le flux normal du flux exceptionnel ».
 */
export const TRANSITIONS = Object.freeze({
    pending_payment: ['Order Placed', 'Cancelled'],
    'Order Placed': ['Checking Availability', 'Confirmed', 'Cancelled'],
    'Checking Availability': ['Confirmed', 'Checking Availability', 'Cancelled'],
    Confirmed: ['Collecting', 'Cancelled'],
    // Une collecte partielle reste dans sa phase intermédiaire (§6).
    Collecting: ['Collecting', 'Ready for Shipment', 'Confirmed', 'Cancelled'],
    // Retour au collecte possible : un colis incomplet constaté à
    // l'entrepôt doit pouvoir repartir en collecte plutôt que d'être forcé.
    'Ready for Shipment': ['Shipped', 'Collecting', 'Cancelled'],
    Shipped: ['Out for Delivery', 'Returned', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Returned', 'Shipped'],
    Delivered: ['Returned'],
    // États terminaux : rien n'en sort sans exception explicite (§13).
    Returned: [],
    Cancelled: [],
    Disputed: [],
});

/** Statuts d'où la commande ne bouge plus d'elle-même. */
export const STATUTS_TERMINAUX = Object.freeze(['Delivered', 'Returned', 'Cancelled']);

/**
 * Qui a le droit de provoquer quelle transition (§16).
 * On y liste des PERMISSIONS, jamais des rôles : le Super Admin passe
 * partout via admin.all sans figurer dans une seule ligne (§1).
 * `null` = transition provoquée par le système ou le client, pas par le staff.
 */
export const DROITS_TRANSITION = Object.freeze({
    'Order Placed': null,
    'Checking Availability': ['orders.confirm', 'orders.edit'],
    Confirmed: ['orders.confirm', 'orders.edit'],
    Collecting: ['deliveries.update_status', 'orders.edit'],
    'Ready for Shipment': ['deliveries.update_status', 'orders.edit'],
    Shipped: ['orders.receive', 'orders.ship'],
    'Out for Delivery': ['deliveries.update_status', 'orders.ship'],
    Delivered: ['deliveries.update_status', 'orders.mark_delivered'],
    Returned: ['returns.decide', 'orders.edit'],
    Cancelled: ['orders.edit'],
});

/**
 * Cette transition est-elle permise ? Fonction PURE — c'est elle que les
 * tests interrogent, sans base ni serveur.
 *
 * @param {string} depuis statut actuel
 * @param {string} vers   statut visé
 * @returns {{ok:true} | {ok:false, message:string}}
 */
export const verifierTransition = (depuis, vers) => {
    if (!(depuis in TRANSITIONS)) {
        return { ok: false, message: `Statut de départ inconnu : ${depuis}` };
    }
    if (!(vers in TRANSITIONS)) {
        return { ok: false, message: `Statut cible inconnu : ${vers}` };
    }
    if (depuis === vers && !TRANSITIONS[depuis].includes(vers)) {
        return { ok: true, inchange: true };
    }
    if (!TRANSITIONS[depuis].includes(vers)) {
        return {
            ok: false,
            message: `Transition impossible : « ${ETAPES[depuis]?.libelle || depuis} » → « ${ETAPES[vers]?.libelle || vers} »`,
        };
    }
    return { ok: true };
};

/** Statuts atteignables depuis un statut donné — alimente les écrans staff. */
export const transitionsPossibles = (depuis) => TRANSITIONS[depuis] || [];

/**
 * Ce compte a-t-il le droit de provoquer cette transition ?
 * `admin.all` passe partout (§1).
 */
export const peutTransitionner = (staffUser, vers) => {
    const requis = DROITS_TRANSITION[vers];
    if (requis === null || requis === undefined) return true;

    const perms = staffUser?.permissions || [];
    if (['super_admin', 'admin'].includes(staffUser?.role)) return true;
    if (perms.includes('admin.all')) return true;
    return requis.some((p) => perms.includes(p));
};

/**
 * Applique une transition sur une commande, en la contrôlant et en la
 * traçant. Ne sauvegarde PAS : l'appelant regroupe souvent plusieurs
 * modifications dans un seul `order.save()`, et un save caché ici
 * écraserait ses écritures en cours.
 *
 * @param {object} params
 * @param {object} params.order
 * @param {string} params.vers
 * @param {object} [params.acteur] { _id, nom, role, permissions }
 * @param {string} [params.note]
 * @param {boolean} [params.verifierDroits] false pour les transitions système
 * @returns {{ok:boolean, code?:number, message?:string, depuis?:string}}
 */
export const transitionner = ({ order, vers, acteur = null, note = '', verifierDroits = true }) => {
    const depuis = order.status;

    const controle = verifierTransition(depuis, vers);
    if (!controle.ok) {
        if (acteur) {
            journaliser({
                acteur: { id: acteur._id, nom: acteur.nom, role: acteur.role },
                action: 'commande.transition_refusee',
                cible: { id: order._id, libelle: `Commande ${order._id}` },
                note: `${depuis} → ${vers} : refusée`,
            }).catch(() => {});
        }
        return { ok: false, code: 409, message: controle.message, depuis };
    }

    if (verifierDroits && acteur && !peutTransitionner(acteur, vers)) {
        return {
            ok: false,
            code: 403,
            message: `Vous n'avez pas le droit de passer une commande à « ${ETAPES[vers]?.libelle || vers} »`,
            depuis,
        };
    }

    // Un litige en cours gèle le flux normal (§12) : les équipes exécutent
    // la décision du Super Admin, elles ne poursuivent pas la commande.
    if (order.litige?.enCours && !['Returned', 'Cancelled'].includes(vers)) {
        return {
            ok: false,
            code: 409,
            message: 'Cette commande est en litige — la décision du Super Admin est attendue',
            depuis,
        };
    }

    order.status = vers;

    if (acteur) {
        journaliser({
            acteur: { id: acteur._id, nom: acteur.nom, role: acteur.role },
            action: 'commande.transition',
            cible: { id: order._id, libelle: `Commande ${order._id}` },
            note: `${depuis} → ${vers}${note ? ` — ${note}` : ''}`,
        }).catch(() => {});
    }

    return { ok: true, depuis, vers };
};

/**
 * Résumé d'avancement destiné au client (§6 : « le client doit comprendre
 * le résultat, sans avoir besoin de comprendre toute la mécanique
 * interne »). On expose une étape sur six, pas un statut technique.
 */
export const avancement = (order) => {
    const etape = ETAPES[order?.status] || { numero: 0, libelle: order?.status || '—', phase: 'inconnu' };
    return {
        etape: etape.numero,
        total: 6,
        libelle: etape.libelle,
        phase: etape.phase,
        termine: STATUTS_TERMINAUX.includes(order?.status),
        enException: order?.status === 'Disputed' || Boolean(order?.litige?.enCours),
    };
};

export default { transitionner, verifierTransition, transitionsPossibles, avancement, TRANSITIONS, ETAPES };
