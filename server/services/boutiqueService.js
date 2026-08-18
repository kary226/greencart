import Boutique from '../models/Boutique.js';
import StaffUser from '../models/StaffUser.js';
import Wallet from '../models/Wallet.js';
import { withCache, invalidateCache, CACHE_KEYS } from '../configs/redisCache.js';

// Tout ce qui touche au cycle de vie d'une boutique passe par ici, pour que
// l'activation d'une invitation, la promotion d'un compte en commerçant et
// l'ouverture de l'espace commerçant produisent EXACTEMENT le même état.
// Avant, chaque endroit recréait sa propre logique : un commerçant dont la
// création de boutique avait échoué (ou un compte créé avant la Phase 3)
// restait bloqué sur « Aucune boutique associée », sans aucun moyen de s'en
// sortir côté commerçant.

/**
 * Garantit qu'un compte commerçant a bien SA boutique et SON portefeuille.
 * Idempotent : appelable autant de fois qu'on veut, à l'activation comme à
 * chaque chargement de l'espace commerçant (auto-réparation des comptes
 * anciens ou à moitié créés).
 *
 * Le contenu de la boutique (nom définitif, description, logo, zones de
 * livraison) reste saisi par le commerçant lui-même : on ne crée ici que la
 * coquille, avec un nom provisoire.
 *
 * @returns {Promise<Boutique|null>} la boutique, ou null si le compte n'est
 *          pas un commerçant.
 */
export const assurerBoutiqueCommercant = async (staffUser) => {
    if (!staffUser || staffUser.role !== 'commercant') return null;

    let boutique = await Boutique.findOne({ ownerId: staffUser._id });

    if (!boutique) {
        try {
            boutique = await Boutique.create({
                nom: `Boutique de ${staffUser.nom}`,
                ownerId: staffUser._id,
                statut: 'active',
            });
        } catch (error) {
            // ownerId est unique : si deux requêtes créent la boutique en
            // même temps (double onglet, retry réseau), l'une des deux perd
            // la course — on récupère simplement celle qui a gagné.
            if (error.code === 11000) {
                boutique = await Boutique.findOne({ ownerId: staffUser._id });
            } else {
                throw error;
            }
        }
    }

    // Le compte doit pointer vers sa boutique : c'est ce boutiqueId que
    // lisent les contrôleurs produits/coupons pour cloisonner les données.
    if (boutique && staffUser.boutiqueId?.toString() !== boutique._id.toString()) {
        await StaffUser.updateOne({ _id: staffUser._id }, { boutiqueId: boutique._id });
        staffUser.boutiqueId = boutique._id;
    }

    const walletExistant = await Wallet.findOne({ ownerId: staffUser._id });
    if (!walletExistant) {
        try {
            await Wallet.create({ ownerId: staffUser._id, solde: 0 });
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
    }

    return boutique;
};

/**
 * Identifiants (string) des boutiques à masquer du catalogue public.
 *
 * Deux causes, volontairement traitées ensemble ici plutôt que synchronisées
 * dans les deux sens entre les collections :
 *   - la boutique elle-même a été suspendue par l'admin ;
 *   - le COMPTE du commerçant n'est plus actif (suspendu / en attente) — il
 *     ne peut plus se connecter, ses articles ne doivent pas continuer à se
 *     vendre sans personne pour les expédier.
 *
 * Mis en cache 60 s : lu sur chaque page du catalogue, modifié seulement par
 * une action d'admin, qui invalide explicitement le cache juste après.
 */
export const getIdsBoutiquesSuspendues = async () => {
    const ids = await withCache(CACHE_KEYS.boutiquesSuspendues, 60, async () => {
        const commercantsActifs = await StaffUser.find({
            role: 'commercant',
            statut: 'actif',
        }).select('_id').lean();
        const idsActifs = commercantsActifs.map((c) => c._id);

        // Raisonner en « propriétaire toujours commerçant actif ? » plutôt
        // qu'en « compte suspendu ? » couvre aussi les cas de bord : compte
        // passé à un autre rôle, propriétaire supprimé, boutique orpheline.
        const boutiques = await Boutique.find({
            $or: [
                { statut: 'suspendue' },
                { ownerId: { $nin: idsActifs } },
            ],
        }).select('_id').lean();

        return boutiques.map((b) => b._id.toString());
    });
    return Array.isArray(ids) ? ids : [];
};

export const invaliderCacheBoutiquesSuspendues = async () => {
    // Les meilleures ventes sont calculées puis mises en cache avec le
    // filtre déjà appliqué : sans cette seconde invalidation, un article
    // d'une boutique suspendue resterait en page d'accueil jusqu'à 5 min.
    await invalidateCache(CACHE_KEYS.boutiquesSuspendues, CACHE_KEYS.bestSellers);
};

/**
 * Complète un filtre Mongo de catalogue public pour masquer les produits
 * des boutiques suspendues. Les produits de l'admin (boutiqueId null)
 * restent évidemment visibles.
 */
export const appliquerFiltreBoutiquesActives = async (filter = {}) => {
    const suspendues = await getIdsBoutiquesSuspendues();
    if (suspendues.length === 0) return filter;

    // Si un boutiqueId précis est déjà demandé et qu'il est suspendu, on
    // renvoie un filtre impossible plutôt que de contredire la demande.
    if (filter.boutiqueId && suspendues.includes(filter.boutiqueId.toString())) {
        return { ...filter, _id: null };
    }
    if (filter.boutiqueId) return filter;

    return { ...filter, boutiqueId: { $nin: suspendues } };
};
