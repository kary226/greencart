/**
 * LES ESPACES DE LA CONSOLE
 * =========================
 *
 * Une seule table décrit qui a le droit d'aller où. Elle sert à DEUX choses,
 * et c'est tout l'intérêt de la centraliser :
 *
 *   1. construire le menu — on n'affiche que ce que le compte peut utiliser ;
 *   2. garder les routes — taper l'URL à la main ne suffit pas à entrer.
 *
 * Sans cette seconde garde, masquer une rubrique ne protégeait rien : l'écran
 * s'affichait quand même à qui connaissait l'adresse. Il se remplissait mal
 * (le serveur, lui, refusait les données), mais l'utilisateur se retrouvait
 * devant une page en erreur au lieu d'un refus clair.
 *
 * À RETENIR : cette table ne SÉCURISE rien. La protection réelle est côté
 * serveur (server/middlewares/permission.js), qui refuse chaque appel d'API.
 * Ici on ne fait qu'éviter d'afficher, et de proposer, ce qui ne servira pas.
 */

/**
 * `droit` : une permission, ou une liste (il suffit d'en avoir une).
 * `null` : accessible à tout compte staff connecté.
 */
export const MENU = [
    { titre: "À faire", icone: "ListChecks", chemin: "/admin/console", droit: null },
    { titre: "Tableau de bord", icone: "LayoutDashboard", chemin: "/admin/dashboard", droit: "admin.dashboard" },

    {
        titre: "Commandes", icone: "ShoppingBag", entrees: [
            { label: "Toutes les commandes", chemin: "/admin/orders", droit: "orders.view" },
            // Commandes réceptionnées dont les fonds attendent d'être
            // libérés : du travail Finance, relié à aucune rubrique jusqu'ici.
            { label: "Fonds à libérer", chemin: "/admin/commandes", droit: "orders.approve" },
            { label: "Litiges", chemin: "/admin/orders?tab=disputes", droit: "disputes.view" },
        ],
    },
    {
        titre: "Entrepôt & retours", icone: "PackageCheck", entrees: [
            { label: "Entrepôt", chemin: "/admin/warehouse", droit: ["warehouse.scan", "orders.receive"] },
            { label: "Retours", chemin: "/admin/returns", droit: "returns.view" },
        ],
    },
    {
        titre: "Livraisons", icone: "Truck", entrees: [
            { label: "Livraisons", chemin: "/admin/deliveries", droit: "deliveries.view" },
            { label: "Villes & communes", chemin: "/admin/locations", droit: "delivery_zones.configure" },
        ],
    },
    {
        titre: "Catalogue", icone: "Tags", entrees: [
            { label: "Produits", chemin: "/admin/products", droit: "catalog.view" },
            { label: "Catégories", chemin: "/admin/categories", droit: "catalog.categories" },
            { label: "Bannières", chemin: "/admin/banners", droit: "catalog.banners" },
            { label: "Codes promo", chemin: "/admin/coupons", droit: "catalog.coupons" },
        ],
    },
    {
        titre: "Réseau", icone: "Users", entrees: [
            { label: "Clients", chemin: "/admin/clients", droit: "clients.view" },
            { label: "Commerçants & boutiques", chemin: "/admin/boutiques", droit: ["shop.view", "clients.view"] },
        ],
    },
    {
        titre: "Finance", icone: "Wallet", entrees: [
            { label: "Portefeuilles", chemin: "/admin/wallets", droit: "wallet.view" },
            { label: "Retraits", chemin: "/admin/withdrawals", droit: "withdrawals.view" },
            { label: "Remboursements", chemin: "/admin/refunds", droit: "refunds.view" },
            { label: "RCOINS", chemin: "/admin/rcoins", droit: "rcoins.view" },
            { label: "Rapprochement", chemin: "/admin/reconciliation", droit: "finance.reconcile" },
        ],
    },

    { titre: "Exceptions", icone: "ShieldAlert", chemin: "/admin/approvals", droit: "exceptions.view" },
    { titre: "Journal", icone: "ScrollText", chemin: "/admin/audit", droit: "audit.view" },
    { titre: "Colis SHEIN", icone: "ShoppingCart", chemin: "/admin/colis-shein", droit: "shein.view" },

    {
        titre: "Administration", icone: "Settings", entrees: [
            { label: "Paramètres", chemin: "/admin/settings", droit: "admin.configure" },
            { label: "Comptes staff", chemin: "/admin/staff", droit: "admin.configure" },
        ],
    },
];

