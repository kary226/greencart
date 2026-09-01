import RolePermission from '../models/RolePermission.js';
import { PERMISSIONS, permissionsDuRole, ROLES_ARBITRE } from '../configs/roles.js';

/**
 * PERMISSIONS  —  Guide RAMCI §16
 * ===============================
 * « Le rôle décrit la personne ; la permission décrit l'action. »
 * « Le frontend masque ; le backend protège réellement. »
 *
 * Une route ne demande jamais « êtes-vous finance_admin ? » mais
 * « avez-vous le droit de traiter un retrait ? ». C'est ce qui permet au
 * Super Admin d'intervenir partout (§1) sans qu'on ait à le lister dans
 * chaque route, et à une petite équipe de cumuler des domaines sans
 * multiplier les comptes (§13).
 */

/**
 * Charge les permissions d'un compte staff, par ordre de priorité :
 *
 *   1. permissions sur mesure posées sur le compte (StaffUser.permissions) ;
 *   2. permissions du rôle enregistrées en base (RolePermission) ;
 *   3. permissions du rôle définies dans le code (configs/roles.js).
 *
 * L'étape 3 est le correctif important : sans elle, un rôle ajouté au code
 * (operations_admin) restait sans AUCUN droit tant que le seed n'avait pas
 * tourné — un compte parfaitement valide qui se prend un 403 sur tout, sans
 * message exploitable. Le code fait désormais foi par défaut, la base ne
 * sert qu'à personnaliser.
 *
 * @param {Object} staffUser compte staff ({ role, permissions? })
 * @returns {Promise<string[]>}
 */
export const loadPermissions = async (staffUser) => {
    if (staffUser?.permissions && staffUser.permissions.length > 0) {
        return staffUser.permissions;
    }

    const rolePerm = await RolePermission.findOne({ role: staffUser?.role });
    if (rolePerm?.permissions?.length) return rolePerm.permissions;

    // Repli sur la définition du code.
    return permissionsDuRole(staffUser?.role);
};

/**
 * Le compte a-t-il ce droit ? Fonction PURE, testable sans base — c'est
 * elle qui porte la règle, les middlewares ne font que l'appliquer.
 *
 * `admin.all` et les rôles arbitres passent partout : §1, « le Super Admin
 * a l'autorité finale sur l'ensemble du système ».
 */
export const aLeDroit = (staffUser, permission) => {
    if (!staffUser) return false;
    if (ROLES_ARBITRE.includes(staffUser.role)) return true;
    const perms = staffUser.permissions || [];
    return perms.includes(PERMISSIONS.ADMIN_ALL) || perms.includes(permission);
};

/** Variante « au moins un de ces droits ». */
export const aUnDesDroits = (staffUser, permissions = []) => {
    if (!staffUser) return false;
    if (ROLES_ARBITRE.includes(staffUser.role)) return true;
    const perms = staffUser.permissions || [];
    if (perms.includes(PERMISSIONS.ADMIN_ALL)) return true;
    return permissions.some((p) => perms.includes(p));
};

/** Fabrique commune aux deux middlewares : évite d'écrire deux fois la même chose. */
const gardien = (permissions, verifier, messageRefus) => {
    return async (req, res, next) => {
        if (!req.staffUser) {
            return res.status(401).json({ success: false, message: 'Non authentifié' });
        }

        if (!req.staffUser.permissions) {
            req.staffUser.permissions = await loadPermissions(req.staffUser);
        }

        if (verifier(req.staffUser, permissions)) return next();

        return res.status(403).json({
            success: false,
            message: messageRefus,
            required: permissions,
        });
    };
};

/**
 * Middleware : exige une permission précise.
 *   router.patch('/retraits/:id', authStaff, requirePermission('withdrawals.process'), traiter)
 */
export const requirePermission = (permission) =>
    gardien(permission, aLeDroit, 'Accès refusé - Permission manquante');

/**
 * Middleware : exige au moins une des permissions listées.
 * Utile quand plusieurs domaines légitimes accèdent au même écran (§13).
 */
export const requireAnyPermission = (permissions) =>
    gardien(permissions, aUnDesDroits, 'Accès refusé - Aucune des permissions requises');

/**
 * Middleware : réservé aux arbitres du système (§1, §4, §12).
 * Le seul endroit où l'on vérifie encore une identité plutôt qu'une action,
 * parce que « trancher une exception » n'est pas un droit délégable.
 */
export const requireArbitre = (req, res, next) => {
    if (!req.staffUser) {
        return res.status(401).json({ success: false, message: 'Non authentifié' });
    }
    const perms = req.staffUser.permissions || [];
    const estArbitre = ROLES_ARBITRE.includes(req.staffUser.role)
        || perms.includes(PERMISSIONS.ADMIN_ALL)
        || perms.includes(PERMISSIONS.EXCEPTIONS_DECIDE);

    if (!estArbitre) {
        return res.status(403).json({
            success: false,
            message: "Décision réservée au Super Admin",
            required: [PERMISSIONS.EXCEPTIONS_DECIDE],
        });
    }
    next();
};
