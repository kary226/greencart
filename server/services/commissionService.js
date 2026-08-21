// Commission de la plateforme sur les ventes des commerçants.
//
// NOUVEAU MODÈLE : le Seller fixe directement le PRIX FINAL CLIENT.
// La commission est déjà comprise dans ce prix et n'est jamais ajoutée
// une seconde fois.
//
// Exemple : prix final client = 11 000 F
//   net commerçant = 11 000 / 1,10 = 10 000 F
//   commission     = 11 000 - 10 000 = 1 000 F
//
// Le calcul reste volontairement sous forme de division par (1 + taux),
// car le taux de 10 % est défini comme 10 % du net commerçant.
//
// Tout est en francs CFA : pas de centimes, donc arrondi à l'entier.

export const TAUX_COMMISSION = 0.10;

/**
 * Décompose le PRIX FINAL CLIENT entre le commerçant et la plateforme.
 *
 * Le montant reçu ici est déjà le prix final. Il ne faut donc jamais
 * appeler cette fonction pour augmenter le prix avant paiement.
 *
 * L'arrondi est calculé sur la part du commerçant, puis la commission est
 * déduite par SOUSTRACTION. C'est ce qui garantit que les deux parts
 * retombent toujours exactement sur le montant encaissé.
 *
 * @param {number} montantEncaisse - ce que le client a payé pour ces articles
 * @param {number} [taux] - taux de commission (0.10 = 10 %)
 * @returns {{net:number, commission:number, brut:number}}
 */
export const repartirCommission = (montantEncaisse, taux = TAUX_COMMISSION) => {
    const brut = Math.max(0, Math.round(Number(montantEncaisse) || 0));
    if (brut === 0) return { net: 0, commission: 0, brut: 0 };

    const net = Math.round(brut / (1 + taux));
    return {
        brut,
        net,
        commission: brut - net,
    };
};

/** Ce que touche le commerçant sur un montant encaissé. */
export const partCommercant = (montantEncaisse, taux = TAUX_COMMISSION) =>
    repartirCommission(montantEncaisse, taux).net;

/** Ce que garde la plateforme. */
export const partPlateforme = (montantEncaisse, taux = TAUX_COMMISSION) =>
    repartirCommission(montantEncaisse, taux).commission;

/**
 * LEGACY / COMPATIBILITÉ.
 *
 * Le nouveau formulaire Seller ne doit plus demander un « net souhaité ».
 * Cette fonction reste exportée pour ne pas casser d'éventuels appels ou
 * tests existants, mais elle ne doit pas être utilisée pour augmenter un
 * prix déjà saisi comme prix final client.
 */
export const prixAffichePourNet = (montantSouhaite, taux = TAUX_COMMISSION) =>
    Math.round(Math.max(0, Number(montantSouhaite) || 0) * (1 + taux));
