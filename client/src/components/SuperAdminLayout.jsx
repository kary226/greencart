import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";
import { Menu, X as CloseIcon, Home, Package, ShoppingCart, Users, Truck, Wallet, Coins, Settings, Shield, LogOut } from "lucide-react";

const SuperAdminLayout = () => {
    const { axios, navigate, logoutUser, user, staffUser } = useAppContext();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isStaff, setIsStaff] = useState(false);
    const [staffRole, setStaffRole] = useState(null);
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

    // Vérifier si l'utilisateur est un staff (admin/super_admin)
    useEffect(() => {
        const checkStaff = async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (data.success) {
                    setIsStaff(true);
                    setStaffRole(data.staffUser?.role || 'admin');
                    setPermissions(data.staffUser?.permissions || []);
                }
            } catch (error) {
                setIsStaff(false);
            }
        };
        checkStaff();
    }, []);

    // Déterminer si l'utilisateur a accès à une section
    const hasAccess = (permission) => {
        if (staffRole === 'super_admin') return true;
        return permissions.includes(permission);
    };

    const menuSections = [
        {
            title: "Tableau de bord",
            icon: Home,
            path: "/admin/dashboard",
            permission: "admin.dashboard",
            visible: true,
        },
        {
            title: "Opérations",
            icon: ShoppingCart,
            path: "/admin/orders",
            permission: "orders.view",
            visible: hasAccess("orders.view"),
            subItems: [
                { label: "Commandes", path: "/admin/orders" },
                { label: "Retours", path: "/admin/returns" },
                { label: "Litiges", path: "/admin/disputes" },
            ],
        },
        {
            title: "Catalogue",
            icon: Package,
            path: "/admin/products",
            permission: "catalog.view",
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
            icon: Users,
            path: "/admin/clients",
            permission: "clients.view",
            visible: hasAccess("clients.view"),
            subItems: [
                { label: "Clients", path: "/admin/clients" },
                { label: "Commerçants", path: "/admin/sellers" },
                { label: "Boutiques", path: "/admin/boutiques" },
            ],
        },
        {
            title: "Logistique",
            icon: Truck,
            path: "/admin/deliveries",
            permission: "deliveries.view",
            visible: hasAccess("deliveries.view"),
            subItems: [
                { label: "Livraisons", path: "/admin/deliveries" },
                { label: "Livreurs", path: "/admin/delivery-drivers" },
                { label: "Zones & tarifs", path: "/admin/delivery-zones" },
            ],
        },
        {
            title: "Finance",
            icon: Wallet,
            path: "/admin/finance",
            permission: "wallet.view",
            visible: hasAccess("wallet.view"),
            subItems: [
                { label: "Portefeuilles", path: "/admin/wallets" },
                { label: "Transactions", path: "/admin/transactions" },
                { label: "Retraits", path: "/admin/withdrawals" },
                { label: "Remboursements", path: "/admin/refunds" },
            ],
        },
        {
            title: "RCOINS",
            icon: Coins,
            path: "/admin/rcoins",
            permission: "rcoins.view",
            visible: hasAccess("rcoins.view"),
            subItems: [
                { label: "Solde clients", path: "/admin/rcoins" },
                { label: "Transactions", path: "/admin/rcoins/transactions" },
            ],
        },
        {
            title: "Administration",
            icon: Settings,
            path: "/admin/settings",
            permission: "admin.configure",
            visible: hasAccess("admin.configure"),
            subItems: [
                { label: "Paramètres généraux", path: "/admin/settings" },
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
            setIsStaff(false);
            toast.success('Déconnexion réussie');
            navigate('/staff/login');
        } catch (error) {
            toast.error(error.message);
        }
    };

    const getIcon = (IconComponent) => (
        <IconComponent size={20} strokeWidth={1.8} />
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
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
                            {staffRole === 'super_admin' ? 'SA' : 'A'}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                            {staffRole === 'super_admin' ? 'Super Admin' : 'Admin'}
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

                {/* Sidebar */}
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
                                                <span className="w-5 h-5 flex items-center justify-center shrink-0">
                                                    {getIcon(section.icon)}
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
                                            <span className="w-5 h-5 flex items-center justify-center shrink-0">
                                                {getIcon(section.icon)}
                                            </span>
                                            <span>{section.title}</span>
                                        </NavLink>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                    <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                        Version 3.0 • {staffRole}
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