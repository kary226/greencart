import jwt from 'jsonwebtoken';
import StaffUser from '../models/StaffUser.js';
import { TYPE_STAFF, verifierType } from '../utils/jwtTypes.js';
import { loadPermissions } from './permission.js';

/**
 * Middleware d'authentification pour les comptes staff.
 * 
 * Vérifie la présence d'un token staff (cookie 'staffToken' ou header Authorization)
 * et charge l'utilisateur correspondant depuis la base de données.
 * 
 * Ajoute à la requête :
 *   - req.staffUser : l'utilisateur staff (sans password ni totpSecret)
 *   - req.staffUser.permissions : les permissions chargées (via loadPermissions)
 * 
 * Utiliser ensuite requirePermission() ou requireAnyPermission() pour restreindre l'accès.
 */
const authStaff = async (req, res, next) => {
    // Récupération du token depuis le cookie ou le header Authorization
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

        // Vérification du type de token (TYPE_STAFF vs TYPE_CLIENT)
        if (!verifierType(tokenDecode, TYPE_STAFF)) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié - Session invalide pour cet espace'
            });
        }

        // Chargement de l'utilisateur depuis la base
        const staffUser = await StaffUser.findById(tokenDecode.id).select('-password -totpSecret');

        if (!staffUser) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié - Compte introuvable'
            });
        }

        // Vérification du statut du compte
        if (staffUser.statut !== 'actif') {
            return res.status(403).json({
                success: false,
                message: 'Ce compte est suspendu'
            });
        }

        // [PHASE 1] Charger les permissions de l'utilisateur
        staffUser.permissions = await loadPermissions(staffUser);

        // Attacher l'utilisateur à la requête
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

/**
 * Middleware de compatibilité : vérifie le rôle de l'utilisateur.
 * Déprécié progressivement au profit de requirePermission().
 * 
 * Exemple (à remplacer) :
 *   router.get('/admin', authStaff, requireRole('admin'), ...)
 */
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