/**
 * Droit exigé par chaque route, y compris celles qui n'ont pas d'entrée de
 * menu (formulaires, sous-pages, alias). Les chemins les plus précis
 * d'abord : la recherche s'arrête au premier préfixe qui correspond.
 *
 * Une route absente de cette table est refusée par défaut plutôt
 * qu'autorisée : un écran ajouté demain sans y être déclaré se signalera
 * tout de suite, au lieu de s'ouvrir discrètement à tout le monde.
 */
const DROITS_PAR_ROUTE = [
    ['/admin/products/add', ['catalog.create', 'catalog.edit']],
    ['/admin/products/edit', ['catalog.edit']],
    ['/admin/products', ['catalog.view']],
    ['/admin/categories', ['catalog.categories']],
    ['/admin/banners', ['catalog.banners']],
    ['/admin/coupons', ['catalog.coupons']],

    ['/admin/commandes', ['orders.approve']],
    ['/admin/orders', ['orders.view']],

    ['/admin/warehouse', ['warehouse.scan', 'orders.receive']],
    ['/admin/returns', ['returns.view']],

    ['/admin/deliveries', ['deliveries.view']],
    ['/admin/locations', ['delivery_zones.configure']],

    ['/admin/clients', ['clients.view']],
    ['/admin/boutiques', ['shop.view', 'clients.view']],

    ['/admin/wallets', ['wallet.view']],
    // `retraits` est l'alias francisé de `withdrawals` : même écran, même droit.
    ['/admin/withdrawals', ['withdrawals.view']],
    ['/admin/retraits', ['withdrawals.view']],
    ['/admin/refunds', ['refunds.view']],
    ['/admin/rcoins', ['rcoins.view']],
    ['/admin/reconciliation', ['finance.reconcile']],

    ['/admin/approvals', ['exceptions.view']],
    ['/admin/audit', ['audit.view']],
    ['/admin/colis-shein', ['shein.view']],

    ['/admin/settings', ['admin.configure']],
    ['/admin/staff', ['admin.configure']],

    ['/admin/dashboard', ['admin.dashboard']],
];

/**
 * Les seules adresses ouvertes à tout compte staff. Comparées à l'IDENTIQUE,
 * jamais par préfixe : une entrée `/admin` en fin de table servait de
 * fourre-tout et rouvrait toutes les routes inconnues — exactement ce que la
 * règle « refus par défaut » cherche à empêcher.
 */
const ROUTES_OUVERTES = ['/admin', '/admin/console'];

/**
 * Quel droit faut-il pour cette adresse ?
 * @returns {string[]|null} liste de droits (il suffit d'en avoir un),
 *                          ou `null` si la route est ouverte à tout le staff.
 */
export const droitsPourChemin = (chemin) => {
    const propre = (chemin || '').split('?')[0].replace(/\/+$/, '') || '/admin';

    if (ROUTES_OUVERTES.includes(propre)) return null;

    const trouve = DROITS_PAR_ROUTE.find(([prefixe]) =>
        propre === prefixe || propre.startsWith(prefixe + '/')
    );

    // Route inconnue : on refuse. Voir le commentaire de DROITS_PAR_ROUTE.
    return trouve ? trouve[1] : ['admin.all'];
};

/**
 * Ce compte a-t-il ce droit ? Même règle que le serveur
 * (server/middlewares/permission.js) — sans quoi l'écran masquerait des
 * pages que le serveur autorise, ou l'inverse.
 */
export const aLeDroit = (role, permissions = [], droit) => {
    if (!droit) return true;
    if (role === 'super_admin' || role === 'admin') return true;
    if (permissions.includes('admin.all')) return true;
    return (Array.isArray(droit) ? droit : [droit]).some((d) => permissions.includes(d));
};

/** Le menu réellement affichable : entrées filtrées, rubriques vides retirées. */
export const menuPour = (role, permissions = []) =>
    MENU
        .map((rubrique) => {
            if (!rubrique.entrees) {
                return aLeDroit(role, permissions, rubrique.droit) ? rubrique : null;
            }
            const entrees = rubrique.entrees.filter((e) => aLeDroit(role, permissions, e.droit));
            return entrees.length > 0 ? { ...rubrique, entrees } : null;
        })
        .filter(Boolean);

/** Première page que ce compte a le droit d'ouvrir — cible d'une redirection. */
export const premierEcran = (role, permissions = []) => {
    const menu = menuPour(role, permissions);
    const premiere = menu[0];
    if (!premiere) return '/admin/console';
    return premiere.entrees ? premiere.entrees[0].chemin : premiere.chemin;
};
