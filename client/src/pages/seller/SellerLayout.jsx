import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { assets } from "../../assets/assets";
import { useAppContext } from "../../context/AppContext";
import toast from "react-hot-toast";
import { Menu, X as CloseIcon } from "lucide-react";

const SellerLayout = () => {

    const { axios, navigate, setIsSeller } = useAppContext();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Fermer le tiroir automatiquement dès qu'on navigue vers une autre page,
    // sinon il reste ouvert par-dessus la nouvelle page sur mobile.
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // Empêche le contenu derrière le tiroir de scroller pendant qu'il est ouvert.
    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [sidebarOpen]);

    const sidebarLinks = [
        { name: "Tableau de bord", path: "/seller", icon: "dashboard" },
        { name: "Ajouter un produit", path: "/seller/add-product", icon: "add" },
        { name: "Liste des produits", path: "/seller/product-list", icon: "list" },
        { name: "Commandes", path: "/seller/orders", icon: "orders" },
        { name: "Clients", path: "/seller/clients", icon: "clients" },
        { name: "Bannières", path: "/seller/banners", icon: "banner" },
        { name: "Catégories", path: "/seller/categories", icon: "category" },
        { name: "Codes promo", path: "/seller/coupons", icon: "coupon" },
        { name: "Localisations", path: "/seller/locations", icon: "location" },
        { name: "Livraisons", path: "/seller/delivery", icon: "delivery" },
        { name: "Paramètres", path: "/seller/settings", icon: "settings" },
        { name: "Colis SHEIN", path: "/seller/colis-shein", icon: "shein" },
    ];

    const getIcon = (iconName) => {
        switch(iconName) {
            case "dashboard":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/>
                        <line x1="8" y1="2" x2="8" y2="22"/>
                        <line x1="16" y1="2" x2="16" y2="22"/>
                        <line x1="2" y1="8" x2="22" y2="8"/>
                        <line x1="2" y1="16" x2="22" y2="16"/>
                    </svg>
                );
            case "add":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="16"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                );
            case "list":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <line x1="8" y1="6" x2="21" y2="6"/>
                        <line x1="8" y1="12" x2="21" y2="12"/>
                        <line x1="8" y1="18" x2="21" y2="18"/>
                        <line x1="3" y1="6" x2="3.01" y2="6"/>
                        <line x1="3" y1="12" x2="3.01" y2="12"/>
                        <line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                );
            case "orders":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                );
            case "clients":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                );
            case "banner":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="M2 8h20"/>
                    </svg>
                );
            case "category":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                );
            case "coupon":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M2 12l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2"/>
                        <path d="M2 4h20v16H2z"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                );
            case "location":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 2a10 10 0 0 0-10 10c0 8 10 14 10 14s10-6 10-14a10 10 0 0 0-10-10z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                );
            case "shein":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M6 2l1.5 5M18 2l-1.5 5"/>
                        <path d="M3 8h18l-1.5 12a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2L3 8z"/>
                        <path d="M9 12a3 3 0 0 0 6 0"/>
                    </svg>
                );
            case "delivery":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="2" y="6" width="20" height="12" rx="2"/>
                        <circle cx="7" cy="18" r="2"/>
                        <circle cx="17" cy="18" r="2"/>
                        <line x1="9" y1="18" x2="15" y2="18"/>
                        <path d="M2 10h6"/>
                        <path d="M16 10h6"/>
                    </svg>
                );
            case "settings":
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                );
            default:
                return null;
        }
    };

    const logout = async () => {
        try {
            const { data } = await axios.get('/api/seller/logout');
            if(data.success){
                localStorage.removeItem('isSeller');
                localStorage.removeItem('sellerData');
                setIsSeller(false);
                toast.success(data.message);
                navigate('/seller');
            }else{
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

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
                    <Link to='/' className="shrink-0">
                        <img src={assets.logo} alt="logo" className="h-6 sm:h-8 w-auto" />
                    </Link>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            A
                        </div>
                        <span className="text-sm font-medium text-gray-700">Admin</span>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-2.5 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        <span className="hidden sm:inline">Déconnexion</span>
                    </button>
                </div>
            </div>

            {/* Sidebar + Content */}
            <div className="flex">
                {/* Overlay mobile — ferme le tiroir au clic en dehors */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar : tiroir plein écran sur mobile, colonne fixe dès lg */}
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
                        {sidebarLinks.map((item) => (
                            <NavLink 
                                to={item.path} 
                                key={item.name} 
                                end={item.path === "/seller"}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-medium transition-all duration-200
                                    ${isActive 
                                        ? "bg-red-50 text-red-500" 
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }
                                `}
                            >
                                <span className="w-5 h-5 flex items-center justify-center shrink-0">
                                    {getIcon(item.icon)}
                                </span>
                                <span>{item.name}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 overflow-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default SellerLayout;