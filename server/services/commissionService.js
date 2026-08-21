// Commission de la plateforme sur les ventes des commerçants.
//
// MODÈLE : la marge est AJOUTÉE au prix du commerçant, elle n'est pas
// prélevée dessus. Un article que le commerçant vend 10 000 F est affiché
// 11 000 F sur RAMCI. Le client paie 11 000, le commerçant touche 10 000,
// la plateforme garde 1 000.
//
//     prix affiché = prix commerçant × (1 + taux)
//     part commerçant = prix affiché ÷ (1 + taux)
//
// À ne pas confondre avec « 10 % du prix affiché », qui donnerait 9 900 au
// commerçant sur un article à 11 000 — 100 F d'écart par article, invisible
// à l'œil nu et faux sur chaque vente.
//
// Tout est en francs CFA : pas de centimes, donc arrondi à l'entier.

export const TAUX_COMMISSION = 0.10;

/**
 * Répartit un montant encaissé entre le commerçant et la plateforme.
 *
 * L'arrondi est calculé sur la part du commerçant, puis la commission est
 * déduite par SOUSTRACTION. C'est ce qui garantit que les deux parts
 * retombent toujours exactement sur le montant encaissé — arrondir les deux
 * séparément ferait apparaître ou disparaître 1 F par ligne.
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
 * Prix à AFFICHER pour qu'un commerçant touche le montant qu'il souhaite.
 * Utile côté formulaire produit : le commerçant saisit ce qu'il veut
 * gagner, on lui montre le prix qui sera affiché aux clients.
 */
export const prixAffichePourNet = (montantSouhaite, taux = TAUX_COMMISSION) =>
    Math.round(Math.max(0, Number(montantSouhaite) || 0) * (1 + taux));
