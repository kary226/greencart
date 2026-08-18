import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import AdminNav from './AdminNav';
import SupprimerCompteModal from './SupprimerCompteModal';
import {
    UserPlus, Mail, Clock, ShieldAlert,
    Ban, RotateCcw, Loader2, Send, ChevronLeft, ChevronRight,
    Search, X, Trash2
} from 'lucide-react';

const ROLE_LABELS = {
    admin: 'Administrateur',
    commercant: 'Commerçant',
    livreur: 'Livreur',
    assistant_shein: 'Assistant Shein',
};
const ROLES = Object.keys(ROLE_LABELS);
const ITEMS_PER_PAGE = 10;

const AdminComptes = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    // null = vérification en cours, false = refusé, true = autorisé
    const [authorized, setAuthorized] = useState(null);
    const [moi, setMoi] = useState(null);

    const [comptes, setComptes] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loadingList, setLoadingList] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Filtres
    const [filterRole, setFilterRole] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Formulaire d'invitation
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('commercant');
    const [inviteLoading, setInviteLoading] = useState(false);

    // Compte visé par une suppression définitive (modale partagée avec
    // l'écran Boutiques).
    const [cibleSuppression, setCibleSuppression] = useState(null);

    const loadAll = useCallback(async () => {
        setLoadingList(true);
        try {
            // Construire les paramètres de requête
            const params = new URLSearchParams();
            params.append('page', page);
            params.append('limit', ITEMS_PER_PAGE);
            if (filterRole) params.append('role', filterRole);
            if (filterStatus) params.append('statut', filterStatus);
            if (searchTerm) params.append('search', searchTerm);

            const [comptesRes, invitationsRes] = await Promise.all([
                axios.get(`/api/staff/comptes?${params.toString()}`),
                axios.get('/api/staff/invitations'),
            ]);

            if (comptesRes.data.success) {
                setComptes(comptesRes.data.comptes);
                setTotalPages(comptesRes.data.pagination?.totalPages || 1);
                setTotalItems(comptesRes.data.pagination?.total || 0);
            }
            if (invitationsRes.data.success) {
                setInvitations(invitationsRes.data.invitations);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoadingList(false);
        }
    }, [axios, page, filterRole, filterStatus, searchTerm]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (data.success && data.staffUser?.role === 'admin') {
                    setMoi(data.staffUser);
                    setAuthorized(true);
                } else {
                    setAuthorized(false);
                }
            } catch (error) {
                setAuthorized(false);
            }
        };
        checkAuth();
    }, [axios]);

    useEffect(() => {
        if (authorized) loadAll();
    }, [authorized, loadAll]);

    // Réinitialiser la page quand les filtres changent
    useEffect(() => {
        if (authorized) {
            setPage(1);
            loadAll();
        }
    }, [filterRole, filterStatus, searchTerm]);

    const handleInvite = async (e) => {
        e.preventDefault();
        setInviteLoading(true);
        try {
            const { data } = await axios.post('/api/staff/invitations', {
                email: inviteEmail,
                role: inviteRole
            });
            if (data.success) {
                toast.success('Invitation envoyée avec succès');
                setInviteEmail('');
                setInviteRole('commercant');
                setShowInviteForm(false);
                loadAll();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setInviteLoading(false);
        }
    };

    const handleToggleStatus = async (compte) => {
        const nouveauStatut = compte.statut === 'actif' ? 'suspendu' : 'actif';
        const label = nouveauStatut === 'suspendu' ? 'suspendre' : 'réactiver';
        if (!window.confirm(`Confirmer : ${label} le compte de ${compte.nom} (${compte.email}) ?`)) return;

        try {
            const { data } = await axios.patch(`/api/staff/comptes/${compte._id}/statut`, {
                statut: nouveauStatut
            });
            if (data.success) {
                toast.success('Statut mis à jour avec succès');
                loadAll();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const handleRoleChange = async (compte, newRole) => {
        if (newRole === compte.role) return;
        if (!window.confirm(`Confirmer : changer le rôle de ${compte.nom} en "${ROLE_LABELS[newRole]}" ?`)) {
            return;
        }
        try {
            const { data } = await axios.patch(`/api/staff/comptes/${compte._id}/role`, {
                role: newRole
            });
            if (data.success) {
                toast.success('Rôle mis à jour avec succès');
                loadAll();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    // Réinitialiser les filtres
    const clearFilters = () => {
        setFilterRole('');
        setFilterStatus('');
        setSearchTerm('');
    };

    if (authorized === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="animate-spin text-emerald-600" size={28} />
            </div>
        );
    }

    if (authorized === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="text-center max-w-sm">
                    <ShieldAlert size={44} className="text-red-500 mx-auto mb-3" />
                    <h1 className="text-lg font-bold text-gray-900">Accès refusé</h1>
                    <p className="text-sm text-gray-500 mt-1 mb-5">
                        Cette page est réservée aux comptes admin. Connectez-vous avec un compte autorisé.
                    </p>
                    <button
                        onClick={() => navigate('/staff/login')}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
                    >
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <AdminNav
                titre="Gestion des comptes"
                sousTitre={`${moi?.nom} · Administrateur · ${totalItems} compte${totalItems > 1 ? 's' : ''}`}
            />

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">

                {/* Bouton inviter + formulaire */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900">Inviter un nouveau membre</h2>
                        <button
                            onClick={() => setShowInviteForm(!showInviteForm)}
                            className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-700 transition"
                        >
                            <UserPlus size={16} /> {showInviteForm ? 'Annuler' : 'Inviter'}
                        </button>
                    </div>

                    {showInviteForm && (
                        <form onSubmit={handleInvite} className="mt-4 flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="email"
                                    required
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="email@exemple.com"
                                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                            <select
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value)}
                                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            >
                                {ROLES.map((r) => (
                                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                            </select>
                            <button
                                disabled={inviteLoading}
                                className="flex items-center justify-center gap-1.5 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
                            >
                                {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                Envoyer
                            </button>
                        </form>
                    )}
                </div>

                {/* Invitations en attente */}
                {invitations.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900">
                                Invitations en attente ({invitations.length})
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {invitations.map((inv) => (
                                <div key={inv._id} className="px-5 py-3 flex items-center justify-between text-sm">
                                    <div>
                                        <p className="font-medium text-gray-800">{inv.email}</p>
                                        <p className="text-xs text-gray-400">{ROLE_LABELS[inv.role] || inv.role}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-amber-600">
                                        <Clock size={13} />
                                        Expire le {new Date(inv.expireA).toLocaleDateString('fr-FR')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Comptes existants */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h2 className="font-semibold text-gray-900">
                                Comptes ({totalItems})
                            </h2>
                            {/* Filtres */}
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-full sm:w-40"
                                    />
                                </div>
                                <select
                                    value={filterRole}
                                    onChange={(e) => setFilterRole(e.target.value)}
                                    className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="">Tous les rôles</option>
                                    {ROLES.map((r) => (
                                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                    ))}
                                </select>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="">Tous les statuts</option>
                                    <option value="actif">Actif</option>
                                    <option value="suspendu">Suspendu</option>
                                </select>
                                {(filterRole || filterStatus || searchTerm) && (
                                    <button
                                        onClick={clearFilters}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                                        title="Effacer les filtres"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {loadingList ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="animate-spin text-gray-400" size={22} />
                        </div>
                    ) : comptes.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            {searchTerm || filterRole || filterStatus
                                ? 'Aucun compte ne correspond aux filtres'
                                : 'Aucun compte créé pour le moment'
                            }
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                                            <th className="px-5 py-2.5">Nom</th>
                                            <th className="px-5 py-2.5">Email</th>
                                            <th className="px-5 py-2.5">Rôle</th>
                                            <th className="px-5 py-2.5">Statut</th>
                                            <th className="px-5 py-2.5">Dernière connexion</th>
                                            <th className="px-5 py-2.5"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {comptes.map((c) => {
                                            const estMoi = c._id === moi?._id;
                                            return (
                                                <tr key={c._id} className="hover:bg-gray-50">
                                                    <td className="px-5 py-3 font-medium text-gray-800">
                                                        {c.nom} {estMoi && <span className="text-xs text-gray-400">(vous)</span>}
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-600">{c.email}</td>
                                                    <td className="px-5 py-3">
                                                        <select
                                                            value={c.role}
                                                            disabled={estMoi}
                                                            onChange={(e) => handleRoleChange(c, e.target.value)}
                                                            className="border border-gray-200 rounded-lg text-xs px-2 py-1 outline-none disabled:opacity-50 disabled:bg-gray-50"
                                                        >
                                                            {ROLES.map((r) => (
                                                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                            c.statut === 'actif'
                                                                ? 'bg-green-100 text-green-700'
                                                                : c.statut === 'suspendu'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                            {c.statut}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-500 text-xs">
                                                        {c.derniereConnexion
                                                            ? new Date(c.derniereConnexion).toLocaleString('fr-FR')
                                                            : 'Jamais'}
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                disabled={estMoi}
                                                                onClick={() => handleToggleStatus(c)}
                                                                title={c.statut === 'actif' ? 'Suspendre' : 'Réactiver'}
                                                                className={`p-1.5 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed ${
                                                                    c.statut === 'actif'
                                                                        ? 'text-red-600 hover:bg-red-50'
                                                                        : 'text-green-600 hover:bg-green-50'
                                                                }`}
                                                            >
                                                                {c.statut === 'actif' ? <Ban size={16} /> : <RotateCcw size={16} />}
                                                            </button>
                                                            <button
                                                                disabled={estMoi}
                                                                onClick={() => setCibleSuppression(c)}
                                                                title="Supprimer définitivement"
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                                    <div className="text-sm text-gray-500">
                                        Page {page} sur {totalPages}
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {cibleSuppression && (
                <SupprimerCompteModal
                    compte={cibleSuppression}
                    onClose={() => setCibleSuppression(null)}
                    onSupprime={loadAll}
                />
            )}
        </div>
    );
};

export default AdminComptes;