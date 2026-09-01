import { etatConfirmations } from './walletService.js';

/**
 * FundsReleaseService  —  Guide RAMCI §8, §15
 * ===========================================
 * « Règle centrale d'éligibilité. »
 *
 * LE PROBLÈME QU'IL RÈGLE
 * -----------------------
 * La question « cet argent peut-il passer d'en attente à disponible ? »
 * recevait sa réponse à trois endroits différents :
 *   - `confirmerCommandeAdmin` vérifiait status === 'Shipped' et le litige ;
 *   - `libererFonds` revérifiait status === 'Shipped', mais PAS le litige ;
 *   - le frontend affichait ou non un bouton selon ses propres critères.
 *
 * Trois lectures d'une même règle, donc trois occasions de diverger. Le cas
 * concret : `libererFonds` appelé depuis un autre chemin que le contrôleur
 * libérait les fonds d'une commande en litige — le verrou n'existait que
 * dans l'appelant, pas dans l'opération.
 *
 * Ici, la règle est écrite UNE fois, en fonction pure, et tout le monde la
 * lit — y compris le frontend, via l'API, ce qui lui évite de la redevimer.
 *
 * LE MODÈLE À DEUX NIVEAUX (§8) : en attente → disponible. Ce service ne
 * décide QUE du passage. L'écriture des transactions reste dans
 * walletService.js, seul endroit qui touche à l'argent.
 */

/** Statut logistique minimum : le colis doit être réceptionné (§7, §8). */
export const STATUT_REQUIS = 'Shipped';

/**
 * Motifs de blocage, avec leur formulation destinée à l'écran. Les
 * regrouper ici évite la dérive habituelle : le même refus expliqué de
 * trois manières selon la page.
 */
export const MOTIFS = Object.freeze({
    STATUT: 'statut_insuffisant',
    LITIGE: 'litige_en_cours',
    CONFIRMATIONS: 'confirmations_manquantes',
    DEJA_LIBERE: 'deja_libere',
    RIEN_A_LIBERER: 'rien_a_liberer',
});

/**
 * LA règle d'éligibilité. Fonction PURE : aucune I/O, entièrement testable.
 *
 * @param {object} order
 * @returns {{eligible:boolean, motif?:string, message?:string, details?:object}}
 */
export const evaluerEligibilite = (order) => {
    if (!order) {
        return { eligible: false, motif: MOTIFS.RIEN_A_LIBERER, message: 'Commande introuvable' };
    }

    // 1. Déjà fait — ni une erreur, ni une raison de recommencer.
    if (order.confirmeParAdminLe) {
        return {
            eligible: false,
            motif: MOTIFS.DEJA_LIBERE,
            message: 'Cette commande a déjà été validée',
        };
    }

    // 2. Litige (§8 « litige → fonds concernés bloqués », §15). Placé AVANT
    //    le statut : c'est le verrou qui doit tenir quel que soit le chemin
    //    d'appel, y compris quand la commande est par ailleurs en règle.
    if (order.litige?.enCours) {
        return {
            eligible: false,
            motif: MOTIFS.LITIGE,
            message: 'Un litige est en cours sur cette commande — libération bloquée jusqu’à sa résolution',
        };
    }

    // 3. Réception effective (§7, §8). Tant que le colis n'est pas entré à
    //    l'entrepôt, rien ne prouve que le commerçant a livré sa part.
    //
    //    Le statut technique « Shipped » est cité dans le message : c'est
    //    lui qu'on lit dans les journaux et dans la base, et le masquer
    //    derrière le seul libellé métier rend le diagnostic plus lent.
    if (order.status !== STATUT_REQUIS) {
        return {
            eligible: false,
            motif: MOTIFS.STATUT,
            message: `Les fonds ne peuvent être libérés qu’après réception du colis et passage à « Expédiée » (Shipped) par les Opérations`,
            details: { statutActuel: order.status, statutRequis: STATUT_REQUIS },
        };
    }

    // 4. Les confirmations commerçant sont remontées à titre INFORMATIF,
    //    pas comme un verrou. Elles se jouent en amont, à l'étape 2 du
    //    cycle (§5, « disponibilité ») : atteindre « Shipped » suppose déjà
    //    une collecte article par article puis une réception physique
    //    (§7). Bloquer ici en plus reviendrait à retenir l'argent d'un
    //    commerçant dont le colis est bel et bien dans l'entrepôt, pour une
    //    case non cochée plus tôt — le guide ne le demande nulle part, et
    //    §4 rappelle que le flux normal doit avancer simplement.
    const confirmations = etatConfirmations(order);

    // 5. Y a-t-il seulement de l'argent commerçant en jeu ? Une commande du
    //    catalogue principal n'a aucun portefeuille à créditer — ce n'est
    //    pas un blocage, juste un non-sujet.
    if (confirmations.attendues.length === 0) {
        return {
            eligible: true,
            motif: MOTIFS.RIEN_A_LIBERER,
            message: 'Aucun fonds commerçant à libérer sur cette commande',
            details: { aucuneBoutique: true },
        };
    }

    return { eligible: true, details: confirmations };
};

/** Raccourci booléen, pour les appelants qui n'ont pas besoin du motif. */
export const estEligible = (order) => evaluerEligibilite(order).eligible;

/**
 * Ce qu'il faut afficher à l'écran (§14 : « ce qu'il doit faire
 * maintenant »). Le frontend n'a plus à deviner la règle : il rend ce
 * qu'on lui donne.
 */
export const etatLiberation = (order) => {
    const evaluation = evaluerEligibilite(order);
    return {
        peutLiberer: evaluation.eligible && evaluation.motif !== MOTIFS.RIEN_A_LIBERER,
        dejaLibere: Boolean(order?.confirmeParAdminLe),
        bloque: !evaluation.eligible,
        motif: evaluation.motif || null,
        message: evaluation.message || 'Prête à être libérée',
        // Un blocage par litige relève du Super Admin (§1, §12), pas de
        // Finance : l'écran doit le dire, sinon Finance attend sans savoir
        // qui relancer.
        releveDuSuperAdmin: evaluation.motif === MOTIFS.LITIGE,
    };
};

export default { evaluerEligibilite, estEligible, etatLiberation, MOTIFS };
