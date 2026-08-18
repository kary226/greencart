import jwt from 'jsonwebtoken';
import StaffUser from '../models/StaffUser.js';
import { TYPE_STAFF, verifierType } from '../utils/jwtTypes.js';

// Authentification staff OPTIONNELLE, pour les routes publiques qui doivent
// se comporter différemment quand c'est le staff qui regarde.
//
// Cas d'usage : /api/product/list sert à la fois la vitrine (qui ne doit
// pas voir les boutiques suspendues) et l'espace commerçant (qui doit
// continuer à voir SES propres articles, même boutique suspendue). Un
// visiteur sans cookie passe simplement au travers, jamais d'erreur 401.
const attachStaffOptionnel = async (req, res, next) => {
    const token = req.cookies?.staffToken
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    if (!token) return next();

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        if (!tokenDecode?.id || !verifierType(tokenDecode, TYPE_STAFF)) return next();

        const staffUser = await StaffUser.findById(tokenDecode.id).select('-password -totpSecret');
        if (staffUser && staffUser.statut === 'actif') {
            req.staffUser = staffUser;
            // La réponse dépend désormais de la session : elle ne doit plus
            // atterrir dans un cache partagé (edge Vercel, proxy).
            res.set('Cache-Control', 'private, no-store');
        }
    } catch (_) {
        // Jeton absent, expiré ou invalide : on sert la version publique.
    }

    next();
};

export default attachStaffOptionnel;
