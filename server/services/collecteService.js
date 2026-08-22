import Order from '../models/Order.js';

// Réservation de collecte — expiration (doc §9-10).
//
// « Une réservation doit avoir une expiration pour éviter qu'une commande
// reste bloquée si le livreur abandonne son téléphone. »
//
// On ne libère JAMAIS une réservation qui a déjà commencé (au moins un
// article marqué 'collected') : le livreur a une progression réelle en
// cours, la lui retirer perdrait du travail fait et pourrait faire
// collecter le même article par deux livreurs. On ne libère que les
// réservations mortes — verrouillées, mais jamais entamées.

// 3h : le temps raisonnable pour qu'un livreur qui accepte une collecte
// passe la récupérer physiquement chez le(s) commerçant(s).
export const DUREE_RESERVATION_MS = 3 * 60 * 60 * 1000;

/** Date d'expiration à poser au moment d'une réservation. */
export const calculerExpirationReservation = () => new Date(Date.now() + DUREE_RESERVATION_MS);

/**
 * Repasse à 'Confirmed' (libre pour tout livreur) toute commande dont la
 * réservation a expiré sans qu'aucune collecte réelle n'ait commencé.
 *
 * Appelée de façon opportuniste (à chaque lecture/tentative de réservation
 * de la file de collectes) plutôt que par une tâche planifiée séparée : pas
 * de nouvelle infrastructure à opérer, et la file se répare d'elle-même dès
 * qu'un livreur regarde ou tente de réserver.
 *
 * @returns {Promise<number>} nombre de commandes libérées
 */
export const libererReservationsExpirees = async () => {
    const maintenant = new Date();

    const candidates = await Order.find({
        status: 'Collecting',
        collecteLivreurId: { $ne: null },
        collecteExpireLe: { $ne: null, $lte: maintenant },
    }).select('items status collecteLivreurId collecteReserveeLe collecteExpireLe');

    let liberees = 0;
    for (const order of candidates) {
        const collecteDejaCommencee = (order.items || []).some(
            (item) => item.availabilityStatus === 'collected'
        );
        if (collecteDejaCommencee) continue;

        order.status = 'Confirmed';
        order.collecteLivreurId = null;
        order.collecteReserveeLe = null;
        order.collecteExpireLe = null;
        await order.save();
        liberees += 1;
    }

    return liberees;
};

export default { DUREE_RESERVATION_MS, calculerExpirationReservation, libererReservationsExpirees };