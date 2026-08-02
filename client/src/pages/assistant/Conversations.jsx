import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    MessageSquare, Users, Clock, CheckCircle,
    Loader2, Search, ChevronRight,
    User, Mail, Phone, Package
} from 'lucide-react';

const Conversations = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [conversations, setConversations] = useState([]);
    const [stats, setStats] = useState(null);
    const [moi, setMoi] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: authData } = await axios.get('/api/staff/is-auth');
            if (!authData.success || !['admin', 'assistant_shein'].includes(authData.staffUser?.role)) {
                navigate('/staff/login');
                return;
            }
            setMoi(authData.staffUser);

            const params = new URLSearchParams();
            if (filterStatus) params.append('statut', filterStatus);

            const { data } = await axios.get(`/api/shein-cart/admin/conversations?${params.toString()}`);
            if (data.success) {
                setConversations(data.conversations);
            }

            if (authData.staffUser.role === 'admin') {
                const { data: statsData } = await axios.get('/api/shein-cart/admin/stats');
                if (statsData.success) {
                    setStats(statsData.stats);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
            if (error.response?.status === 401) navigate('/staff/login');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filterStatus]);

    const getStatusBadge = (statut) => {
        const config = {
            soumis: { label: 'Soumis', className: 'bg-gray-100 text-gray-700' },
            en_verification: { label: 'En vérification', className: 'bg-blue-100 text-blue-700' },
            devis_envoye: { label: 'Devis envoyé', className: 'bg-amber-100 text-amber-700' },
            acompte_paye: { label: 'Acompte payé', className: 'bg-green-100 text-green-700' },
            achete: { label: 'Acheté', className: 'bg-purple-100 text-purple-700' },
            en_entrepot: { label: 'En entrepôt', className: 'bg-indigo-100 text-indigo-700' },
            pese: { label: 'Pesé', className: 'bg-cyan-100 text-cyan-700' },
            solde_du: { label: 'Solde dû', className: 'bg-amber-100 text-amber-700' },
            solde_paye: { label: 'Solde payé', className: 'bg-green-100 text-green-700' },
            en_livraison: { label: 'En livraison', className: 'bg-blue-100 text-blue-700' },
            livre: { label: 'Livré', className: 'bg-emerald-100 text-emerald-700' },
            annule: { label: 'Annulé', className: 'bg-red-100 text-red-700' },
        };
        return config[statut] || { label: statut, className: 'bg-gray-100 text-gray-700' };
    };

    const filteredConversations = conversations.filter(conv =>
        conv.numeroSuivi?.includes(searchTerm) ||
        conv.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.userId?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center">
                <Loader2 className="animate-spin text-burgundy-600" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ivory-200">
            <div className="bg-burgundy-600 text-ivory-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <MessageSquare size={24} />
                            <div>
                                <h1 className="text-lg font-bold">Conversations Shein</h1>
                                <p className="text-sm text-blush-300">
                                    {moi?.role === 'admin' ? 'Gestion des conversations' : 'Mes conversations'}
                                </p>
                            </div>
                        </div>
                        <span className="text-xs bg-blush-200/20 px-3 py-1 rounded-full">
                            {moi?.role === 'admin' ? 'Admin' : 'Assistant'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6">
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-blush-300 text-center">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-lg font-bold text-gray-800">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-blush-300 text-center">
                            <p className="text-xs text-gray-500">En attente</p>
                            <p className="text-lg font-bold text-amber-600">{stats.enAttente}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-blush-300 text-center">
                            <p className="text-xs text-gray-500">En cours</p>
                            <p className="text-lg font-bold text-blue-600">{stats.enCours}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-blush-300 text-center">
                            <p className="text-xs text-gray-500">Terminés</p>
                            <p className="text-lg font-bold text-green-600">{stats.termines}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-blush-300 text-center">
                            <p className="text-xs text-gray-500">Sans agent</p>
                            <p className="text-lg font-bold text-red-600">{stats.sansAgent}</p>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par numéro, client..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-blush-300 rounded-lg text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500"
                            />
                        </div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 border border-blush-300 rounded-lg text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500"
                        >
                            <option value="">Tous les statuts</option>
                            <option value="soumis">Soumis</option>
                            <option value="en_verification">En vérification</option>
                            <option value="devis_envoye">Devis envoyé</option>
                            <option value="acompte_paye">Acompte payé</option>
                            <option value="achete">Acheté</option>
                            <option value="en_entrepot">En entrepôt</option>
                            <option value="pese">Pesé</option>
                            <option value="solde_du">Solde dû</option>
                            <option value="solde_paye">Solde payé</option>
                            <option value="en_livraison">En livraison</option>
                            <option value="livre">Livré</option>
                            <option value="annule">Annulé</option>
                        </select>
                    </div>
                </div>

                {filteredConversations.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-12 text-center">
                        <MessageSquare className="mx-auto text-gray-400 mb-3" size={48} />
                        <h3 className="text-lg font-medium text-gray-800">Aucune conversation</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {moi?.role === 'assistant_shein'
                                ? 'Aucune conversation ne vous est assignée'
                                : 'Aucune conversation en attente'}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-blush-300 overflow-hidden">
                        <div className="divide-y divide-blush-200">
                            {filteredConversations.map((conv) => {
                                const status = getStatusBadge(conv.statut);
                                return (
                                    <div
                                        key={conv._id}
                                        className="px-4 py-3 hover:bg-blush-50 transition cursor-pointer"
                                        onClick={() => navigate(`/assistant/conversation/${conv._id}`)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <Package size={18} className="text-gray-400" />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800">
                                                            #{conv.numeroSuivi || conv._id.slice(-8)}
                                                        </p>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                                            <span className="flex items-center gap-1">
                                                                <User size={12} /> {conv.userId?.name || 'Client'}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Mail size={12} /> {conv.userId?.email || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {conv.agentAssigneld && (
                                                    <span className="text-xs text-gray-400">
                                                        {conv.agentAssigneld.nom}
                                                    </span>
                                                )}
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.className}`}>
                                                    {status.label}
                                                </span>
                                                <ChevronRight size={18} className="text-gray-400" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Conversations;