/**
 * SOURCE UNIQUE DES RÔLES ET PERMISSIONS  —  Guide RAMCI §3, §16
 * ==============================================================
 *
 * Avant ce fichier, la liste des rôles était recopiée à quatre endroits
 * (StaffUser.js, RolePermission.js, seedRolePermissions.js,
 * seedWarehouseRoles.js) et la liste des permissions n'existait nulle part :
 * une permission mal orthographiée dans une route ne se voyait qu'en
 * production, sous la forme d'un 403 inexplicable. Tout part désormais d'ici.
 *
 * DEUX NOTIONS DISTINCTES (§16) :
 *   - le RÔLE décrit la personne  ("Admin Opérations") ;
 *   - la PERMISSION décrit l'action ("returns.decide").
 * Les routes protègent des ACTIONS, jamais des personnes. Un rôle n'est
 * qu'un paquet de permissions nommé.
 *
 * QUATRE DOMAINES + L'ARBITRE (§2, §3) :
 *   FINANCE     — argent et mouvements financiers
 *   OPERATIONS  — collecte, réception, livraison, retour physique
 *   SUPPORT     — client, réclamations, dossiers
 *   CATALOGUE   — produits, bannières, catégories
 *   SUPER ADMIN — supervise tout, tranche les exceptions (§1, §4)
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. CATALOGUE DES PERMISSIONS
// ─────────────────────────────────────────────────────────────────────────
//
// Toute permission utilisée dans une route DOIT figurer ici. C'est ce qui
// permet au test `roles.test.js` de refuser une permission inventée.

export const PERMISSIONS = {
    // Passe-droit total. Réservé au Super Admin (§1 : autorité finale).
    ADMIN_ALL: 'admin.all',
    ADMIN_DASHBOARD: 'admin.dashboard',
    ADMIN_CONFIGURE: 'admin.configure',

    // ── Finance ─────────────────────────────────────────────────────────
    WALLET_VIEW: 'wallet.view',
    WALLET_ADJUST: 'wallet.adjust',
    WALLET_TRANSACTIONS: 'wallet.transactions',
    WITHDRAWALS_VIEW: 'withdrawals.view',
    WITHDRAWALS_PROCESS: 'withdrawals.process',   // §9 : traiter un retrait normal, seul
    WITHDRAWALS_APPROVE: 'withdrawals.approve',   // conservé (compat) = process
    WITHDRAWALS_REJECT: 'withdrawals.reject',
    WITHDRAWALS_REQUEST: 'withdrawals.request',
    REFUNDS_VIEW: 'refunds.view',
    REFUNDS_CREATE: 'refunds.create',
    REFUNDS_APPROVE: 'refunds.approve',
    RCOINS_VIEW: 'rcoins.view',
    RCOINS_ADJUST: 'rcoins.adjust',
    COMMISSION_VIEW: 'commission.view',
    FINANCE_RECONCILE: 'finance.reconcile',

    // ── Opérations ──────────────────────────────────────────────────────
    WAREHOUSE_SCAN: 'warehouse.scan',
    WAREHOUSE_INSPECT: 'warehouse.inspect',
    ORDERS_VIEW: 'orders.view',
    ORDERS_VIEW_OWN: 'orders.view_own',
    ORDERS_EDIT: 'orders.edit',
    ORDERS_CONFIRM: 'orders.confirm',
    ORDERS_RECEIVE: 'orders.receive',             // §7 : réception entrepôt
    ORDERS_SHIP: 'orders.ship',
    ORDERS_MARK_DELIVERED: 'orders.mark_delivered',
    ORDERS_APPROVE: 'orders.approve',
    DELIVERIES_VIEW: 'deliveries.view',
    DELIVERIES_VIEW_OWN: 'deliveries.view_own',
    DELIVERIES_ASSIGN: 'deliveries.assign',
    DELIVERIES_CONFIGURE: 'deliveries.configure',
    DELIVERIES_UPDATE_STATUS: 'deliveries.update_status',
    DELIVERY_ZONES_VIEW: 'delivery_zones.view',
    DELIVERY_ZONES_CONFIGURE: 'delivery_zones.configure',
    RETURNS_VIEW: 'returns.view',
    RETURNS_INSPECT: 'returns.inspect',
    RETURNS_DECIDE: 'returns.decide',

    // ── Support ─────────────────────────────────────────────────────────
    CLIENTS_VIEW: 'clients.view',
    CLIENTS_EDIT: 'clients.edit',
    DISPUTES_VIEW: 'disputes.view',
    DISPUTES_RESPOND: 'disputes.respond',
    DISPUTES_OPEN: 'disputes.open',

    // ── Catalogue ───────────────────────────────────────────────────────
    CATALOG_VIEW: 'catalog.view',
    CATALOG_CREATE: 'catalog.create',
    CATALOG_EDIT: 'catalog.edit',
    CATALOG_DELETE: 'catalog.delete',
    CATALOG_BANNERS: 'catalog.banners',
    CATALOG_CATEGORIES: 'catalog.categories',
    CATALOG_COUPONS: 'catalog.coupons',
    CATALOG_QUESTIONS: 'catalog.questions',

    // ── Exceptions et audit (§13, §16) ──────────────────────────────────
    //
    // EXCEPTIONS_DECIDE est LE droit rare : il tranche ce que les règles
    // normales ne couvrent pas. Le donner à un rôle, c'est en faire un
    // Super Admin de fait — d'où sa séparation de tout le reste.
    EXCEPTIONS_VIEW: 'exceptions.view',
    EXCEPTIONS_REQUEST: 'exceptions.request',
    EXCEPTIONS_DECIDE: 'exceptions.decide',
    AUDIT_VIEW: 'audit.view',
    AUDIT_EXPORT: 'audit.export',

    // ── Commerçant / livreur / assistant ────────────────────────────────
    SHOP_VIEW: 'shop.view',
    SHOP_EDIT: 'shop.edit',
    PRODUCTS_CREATE: 'products.create',
    PRODUCTS_EDIT: 'products.edit',
    PRODUCTS_DELETE: 'products.delete',
    WALLET_VIEW_OWN: 'wallet.view_own',
    SHEIN_VIEW: 'shein.view',
    SHEIN_UPDATE: 'shein.update',
};

/** Toutes les permissions valides, à plat. */
export const TOUTES_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const P = PERMISSIONS;

