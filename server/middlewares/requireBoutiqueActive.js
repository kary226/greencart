import Boutique from '../models/Boutique.js';

// À utiliser APRÈS authStaff sur les routes où un commerçant PUBLIE ou
// MODIFIE quelque chose de visible par les clients (produits, coupons,
// demandes de retrait).
//
// Une boutique suspendue par l'admin n'est pas un compte suspendu : le
// commerçant peut toujours se connecter, consulter ses ventes passées et
// corriger les informations de sa boutique — mais il ne peut plus alimenter
// le catalogue tant que la suspension n'est pas levée.
//
// Les autres rôles (admin notamment) traversent ce middleware sans effet.
const requireBoutiqueActive = async (req, res, next) => {
    try {
        if (!req.staffUser || req.staffUser.role !== 'commercant') return next();

        const boutique = await Boutique.findOne({ ownerId: req.staffUser._id }).select('statut');

        if (!boutique) {
            return res.status(403).json({
                success: false,
                message: "Aucune boutique n'est encore associée à votre compte. Ouvrez « Ma boutique » pour la configurer.",
            });
        }

        if (boutique.statut === 'suspendue') {
            return res.status(403).json({
                success: false,
                message: 'Votre boutique est suspendue par l\'administrateur. Cette action est indisponible.',
                boutiqueSuspendue: true,
            });
        }

        req.boutique = boutique;
        next();
    } catch (error) {
        console.error('Erreur requireBoutiqueActive:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export default requireBoutiqueActive;
