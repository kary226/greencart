import JournalAction from '../models/JournalAction.js';

// Écriture du journal des actions.
//
// Règle absolue : journaliser ne doit JAMAIS faire échouer l'action
// journalisée. Si l'écriture de la trace tombe, on log l'incident et
// l'opération métier continue — perdre une ligne de journal est ennuyeux,
// perdre la suppression que l'utilisateur vient de confirmer l'est bien
// davantage.

/**
 * Réduit un produit à ce qu'il faut retenir pour comprendre une action après
 * coup : de quoi l'identifier, et de quoi mesurer ce qui a été perdu.
 */
export const apercuProduit = (produit) => ({
    sku: produit?.sku || null,
    prix: produit?.offerPrice ?? produit?.price ?? null,
    stock: produit?.stock ?? null,
    nombreImages: Array.isArray(produit?.image) ? produit.image.length : null,
    origine: produit?.origine || null,
});

/**
 * Enregistre une action. Volontairement non attendue par les appelants
 * (« fire and forget ») : voir la règle ci-dessus.
 *
 * @param {object} params
 * @param {object|null} params.acteur   acteur normalisé (authActeur.js)
 * @param {string} params.action        valeur de l'énumération du modèle
 * @param {object} [params.cible]       { id, libelle }
 * @param {string} [params.boutiqueId]
 * @param {object} [params.apercu]
 * @param {string} [params.note]
 */
export const journaliser = async ({ acteur, action, cible = {}, boutiqueId = null, apercu = {}, note = '' }) => {
    try {
        await JournalAction.create({
            acteurId: acteur?.id || null,
            acteurNom: acteur?.nom || '—',
            acteurRole: acteur?.role || 'inconnu',
            action,
            cibleId: cible.id || null,
            cibleLibelle: cible.libelle || '',
            boutiqueId: boutiqueId || null,
            apercu,
            note,
        });
    } catch (error) {
        console.error('[journal] Écriture impossible:', error.message);
    }
};

export default journaliser;
