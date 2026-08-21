import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Users, Store, ScrollText, LogOut, Banknote, PackageCheck } from 'lucide-react';

// En-tête commun aux écrans d'administration staff. Les pages se répondent
// en permanence — inviter un commerçant ici, suspendre sa boutique là,
// valider une commande pour qu'un retrait devienne possible ailleurs — il
// fallait pouvoir passer de l'une à l'autre sans repasser par l'URL.
const ONGLETS = [
    { to: '/staff/admin/comptes', label: 'Comptes', icon: Users },
    { to: '/staff/admin/boutiques', label: 'Boutiques', icon: Store },
    { to: '/staff/admin/commandes', label: 'Commandes', icon: PackageCheck },
    { to: '/staff/admin/retraits', label: 'Retraits', icon: Banknote },
    { to: '/staff/admin/journal', label: 'Journal', icon: ScrollText },
];

const AdminNav = ({ titre, sousTitre }) => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try { await axios.get('/api/staff/logout'); } catch (_) { /* on quitte quand même */ }
        navigate('/staff/login');
    };

    return (
        <div className="bg-white border-b border-ink-200 sticky top-0 z-10">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-lg font-bold text-ink-900 truncate">{titre}</h1>
                    {sousTitre && <p className="text-xs text-ink-400 truncate">{sousTitre}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <nav className="flex items-center gap-1 bg-ink-100 rounded-xl p-1">
                        {ONGLETS.map(({ to, label, icon: Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                    isActive ? 'bg-white text-ramses-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                                }`}
                            >
                                <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
                            </NavLink>
                        ))}
                    </nav>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ramses-600 transition px-3 py-1.5 rounded-lg hover:bg-ramses-50"
                    >
                        <LogOut size={16} /> <span className="hidden sm:inline">Déconnexion</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminNav;