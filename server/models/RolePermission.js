import mongoose from "mongoose";
import { NOMS_ROLES } from "../configs/roles.js";

/**
 * Modèle central des permissions associées à chaque rôle.
 * Un rôle peut avoir plusieurs permissions (ex: 'catalog.create', 'wallet.view').
 * Cela permet de remplacer le rôle plat 'admin' par des permissions granulaires.
 * 
 * Exemple d'utilisation :
 *   - Le rôle 'catalog_admin' aura les permissions : 'catalog.view', 'catalog.create', 'catalog.edit'
 *   - Le rôle 'finance_admin' aura : 'wallet.view', 'wallet.adjust', 'withdrawals.approve'
 */
const rolePermissionSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        unique: true,
        // Liste unique : configs/roles.js (guide RAMCI §3, §16).
        enum: NOMS_ROLES,
    },
    permissions: {
        type: [String],
        default: [],
        // Exemples : ['catalog.view', 'catalog.create', 'wallet.adjust', 'orders.ship']
    },
}, { timestamps: true });

const RolePermission = mongoose.models.rolepermission ||
    mongoose.model('rolepermission', rolePermissionSchema);

export default RolePermission;