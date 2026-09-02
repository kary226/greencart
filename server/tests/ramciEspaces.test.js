import { describe, it } from 'node:test';
import assert from 'node:assert';

import { ROLES, permissionsDuRole, libelleDuRole, TOUTES_PERMISSIONS } from '../configs/roles.js';

/**
 * CHAQUE RÔLE ATTEINT SON ESPACE
 * ==============================
 *
 * Un rôle peut avoir la bonne permission côté serveur et aucun lien pour
 * arriver à l'écran correspondant. C'est arrivé quatre fois :
 *
 *   · Admin Entrepôt   — droit de scanner, entrepôt rangé sous une rubrique
 *                        conditionnée à `deliveries.view` qu'il n'a pas ;
 *   · Admin Finance    — rapprochement et « fonds à libérer » reliés à
 *                        aucune rubrique ;
 *   · Admin Opérations — pouvait remonter une exception sans pouvoir
 *                        ouvrir l'écran qui les liste ;
 *   · Auditeur         — le journal, sa seule raison d'être, rangé sous
 *                        « Administration » qu'il ne voit pas.
 *
 * Ce test rejoue la construction du menu et vérifie qu'aucune permission ne
 * pointe vers un écran hors d'atteinte. La table MENU ci-dessous doit rester
 * le reflet de client/src/components/SuperAdminLayout.jsx.
 */

// Recopié de client/src/components/SuperAdminLayout.jsx
const MENU = [
    { titre: 'À faire', chemin: '/admin/console', droit: null },
    { titre: 'Tableau de bord', chemin: '/admin/dashboard', droit: 'admin.dashboard' },
    { titre: 'Commandes', entrees: [
        { chemin: '/admin/orders', droit: 'orders.view' },
        { chemin: '/admin/commandes', droit: 'orders.approve' },
        { chemin: '/admin/orders?tab=disputes', droit: 'disputes.view' },
    ]},
    { titre: 'Entrepôt & retours', entrees: [
        { chemin: '/admin/warehouse', droit: ['warehouse.scan', 'orders.receive'] },
        { chemin: '/admin/returns', droit: 'returns.view' },
    ]},
    { titre: 'Livraisons', entrees: [
        { chemin: '/admin/deliveries', droit: 'deliveries.view' },
        { chemin: '/admin/locations', droit: 'delivery_zones.configure' },
    ]},
    { titre: 'Catalogue', entrees: [
        { chemin: '/admin/products', droit: 'catalog.view' },
        { chemin: '/admin/categories', droit: 'catalog.categories' },
        { chemin: '/admin/banners', droit: 'catalog.banners' },
        { chemin: '/admin/coupons', droit: 'catalog.coupons' },
    ]},
    { titre: 'Réseau', entrees: [
        { chemin: '/admin/clients', droit: 'clients.view' },
        { chemin: '/admin/boutiques', droit: ['shop.view', 'clients.view'] },
    ]},
    { titre: 'Finance', entrees: [
        { chemin: '/admin/wallets', droit: 'wallet.view' },
        { chemin: '/admin/withdrawals', droit: 'withdrawals.view' },
        { chemin: '/admin/refunds', droit: 'refunds.view' },
        { chemin: '/admin/rcoins', droit: 'rcoins.view' },
        { chemin: '/admin/reconciliation', droit: 'finance.reconcile' },
    ]},
    { titre: 'Exceptions', chemin: '/admin/approvals', droit: 'exceptions.view' },
    { titre: 'Journal', chemin: '/admin/audit', droit: 'audit.view' },
    { titre: 'Colis SHEIN', chemin: '/admin/colis-shein', droit: 'shein.view' },
    { titre: 'Administration', entrees: [
        { chemin: '/admin/settings', droit: 'admin.configure' },
        { chemin: '/admin/staff', droit: 'admin.configure' },
    ]},
];

