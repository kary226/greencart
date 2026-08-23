import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";
import { Menu, X as CloseIcon, LogOut } from "lucide-react";

/**
 * SuperAdminLayout – Layout unifié de la console d'administration.
 *
 * Fusion des anciens espaces seller et staff/admin.
 * Les permissions sont chargées depuis le serveur (authStaff + loadPermissions)
 * et le menu s'adapte dynamiquement.
 *
 * Le menu est structuré en 8 rubriques principales :
 *   - Tableau de bord
 *   - Opérations (commandes, retours, litiges)
 *   - Catalogue (produits, catégories, bannières, coupons)
 *   - Réseau (clients, commerçants, boutiques)
 *   - Logistique (livraisons, zones, entrepôt)
 *   - Finance (portefeuilles, retraits, remboursements, approbations)
 *   - RCOINS
 *   - Administration (paramètres, seuils, comptes staff, journal)
 */
const SuperAdminLayout = () => {
    const { axios, navigate } = useAppContext();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [staffUser, setStaffUser] = useState(null);
    const [permissions, setPermissions] = useState([]);

    // Fermer le tiroir automatiquement dès qu'on navigue
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // Empêcher le scroll derrière le tiroir
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [sidebarOpen]);

    // Charger les informations du staff connecté et ses permissions
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (data.success) {
                    setStaffUser(data.staffUser);
                    setPermissions(data.staffUser?.permissions || []);
                }
            } catch (error) {
                console.error('Erreur chargement staff:', error);
            }
        };
        fetchStaff();
    }, []);

    // Vérifier si l'utilisateur a une permission donnée
    const hasAccess = (permission) => {
        if (staffUser?.role === 'super_admin') return true;
        return permissions.includes(permission);
    };

    // Structure du menu avec permissions
    const menuSections = [
        {
            title: "Tableau de bord",
            icon: "📊",
            path: "/admin/dashboard",
            visible: true,
        },
        {
            title: "Opérations",
            icon: "📦",
            path: "/admin/orders",
            visible: hasAccess("orders.view"),
            subItems: [
                { label: "Commandes", path: "/admin/orders" },
                { label: "Retours", path: "/admin/returns" },
                { label: "Litiges", path: "/admin/orders?tab=disputes" },
            ],
        },
        {
            title: "Catalogue",
            icon: "🏷️",
            path: "/admin/products",
            visible: hasAccess("catalog.view"),
            subItems: [
                { label: "Produits", path: "/admin/products" },
                { label: "Ajouter un produit", path: "/admin/products/add" },
                { label: "Catégories", path: "/admin/categories" },
                { label: "Bannières", path: "/admin/banners" },
                { label: "Codes promo", path: "/admin/coupons" },
            ],
        },
        {
            title: "Réseau",
            icon: "👥",
            path: "/admin/clients",
            visible: hasAccess("clients.view"),
            subItems: [
                { label: "Clients", path: "/admin/clients" },
                { label: "Commerçants", path: "/admin/staff" },
                { label: "Boutiques", path: "/admin/boutiques" },
            ],
        },
        {
            title: "Logistique",
            icon: "🚚",
            path: "/admin/deliveries",
            visible: hasAccess("deliveries.view"),
            subItems: [
                { label: "Livraisons", path: "/admin/deliveries" },
                { label: "Zones & tarifs", path: "/admin/deliveries" },
                { label: "Entrepôt", path: "/admin/warehouse" },
            ],
        },
        {
            title: "Finance",
            icon: "💰",
            path: "/admin/withdrawals",
            visible: hasAccess("wallet.view"),
            subItems: [
                { label: "Portefeuilles", path: "/admin/withdrawals" },
                { label: "Retraits", path: "/admin/withdrawals" },
                { label: "Remboursements", path: "/admin/refunds" },
                { label: "Approbations", path: "/admin/approvals" },
            ],
        },
        {
            title: "RCOINS",
            icon: "🪙",
            path: "/admin/rcoins",
            visible: hasAccess("rcoins.view"),
            subItems: [
                { label: "Solde clients", path: "/admin/rcoins" },
                { label: "Transactions", path: "/admin/rcoins/transactions" },
            ],
        },
        {
            title: "Colis SHEIN",
            icon: "🛍️",
            path: "/admin/colis-shein",
            visible: hasAccess("shein.view"),
        },
        {
            title: "Administration",
            icon: "⚙️",
            path: "/admin/settings",
            visible: hasAccess("admin.configure"),
            subItems: [
                { label: "Paramètres", path: "/admin/settings" },
                { label: "Seuils d'approbation", path: "/admin/settings/thresholds" },
                { label: "Comptes staff", path: "/admin/staff" },
                { label: "Journal d'audit", path: "/admin/audit" },
            ],
        },
    ];

    const filteredMenu = menuSections.filter(section => section.visible);

    const logout = async () => {
        try {
            await axios.get('/api/staff/logout');
            toast.success('Déconnexion réussie');
            navigate('/staff/login');
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header collant */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-6 border-b border-gray-200 py-3 sm:py-4 bg-white sticky top-0 z-30">
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition -ml-1"
                        aria-label="Ouvrir le menu"
                    >
                        <Menu size={22} />
                    </button>
                    <Link to="/" className="shrink-0">
                        <img src="/logo.png" alt="logo" className="h-6 sm:h-8 w-auto" />
                    </Link>
                    <span className="text-sm font-semibold text-gray-700 ml-2 hidden sm:block">
                        Console Super Admin
                    </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {staffUser?.role === 'super_admin' ? 'SA' : 'A'}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                            {staffUser?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </span>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-2.5 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                    >
                        <LogOut size={16} />
                        <span className="hidden sm:inline">Déconnexion</span>
                    </button>
                </div>
            </div>

            {/* Sidebar + Content */}
            <div className="flex">
                {/* Overlay mobile */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar : tiroir mobile / colonne fixe dès lg */}
                <div
                    className={`
                        fixed lg:sticky inset-y-0 lg:top-[65px] left-0 z-40 lg:z-0
                        w-72 lg:w-64 bg-white border-r border-gray-200
                        h-screen lg:h-[calc(100vh-65px)] flex flex-col
                        transition-transform duration-200 ease-out
                        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
                    `}
                >
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 lg:hidden">
                        <span className="text-sm font-semibold text-gray-900">Menu</span>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition"
                            aria-label="Fermer le menu"
                        >
                            <CloseIcon size={18} />
                        </button>
                    </div>
                    <nav className="flex-1 py-4 overflow-y-auto">
                        {filteredMenu.map((section) => {
                            const hasSubItems = section.subItems && section.subItems.length > 0;
                            const isActive = location.pathname.startsWith(section.path) ||
                                (hasSubItems && section.subItems.some(sub => location.pathname.startsWith(sub.path)));

                            return (
                                <div key={section.path} className="mb-1">
                                    {hasSubItems ? (
                                        <>
                                            <div
                                                className={`
                                                    flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all duration-200
                                                    ${isActive ? "bg-red-50 text-red-500" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}
                                                `}
                                            >
                                                <span className="w-5 h-5 flex items-center justify-center shrink-0 text-base">
                                                    {section.icon}
                                                </span>
                                                <span>{section.title}</span>
                                            </div>
                                            <div className="ml-4 mt-1 space-y-0.5">
                                                {section.subItems.map((sub) => (
                                                    <NavLink
                                                        key={sub.path}
                                                        to={sub.path}
                                                        className={({ isActive }) => `
                                                            flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-all duration-200
                                                            ${isActive
                                                                ? "bg-red-50 text-red-500 font-medium"
                                                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                                            }
                                                        `}
                                                    >
                                                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                                                        <span>{sub.label}</span>
                                                    </NavLink>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <NavLink
                                            to={section.path}
                                            className={({ isActive }) => `
                                                flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all duration-200
                                                ${isActive
                                                    ? "bg-red-50 text-red-500"
                                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                                }
                                            `}
                                        >
                                            <span className="w-5 h-5 flex items-center justify-center shrink-0 text-base">
                                                {section.icon}
                                            </span>
                                            <span>{section.title}</span>
                                        </NavLink>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                    <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                        Version 6.0 • {staffUser?.role || 'Admin'}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 overflow-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default SuperAdminLayout;