// ─────────────────────────────────────────────────────────────────────────
// 2. LES RÔLES
// ─────────────────────────────────────────────────────────────────────────
//
// `domaine` est ce que le frontend utilise pour choisir l'écran d'accueil
// (§14 : « chaque acteur doit d'abord voir ce qu'il doit faire maintenant »).
// `libelle` est le seul nom affiché : plus aucun écran ne dit « Seller » (§0).

export const ROLES = {
    // ── L'arbitre (§1, §4) ──────────────────────────────────────────────
    super_admin: {
        libelle: 'Super Admin',
        domaine: 'direction',
        description: "Autorité finale sur l'ensemble du système. Supervise, tranche les exceptions et les conflits.",
        permissions: [P.ADMIN_ALL],
    },

    // ── Finance (§8, §9, §11) ───────────────────────────────────────────
    finance_admin: {
        libelle: 'Admin Finance',
        domaine: 'finance',
        description: 'Portefeuilles, retraits, remboursements, rapprochement.',
        permissions: [
            P.ADMIN_DASHBOARD,
            P.WALLET_VIEW, P.WALLET_ADJUST, P.WALLET_TRANSACTIONS,
            P.WITHDRAWALS_VIEW, P.WITHDRAWALS_PROCESS, P.WITHDRAWALS_APPROVE, P.WITHDRAWALS_REJECT,
            P.REFUNDS_VIEW, P.REFUNDS_CREATE, P.REFUNDS_APPROVE,
            P.RCOINS_VIEW, P.RCOINS_ADJUST,
            P.COMMISSION_VIEW, P.FINANCE_RECONCILE,
            P.ORDERS_VIEW, P.ORDERS_APPROVE,
            // Finance constate une anomalie mais ne tranche pas seule (§3) :
            // elle peut DEMANDER une exception, pas la décider.
            P.EXCEPTIONS_VIEW, P.EXCEPTIONS_REQUEST,
        ],
    },

    // ── Opérations (§7, §10) ────────────────────────────────────────────
    //
    // NOUVEAU. Le guide ne connaît qu'un domaine « Opérations » : collecte,
    // réception, livraison, retour physique. Le code le découpait en
    // warehouse_admin + logistics_admin, ce qui obligeait une petite équipe
    // à ouvrir deux comptes pour un seul métier (§13 : « sans obliger une
    // petite équipe à multiplier les comptes administrateurs »).
    // Les deux rôles d'origine restent définis plus bas pour les comptes
    // déjà créés.
    operations_admin: {
        libelle: 'Admin Opérations',
        domaine: 'operations',
        description: 'Collecte, réception, livraison et retours physiques.',
        permissions: [
            P.ADMIN_DASHBOARD,
            P.WAREHOUSE_SCAN, P.WAREHOUSE_INSPECT,
            P.ORDERS_VIEW, P.ORDERS_RECEIVE, P.ORDERS_SHIP, P.ORDERS_MARK_DELIVERED,
            P.DELIVERIES_VIEW, P.DELIVERIES_ASSIGN, P.DELIVERIES_CONFIGURE,
            P.DELIVERY_ZONES_VIEW, P.DELIVERY_ZONES_CONFIGURE,
            P.RETURNS_VIEW, P.RETURNS_INSPECT, P.RETURNS_DECIDE,
            P.EXCEPTIONS_VIEW, P.EXCEPTIONS_REQUEST,
        ],
    },

    // ── Support (§10, §12) ──────────────────────────────────────────────
    support_admin: {
        libelle: 'Admin Support',
        domaine: 'support',
        description: 'Clients, réclamations, ouverture et suivi des litiges.',
        permissions: [
            P.ADMIN_DASHBOARD,
            P.CLIENTS_VIEW, P.CLIENTS_EDIT,
            P.ORDERS_VIEW, P.ORDERS_EDIT,
            P.DISPUTES_VIEW, P.DISPUTES_RESPOND, P.DISPUTES_OPEN,
            P.RETURNS_VIEW,
            P.REFUNDS_VIEW,
            P.EXCEPTIONS_VIEW, P.EXCEPTIONS_REQUEST,
        ],
    },

    // ── Catalogue ───────────────────────────────────────────────────────
    catalog_admin: {
        libelle: 'Admin Catalogue',
        domaine: 'catalogue',
        description: 'Produits, bannières, catégories, coupons.',
        permissions: [
            P.ADMIN_DASHBOARD,
            P.CATALOG_VIEW, P.CATALOG_CREATE, P.CATALOG_EDIT, P.CATALOG_DELETE,
            P.CATALOG_BANNERS, P.CATALOG_CATEGORIES, P.CATALOG_COUPONS,
            P.CATALOG_QUESTIONS,
        ],
    },

    // ── Auditeur (§3 : voit et contrôle, ne modifie pas) ─────────────────
    read_only_auditor: {
        libelle: 'Auditeur',
        domaine: 'audit',
        description: 'Contrôle et consultation. Aucune modification.',
        permissions: [
            P.ADMIN_DASHBOARD,
            P.AUDIT_VIEW, P.AUDIT_EXPORT,
            P.WALLET_VIEW, P.ORDERS_VIEW, P.CATALOG_VIEW,
            P.RETURNS_VIEW, P.REFUNDS_VIEW, P.WITHDRAWALS_VIEW,
            P.EXCEPTIONS_VIEW,
        ],
    },

    // ── Rôles d'origine, conservés pour les comptes existants ───────────
    //
    // warehouse_admin et logistics_admin sont les deux moitiés de
    // operations_admin. On ne les supprime pas : des comptes les portent.
    warehouse_admin: {
        libelle: 'Admin Entrepôt',
        domaine: 'operations',
        description: 'Entrepôt, scans, réception des retours. (Sous-ensemble de Admin Opérations.)',
        deprecie: 'operations_admin',
        permissions: [
            P.ADMIN_DASHBOARD,
            P.WAREHOUSE_SCAN, P.WAREHOUSE_INSPECT,
            P.RETURNS_VIEW, P.RETURNS_INSPECT, P.RETURNS_DECIDE,
            P.ORDERS_VIEW, P.ORDERS_RECEIVE,
            P.EXCEPTIONS_VIEW, P.EXCEPTIONS_REQUEST,
        ],
    },
    logistics_admin: {
        libelle: 'Admin Logistique',
        domaine: 'operations',
        description: 'Livraisons, livreurs, zones. (Sous-ensemble de Admin Opérations.)',
        deprecie: 'operations_admin',
        permissions: [
            P.ADMIN_DASHBOARD,
            P.DELIVERIES_VIEW, P.DELIVERIES_ASSIGN, P.DELIVERIES_CONFIGURE,
            P.DELIVERY_ZONES_VIEW, P.DELIVERY_ZONES_CONFIGURE,
            P.ORDERS_VIEW, P.ORDERS_SHIP, P.ORDERS_MARK_DELIVERED,
            P.EXCEPTIONS_VIEW, P.EXCEPTIONS_REQUEST,
        ],
    },

    // `admin` est l'ancien compte tout-puissant. Il garde admin.all pour ne
    // casser aucun accès existant, mais son libellé ne dit plus « Seller » :
    // les écrans affichent « Super Admin » (§0, convention de nommage).
    admin: {
        libelle: 'Super Admin',
        domaine: 'direction',
        description: 'Ancien compte central. À migrer vers super_admin.',
        deprecie: 'super_admin',
        permissions: [P.ADMIN_ALL],
    },

    // ── Acteurs externes ────────────────────────────────────────────────
    commercant: {
        libelle: 'Commerçant',
        domaine: 'commercant',
        description: 'Articles à confirmer, portefeuille, retraits.',
        permissions: [
            P.SHOP_VIEW, P.SHOP_EDIT,
            P.PRODUCTS_CREATE, P.PRODUCTS_EDIT, P.PRODUCTS_DELETE,
            P.ORDERS_VIEW_OWN, P.ORDERS_CONFIRM,
            P.WITHDRAWALS_REQUEST,
            P.WALLET_VIEW_OWN,
        ],
    },
    livreur: {
        libelle: 'Livreur',
        domaine: 'livreur',
        description: 'Collectes et livraisons.',
        permissions: [P.DELIVERIES_VIEW_OWN, P.DELIVERIES_UPDATE_STATUS],
    },
    assistant_shein: {
        libelle: 'Assistant SHEIN',
        domaine: 'shein',
        description: 'Colis SHEIN.',
        permissions: [P.SHEIN_VIEW, P.SHEIN_UPDATE],
    },
};