/** L'écran où chaque permission s'exerce. `null` = action contextuelle. */
const ECRAN = {
    'admin.dashboard': '/admin/dashboard',
    'admin.configure': '/admin/settings',
    'orders.view': '/admin/orders', 'orders.edit': '/admin/orders',
    'orders.confirm': '/admin/orders', 'orders.approve': '/admin/commandes',
    'orders.receive': '/admin/warehouse', 'orders.ship': '/admin/orders',
    'orders.mark_delivered': '/admin/orders',
    'warehouse.scan': '/admin/warehouse', 'warehouse.inspect': '/admin/warehouse',
    'returns.view': '/admin/returns', 'returns.inspect': '/admin/returns', 'returns.decide': '/admin/returns',
    'deliveries.view': '/admin/deliveries', 'deliveries.assign': '/admin/deliveries',
    'deliveries.configure': '/admin/deliveries',
    'delivery_zones.view': '/admin/deliveries', 'delivery_zones.configure': '/admin/locations',
    'catalog.view': '/admin/products', 'catalog.create': '/admin/products',
    'catalog.edit': '/admin/products', 'catalog.delete': '/admin/products',
    'catalog.questions': '/admin/products', 'catalog.categories': '/admin/categories',
    'catalog.banners': '/admin/banners', 'catalog.coupons': '/admin/coupons',
    'clients.view': '/admin/clients', 'clients.edit': '/admin/clients',
    'shop.view': '/admin/boutiques', 'shop.edit': '/admin/boutiques',
    'wallet.view': '/admin/wallets', 'wallet.adjust': '/admin/wallets',
    'wallet.transactions': '/admin/wallets', 'commission.view': '/admin/wallets',
    'withdrawals.view': '/admin/withdrawals', 'withdrawals.process': '/admin/withdrawals',
    'withdrawals.approve': '/admin/withdrawals', 'withdrawals.reject': '/admin/withdrawals',
    'refunds.view': '/admin/refunds', 'refunds.approve': '/admin/refunds', 'refunds.create': '/admin/refunds',
    'rcoins.view': '/admin/rcoins', 'rcoins.adjust': '/admin/rcoins',
    'finance.reconcile': '/admin/reconciliation',
    'exceptions.view': '/admin/approvals', 'exceptions.decide': '/admin/approvals',
    'audit.view': '/admin/audit', 'audit.export': '/admin/audit',
    'disputes.view': '/admin/orders?tab=disputes', 'disputes.respond': '/admin/orders?tab=disputes',
    'disputes.open': '/admin/returns',
    'shein.view': '/admin/colis-shein', 'shein.update': '/admin/colis-shein',
    // Actions contextuelles : pas d'écran dédié
    'admin.all': null, 'exceptions.request': null,
    'orders.view_own': null, 'wallet.view_own': null, 'withdrawals.request': null,
    'products.create': null, 'products.edit': null, 'products.delete': null,
    'deliveries.view_own': null, 'deliveries.update_status': null,
};


const ROLES_CONSOLE = ['super_admin', 'finance_admin', 'operations_admin', 'catalog_admin',
                       'read_only_auditor', 'warehouse_admin', 'logistics_admin', 'support_admin'];

/** Le menu tel qu'il s'affichera pour ces permissions. */
const menuPour = (perms) => {
    const a = (d) => {
        if (!d) return true;
        if (perms.includes('admin.all')) return true;
        return (Array.isArray(d) ? d : [d]).some((x) => perms.includes(x));
    };
    return MENU
        .map((r) => r.entrees
            ? { titre: r.titre, entrees: r.entrees.filter((e) => a(e.droit)) }
            : (a(r.droit) ? { titre: r.titre, entrees: [{ chemin: r.chemin }] } : null))
        .filter((r) => r && r.entrees.length > 0);
};

describe('Console — chaque rôle atteint son espace', () => {

    it('toutes les permissions du catalogue sont cartographiées', () => {
        // Sans ce garde-fou, une permission ajoutée demain échapperait
        // silencieusement à l'audit ci-dessous.
        const oubliees = TOUTES_PERMISSIONS.filter((p) => !(p in ECRAN));
        assert.deepStrictEqual(oubliees, [], `Permissions sans écran connu : ${oubliees.join(', ')}`);
    });

    for (const role of ROLES_CONSOLE) {
        it(`${libelleDuRole(role)} atteint tous ses écrans`, () => {
            const perms = permissionsDuRole(role);
            const atteignables = new Set(menuPour(perms).flatMap((r) => r.entrees.map((e) => e.chemin)));

            const inatteignables = [...new Set(
                perms.map((p) => ECRAN[p]).filter((e) => e && !atteignables.has(e))
            )];

            assert.deepStrictEqual(inatteignables, [],
                `${role} a le droit d'utiliser ces écrans mais aucun lien n'y mène : ${inatteignables.join(', ')}`);
        });
    }

    it('chaque rôle voit au moins sa page « À faire »', () => {
        for (const role of ROLES_CONSOLE) {
            const rubriques = menuPour(permissionsDuRole(role));
            assert.ok(rubriques.some((r) => r.titre === 'À faire'), `${role} n'a pas de page d'accueil`);
        }
    });

    it('aucune rubrique vide n’est affichée', () => {
        for (const role of ROLES_CONSOLE) {
            for (const rubrique of menuPour(permissionsDuRole(role))) {
                assert.ok(rubrique.entrees.length > 0,
                    `${role} : la rubrique « ${rubrique.titre} » s'affiche sans aucune entrée`);
            }
        }
    });

    it('un rôle sans aucun droit ne voit que « À faire »', () => {
        const rubriques = menuPour([]);
        assert.deepStrictEqual(rubriques.map((r) => r.titre), ['À faire']);
    });
});
