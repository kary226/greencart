import RolePermission from '../models/RolePermission.js';

/**
 * Charge les permissions d'un utilisateur à partir de son rôle.
 * Si l'utilisateur a des permissions personnalisées (champ 'permissions' dans StaffUser),
 * on les utilise directement. Sinon, on va chercher les permissions du rôle dans RolePermission.
 * 
 * @param {Object} staffUser - l'utilisateur staff (doit avoir un champ 'role' et éventuellement 'permissions')
 * @returns {Promise<string[]>} - tableau des permissions
 */
export const loadPermissions = async (staffUser) => {
    // Si l'utilisateur a déjà des permissions stockées directement (champ sur mesure), on les utilise
    if (staffUser.permissions && staffUser.permissions.length > 0) {
        return staffUser.permissions;
    }
    // Sinon, charger depuis RolePermission via son rôle
    const rolePerm = await RolePermission.findOne({ role: staffUser.role });
    return rolePerm ? rolePerm.permissions : [];
};

/**
 * Middleware : vérifie que l'utilisateur possède la permission requise.
 * Utilisé APRÈS authStaff pour restreindre l'accès à une route.
 * 
 * Exemple :
 *   router.get('/admin/wallet', authStaff, requirePermission('wallet.view'), getWallet)
 * 
 * @param {string} permission - la permission à vérifier (ex: 'wallet.adjust')
 * @returns {Function} middleware Express
 */
export const requirePermission = (permission) => {
    return async (req, res, next) => {
        if (!req.staffUser) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié'
            });
        }

        // Charger les permissions si elles ne le sont pas encore
        if (!req.staffUser.permissions) {
            req.staffUser.permissions = await loadPermissions(req.staffUser);
        }

        // [FIX] 'admin.all' est un passe-droit total, pas seulement pour le
        // rôle super_admin : seedRolePermissions.js et assignPermissions.js
        // attribuent aussi 'admin.all' au rôle legacy 'admin' (avant la
        // Phase 1, seul rôle admin existant, conservé pour compatibilité),
        // mais seul le bypass sur le rôle littéral 'super_admin' était
        // implémenté ici. Un compte 'admin' — ou même 'super_admin' passé
        // par une route qui vérifiait le rôle plutôt que la permission
        // (ex. authActeur/requireRoleActeur('admin'), qui n'acceptait QUE
        // le rôle littéral 'admin', pas 'super_admin') — pouvait donc se
        // retrouver bloqué par requirePermission malgré 'admin.all'. Voir
        // routes/orderRoute.js (migration du 23 août 2026).
        if (req.staffUser.role === 'super_admin' || req.staffUser.permissions.includes('admin.all')) {
            return next();
        }

        // Vérifier la permission exacte
        if (!req.staffUser.permissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Permission manquante',
                required: permission,
            });
        }

        next();
    };
};

/**
 * Middleware : vérifie que l'utilisateur possède l'une des permissions listées.
 * Utile quand plusieurs rôles peuvent accéder à la même route.
 * 
 * Exemple :
 *   router.get('/orders', authStaff, requireAnyPermission(['orders.view', 'orders.view_own']), listOrders)
 * 
 * @param {string[]} permissions - liste des permissions autorisées
 * @returns {Function} middleware Express
 */
export const requireAnyPermission = (permissions) => {
    return async (req, res, next) => {
        if (!req.staffUser) {
            return res.status(401).json({
                success: false,
                message: 'Non authentifié'
            });
        }

        if (!req.staffUser.permissions) {
            req.staffUser.permissions = await loadPermissions(req.staffUser);
        }

        // [FIX] Voir le commentaire équivalent dans requirePermission ci-dessus.
        if (req.staffUser.role === 'super_admin' || req.staffUser.permissions.includes('admin.all')) {
            return next();
        }

        const hasPermission = permissions.some(p => req.staffUser.permissions.includes(p));
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé - Aucune des permissions requises',
                required: permissions,
            });
        }

        next();
    };
};