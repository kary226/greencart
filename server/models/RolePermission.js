import mongoose from "mongoose";

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
        // Liste des rôles possibles (nouveaux + existants)
        enum: [
            // Nouveaux rôles introduits par la Phase 1
            'super_admin',         // tous les droits, remplace le compte 'seller' à terme
            'finance_admin',       // portefeuilles, retraits, remboursements, RCOINS
            'warehouse_admin',     // entrepôt, scans, retours
            'logistics_admin',     // livraisons, livreurs, zones
            'catalog_admin',       // produits, bannières, catégories, coupons
            'support_admin',       // clients, commandes (lecture + actions limitées), litiges
            'read_only_auditor',   // lecture/export sur tous les modules
            // Rôles existants (conservés pour compatibilité)
            'admin',               // sera progressivement remplacé par les nouveaux rôles
            'commercant',
            'livreur',
            'assistant_shein',
        ],
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