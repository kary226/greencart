import jwt from 'jsonwebtoken';
import StaffUser from '../models/StaffUser.js';
import { TYPE_STAFF, verifierType } from '../utils/jwtTypes.js';

// authStaff vérifie qu'une personne est bien connectée en tant que
// compte staff (admin / commercant / livreur / assistant_shein), quel
// que soit son rôle précis, et attache le compte trouvé à req.staffUser.
// Utiliser ensuite requireRole(...) pour restreindre une route à des
// rôles précis.
const authStaff = async (req, res, next) => {
    // Cookie séparé de 'token' (client) et de 'sellerToken' (ancien compte
    // vendeur unique), pour ne jamais mélanger les sessions.
    const token = req.cookies?.staffToken
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Non authentifié - Token manquant'
        });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if (!tokenDecode?.id) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié - Token invalide'
            });
        }

        // [SÉCURITÉ] Jusqu'ici, seule la recherche dans la collection
        // StaffUser empêchait un jeton client d'ouvrir l'espace staff — une
        // protection de fait, pas de conception. Le type est maintenant
        // vérifié explicitement (voir utils/jwtTypes.js).
        if (!verifierType(tokenDecode, TYPE_STAFF)) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié - Session invalide pour cet espace'
            });
        }

        const staffUser = await StaffUser.findById(tokenDecode.id).select('-password -totpSecret');

        if (!staffUser) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié - Compte introuvable'
            });
        }

        if (staffUser.statut !== 'actif') {
            return res.status(403).json({
                success: false,
                message: 'Ce compte est suspendu'
            });
        }

        req.staffUser = staffUser;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié - Token invalide'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expirée - Veuillez vous reconnecter'
            });
        }
        console.error('Erreur authStaff:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Middleware factory : restreint l'accès à une liste de rôles précis.
// À utiliser APRÈS authStaff sur une route.
// Exemple : staffRouter.get('/comptes', authStaff, requireRole('admin'), listStaffAccounts)
export const requireRole = (...rolesAutorises) => {
    return (req, res, next) => {
        if (!req.staffUser) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié'
            });
        }
        if (!rolesAutorises.includes(req.staffUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Rôle insuffisant'
            });
        }
        next();
    };
};

export default authStaff;