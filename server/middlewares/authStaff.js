import jwt from 'jsonwebtoken';
import StaffUser from '../models/StaffUser.js';

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
        return res.json({ success: false, message: 'Not Authorized - Token manquant' });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if (!tokenDecode?.id) {
            return res.json({ success: false, message: 'Not Authorized - Token invalide' });
        }

        const staffUser = await StaffUser.findById(tokenDecode.id).select('-password -totpSecret');

        if (!staffUser) {
            return res.json({ success: false, message: 'Not Authorized - Compte introuvable' });
        }

        if (staffUser.statut !== 'actif') {
            return res.json({ success: false, message: 'Ce compte est suspendu' });
        }

        req.staffUser = staffUser;
        next();
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Middleware factory : restreint l'accès à une liste de rôles précis.
// À utiliser APRÈS authStaff sur une route.
// Exemple : staffRouter.get('/comptes', authStaff, requireRole('admin'), listStaffAccounts)
export const requireRole = (...rolesAutorises) => {
    return (req, res, next) => {
        if (!req.staffUser) {
            return res.json({ success: false, message: 'Not Authorized' });
        }
        if (!rolesAutorises.includes(req.staffUser.role)) {
            return res.json({ success: false, message: "Accès refusé pour ce rôle" });
        }
        next();
    };
};

export default authStaff;