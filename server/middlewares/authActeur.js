import jwt from 'jsonwebtoken';
import StaffUser from '../models/StaffUser.js';
import { TYPE_STAFF, TYPE_VENDEUR, verifierType } from '../utils/jwtTypes.js';
import { erreurAuthentification, erreurAcces } from '../utils/AppError.js';

// Point d'entrée unique pour les espaces d'administration.
//
// Le projet a hérité de DEUX comptes d'administration qui font le même
// métier : le compte technique « vendeur » (identifiants dans le .env,
// cookie `sellerToken`) et le compte staff de rôle `admin` (en base, avec
// 2FA, cookie `staffToken`). Résultat, chaque fonctionnalité existait en
// double — /add et /staff/add, /stock et /staff/stock — et les contrôleurs
// se terminaient tous par un branchement `req.staffUser` / `req.isTechnicalSeller`.
// Chaque doublon est un endroit où un correctif s'applique d'un côté et
// s'oublie de l'autre.
//
// Ce middleware accepte les deux sessions et les normalise en un seul
// `req.acteur`. Les contrôleurs n'ont plus qu'une forme à connaître.
//
// [COMPATIBILITÉ] `req.staffUser` et `req.isTechnicalSeller` restent posés
// tels quels : tout le code existant continue de fonctionner à l'identique.
// C'est ce qui rend cette étape sûre — la suppression du compte technique
// est une décision séparée, à faire en conditions réelles.

const lireJeton = (req, nomCookie) =>
    req.cookies?.[nomCookie]
    || (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

/**
 * Forme normalisée d'un compte d'administration.
 * @typedef {object} Acteur
 * @property {'staff'|'vendeur_technique'} type   d'où vient la session
 * @property {string|null} id                     identifiant StaffUser, null pour le compte technique
 * @property {string} role                        admin | commercant | livreur | assistant_shein
 * @property {string|null} boutiqueId             renseigné pour un commerçant
 * @property {string} nom
 */

const acteurDepuisStaff = (staffUser) => ({
    type: 'staff',
    id: staffUser._id,
    role: staffUser.role,
    boutiqueId: staffUser.boutiqueId || null,
    nom: staffUser.nom,
});

// Le compte technique a exactement les pouvoirs d'un admin : le déclarer
// ainsi permet aux contrôleurs de ne raisonner que sur des rôles.
const acteurVendeurTechnique = () => ({
    type: 'vendeur_technique',
    id: null,
    role: 'admin',
    boutiqueId: null,
    nom: 'Compte vendeur',
});

const authActeur = async (req, res, next) => {
    try {
        // Le jeton staff est examiné en premier : c'est le système cible.
        const jetonStaff = lireJeton(req, 'staffToken');
        if (jetonStaff) {
            try {
                const decode = jwt.verify(jetonStaff, process.env.JWT_SECRET);
                if (decode?.id && verifierType(decode, TYPE_STAFF)) {
                    const staffUser = await StaffUser.findById(decode.id).select('-password -totpSecret');
                    if (staffUser && staffUser.statut === 'actif') {
                        req.staffUser = staffUser;          // compatibilité
                        req.acteur = acteurDepuisStaff(staffUser);
                        return next();
                    }
                }
            } catch (_) {
                // Jeton staff invalide : on laisse sa chance au jeton vendeur
                // plutôt que de refuser tout de suite — un navigateur peut
                // porter un vieux cookie staff expiré ET une session vendeur
                // parfaitement valide.
            }
        }

        const jetonVendeur = lireJeton(req, 'sellerToken');
        if (jetonVendeur) {
            try {
                const decode = jwt.verify(jetonVendeur, process.env.JWT_SECRET);
                if (verifierType(decode, TYPE_VENDEUR) && decode.email === process.env.SELLER_EMAIL) {
                    req.isTechnicalSeller = true;           // compatibilité
                    req.acteur = acteurVendeurTechnique();
                    return next();
                }
            } catch (_) { /* jeton vendeur invalide */ }
        }

        return next(erreurAuthentification('Non authentifié — session absente ou expirée'));
    } catch (error) {
        next(error);
    }
};

/**
 * Restreint une route à certains rôles, quelle que soit la session d'origine.
 * À utiliser APRÈS authActeur.
 */
export const requireRoleActeur = (...rolesAutorises) => (req, res, next) => {
    if (!req.acteur) return next(erreurAuthentification());
    if (!rolesAutorises.includes(req.acteur.role)) {
        return next(erreurAcces('Accès refusé — rôle insuffisant'));
    }
    next();
};

export default authActeur;