/** Liste des rôles valides — utilisée par les enum Mongoose. */
export const NOMS_ROLES = Object.freeze(Object.keys(ROLES));

/** Rôles du staff interne (par opposition aux acteurs externes). */
export const ROLES_STAFF = Object.freeze(
    NOMS_ROLES.filter((r) => !['commercant', 'livreur', 'assistant_shein'].includes(r))
);

/**
 * Rôles autorisés à trancher une exception (§1, §4, §12, §20).
 * Volontairement court : c'est le point de décision finale du système.
 */
export const ROLES_ARBITRE = Object.freeze(['super_admin', 'admin']);

/** Permissions par défaut d'un rôle (tableau vide si le rôle est inconnu). */
export const permissionsDuRole = (role) => ROLES[role]?.permissions ?? [];

/** Libellé affichable d'un rôle. Ne renvoie jamais « Seller ». */
export const libelleDuRole = (role) => ROLES[role]?.libelle ?? role ?? '—';

/** Domaine métier d'un rôle : sert à choisir l'écran d'accueil (§14). */
export const domaineDuRole = (role) => ROLES[role]?.domaine ?? 'inconnu';

/**
 * Un rôle possède-t-il une permission ? `admin.all` est un passe-droit
 * total (§1) : le Super Admin n'a pas à être listé partout.
 */
export const roleADroit = (role, permission) => {
    const perms = permissionsDuRole(role);
    return perms.includes(PERMISSIONS.ADMIN_ALL) || perms.includes(permission);
};

/** Table { role: [permissions] } prête pour un seed en base. */
export const tablePermissions = () =>
    Object.fromEntries(NOMS_ROLES.map((role) => [role, permissionsDuRole(role)]));

export default ROLES;
