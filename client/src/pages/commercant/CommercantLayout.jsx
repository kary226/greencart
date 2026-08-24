import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import {
    LayoutDashboard, Store, Package, Wallet, Banknote, LogOut, Loader2, ShieldAlert, Tag, AlertTriangle, ShoppingBag
} from 'lucide-react';

const NAV_LINKS = [
    { name: 'Tableau de bord', path: '/commercant/dashboard', icon: LayoutDashboard },
    { name: 'Ma boutique', path: '/commercant/boutique', icon: Store },
    { name: 'Produits', path: '/commercant/produits', icon: Package },
    { name: 'Commandes', path: '/commercant/commandes', icon: ShoppingBag },
    { name: 'Codes promo', path: '/commercant/codes-promo', icon: Tag },
    { name: 'Portefeuille', path: '/commercant/portefeuille', icon: Wallet },
    { name: 'Retraits', path: '/commercant/retraits', icon: Banknote },
];

const CommercantLayout = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();
    const [authorized, setAuthorized] = useState(null);
    const [moi, setMoi] = useState(null);
    const [boutique, setBoutique] = useState(null);
    // Distinguer « pas encore chargée » de « le serveur n'a pas répondu » :
    // sans ça, une simple coupure réseau s'affichait comme « aucune boutique
    // associée », et le commerçant n'avait plus qu'à appeler l'admin.
    const [boutiqueEnCours, setBoutiqueEnCours] = useState(true);
    const [erreurBoutique, setErreurBoutique] = useState(null);

    // Le serveur crée la boutique à l'invitation, et la recrée ici si elle
    // manque (compte ancien, activation interrompue). Un simple rechargement
    // suffit donc à débloquer la situation.
    const chargerBoutique = useCallback(async () => {
        setBoutiqueEnCours(true);
        setErreurBoutique(null);
        try {
            const { data } = await axios.get('/api/boutiques/moi');
            if (data.success) {
                setBoutique(data.boutique);
            } else {
                setErreurBoutique(data.message || 'Boutique indisponible');
            }
        } catch (error) {
            setErreurBoutique(error.response?.data?.message || error.message);
        } finally {
            setBoutiqueEnCours(false);
        }
    }, [axios]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (data.success && data.staffUser?.role === 'commercant') {
                    setMoi(data.staffUser);
                    setAuthorized(true);
                    await chargerBoutique();
                } else {
                    setAuthorized(false);
                    setBoutiqueEnCours(false);
                }
            } catch (error) {
                console.error('Erreur vérification authentification commerçant:', error);
                setAuthorized(false);
                setBoutiqueEnCours(false);
            }
        })();
    }, [axios, chargerBoutique]);

    const handleLogout = async () => {
        try { await axios.get('/api/staff/logout'); } catch { /* déconnexion best-effort, on redirige quand même */ }
        navigate('/staff/login');
    };

    if (authorized === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-50">
                <Loader2 className="animate-spin text-ramses-600" size={28} />
            </div>
        );
    }

    if (authorized === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
                <div className="text-center max-w-sm">
                    <ShieldAlert size={44} className="text-ramses-600 mx-auto mb-3" />
                    <h1 className="text-lg font-bold text-ink-900">Accès refusé</h1>
                    <p className="text-sm text-ink-500 mt-1 mb-5">
                        Cette page est réservée aux comptes commerçant.
                    </p>
                    <button
                        onClick={() => navigate('/staff/login')}
                        className="px-4 py-2 bg-ramses-600 text-white rounded-xl text-sm font-medium hover:bg-ramses-700 transition"
                    >
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-50">
            <div className="flex items-center justify-between px-4 sm:px-6 border-b border-ink-200 py-3.5 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-ramses-600 flex items-center justify-center overflow-hidden shrink-0">
                        {boutique?.logo ? (
                            <img src={boutique.logo} alt={boutique.nom} className="w-full h-full object-cover" />
                        ) : (
                            <Store size={18} className="text-ink-0" />
                        )}
                    </div>
                    <span className="font-display text-lg font-semibold text-ramses-800 tracking-tight truncate">
                        {boutique?.nom || 'Ma boutique'}
                    </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-2 pr-3 border-r border-ink-200">
                        <div className="w-8 h-8 bg-ink-200 rounded-full flex items-center justify-center text-ramses-700 font-semibold text-sm">
                            {moi?.nom?.[0]?.toUpperCase() || 'C'}
                        </div>
                        <span className="text-sm font-medium text-ink-700">{moi?.nom}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-ramses-700 bg-ink-50 rounded-xl hover:bg-ink-200 transition"
                    >
                        <LogOut size={16} /> <span className="hidden sm:inline">Déconnexion</span>
                    </button>
                </div>
            </div>

            {boutique?.statut === 'suspendue' && (
                <div className="bg-ramses-50 border-b border-ramses-200 px-4 sm:px-6 py-3 flex items-start gap-2.5">
                    <AlertTriangle size={18} className="text-ramses-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-red-800">Votre boutique est suspendue par l'administrateur.</p>
                        <p className="text-ramses-700 mt-0.5">
                            Vos articles ne sont plus visibles dans le catalogue et vous ne pouvez ni en publier
                            ni en modifier. Vos ventes passées et votre portefeuille restent consultables.
                            {boutique.motifSuspension ? ` Motif : ${boutique.motifSuspension}` : ''}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex">
                <div className="w-16 lg:w-60 bg-white border-r border-ink-200 h-[calc(100vh-61px)] sticky top-[61px] flex flex-col shrink-0">
                    <nav className="flex-1 py-4">
                        {NAV_LINKS.map(({ name, path, icon: Icon }) => (
                            <NavLink
                                key={path}
                                to={path}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-medium transition-all
                                    ${isActive ? 'bg-ramses-50 text-ramses-700' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800'}
                                `}
                            >
                                <Icon size={19} className="shrink-0" />
                                <span className="hidden lg:inline">{name}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="flex-1 min-w-0">
                    <Outlet context={{ moi, boutique, setBoutique, boutiqueEnCours, erreurBoutique, rechargerBoutique: chargerBoutique }} />
                </div>
            </div>
        </div>
    );
};

export default CommercantLayout;