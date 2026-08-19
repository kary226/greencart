import Boutique from '../models/Boutique.js';
import { acteurDepuisRequete } from './authActeur.js';

// Droit de CRÉER un article, accordé boutique par boutique par l'admin.
//
// Placé en middleware, et surtout AVANT le traitement de l'upload : sans ça,
// un commerçant non autorisé envoie ses photos, le serveur les charge en
// mémoire, les téléverse éventuellement — et seulement ensuite on lui dit
// non. Refuser tôt épargne la bande passante du commerçant et la mémoire du
// serveur, et c'est déjà la logique retenue pour requireBoutiqueActive.
//
// Ne concerne que les commerçants : un admin (staff ou compte vendeur) crée
// toujours librement.
const requireDroitCreation = async (req, res, next) => {
    try {
        const acteur = acteurDepuisRequete(req);
        if (!acteur || acteur.role !== 'commercant') return next();

        if (!acteur.boutiqueId) {
            return res.status(400).json({
                success: false,
                message: "Vous n'avez pas de boutique. Contactez l'administrateur.",
            });
        }

        const boutique = await Boutique.findById(acteur.boutiqueId).select('peutCreerProduits');
        if (!boutique?.peutCreerProduits) {
            return res.status(403).json({
                success: false,
                creationNonAutorisee: true,
                message: "L'ajout d'articles n'est pas activé pour votre boutique. Contactez l'administrateur.",
            });
        }

        next();
    } catch (error) {
        console.error('Erreur requireDroitCreation:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export default requireDroitCreation;
