import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import {
    LayoutDashboard, Store, Package, Wallet, Banknote, LogOut, Loader2, ShieldAlert
} from 'lucide-react';

const NAV_LINKS = [
    { name: 'Tableau de bord', path: '/commercant/dashboard', icon: LayoutDashboard },
    { name: 'Ma boutique', path: '/commercant/boutique', icon: Store },
    { name: 'Produits', path: '/commercant/produits', icon: Package },
    { name: 'Portefeuille', path: '/commercant/portefeuille', icon: Wallet },
    { name: 'Retraits', path: '/commercant/retraits', icon: Banknote },
];

const CommercantLayout = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();
    const [authorized, setAuthorized] = useState(null);
    const [moi, setMoi] = useState(null);
    const [boutique, setBoutique] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (data.success && data.staffUser?.role === 'commercant') {
                    setMoi(data.staffUser);
                    setAuthorized(true);
                    try {
                        const boutiqueRes = await axios.get('/api/boutiques/moi');
                        if (boutiqueRes.data.success) setBoutique(boutiqueRes.data.boutique);
                    } catch (_) {}
                } else {
                    setAuthorized(false);
                }
            } catch (error) {
                setAuthorized(false);
            }
        })();
    }, [axios]);

    const handleLogout = async () => {
        try { await axios.get('/api/staff/logout'); } catch (_) {}
        navigate('/staff/login');
    };

    if (authorized === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ivory-200">
                <Loader2 className="animate-spin text-burgundy-600" size={28} />
            </div>
        );
    }

    if (authorized === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ivory-200 px-4">
                <div className="text-center max-w-sm">
                    <ShieldAlert size={44} className="text-burgundy-600 mx-auto mb-3" />
                    <h1 className="text-lg font-bold text-gray-900">Accès refusé</h1>
                    <p className="text-sm text-gray-500 mt-1 mb-5">
                        Cette page est réservée aux comptes commerçant.
                    </p>
                    <button
                        onClick={() => navigate('/staff/login')}
                        className="px-4 py-2 bg-burgundy-600 text-white rounded-xl text-sm font-medium hover:bg-burgundy-700 transition"
                    >
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ivory-200">
            <div className="flex items-center justify-between px-4 sm:px-6 border-b border-blush-300 py-3.5 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-burgundy-600 flex items-center justify-center overflow-hidden shrink-0">
                        {boutique?.logo ? (
                            <img src={boutique.logo} alt={boutique.nom} className="w-full h-full object-cover" />
                        ) : (
                            <Store size={18} className="text-ivory-100" />
                        )}
                    </div>
                    <span className="font-display text-lg font-semibold text-burgundy-800 tracking-tight truncate">
                        {boutique?.nom || 'Ma boutique'}
                    </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-2 pr-3 border-r border-blush-300">
                        <div className="w-8 h-8 bg-blush-300 rounded-full flex items-center justify-center text-burgundy-700 font-semibold text-sm">
                            {moi?.nom?.[0]?.toUpperCase() || 'C'}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{moi?.nom}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-burgundy-700 bg-blush-100 rounded-xl hover:bg-blush-200 transition"
                    >
                        <LogOut size={16} /> <span className="hidden sm:inline">Déconnexion</span>
                    </button>
                </div>
            </div>

            <div className="flex">
                <div className="w-16 lg:w-60 bg-white border-r border-blush-200 h-[calc(100vh-61px)] sticky top-[61px] flex flex-col shrink-0">
                    <nav className="flex-1 py-4">
                        {NAV_LINKS.map(({ name, path, icon: Icon }) => (
                            <NavLink
                                key={path}
                                to={path}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-medium transition-all
                                    ${isActive ? 'bg-burgundy-50 text-burgundy-700' : 'text-gray-500 hover:bg-ivory-300 hover:text-gray-800'}
                                `}
                            >
                                <Icon size={19} className="shrink-0" />
                                <span className="hidden lg:inline">{name}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="flex-1 min-w-0">
                    <Outlet context={{ moi, boutique, setBoutique }} />
                </div>
            </div>
        </div>
    );
};

export default CommercantLayout;