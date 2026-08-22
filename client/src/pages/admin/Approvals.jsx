import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Check, X, Loader2, Clock, Wallet, CreditCard, AlertCircle,
    ChevronLeft, ChevronRight, RefreshCw, Eye, User, Calendar
} from 'lucide-react';

const Approvals = () => {
    const { axios } = useAppContext();
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('en_attente');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [processing, setProcessing] = useState(null);

    const fetchApprovals = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/api/admin/approvals?statut=${filter}`);
            if (data.success) {
                setApprovals(data.approvals || []);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApprovals();
    }, [filter]);

    const handleApprove = async (id) => {
        setProcessing(id);
        try {
            const { data } = await axios.post(`/api/admin/approvals/${id}/approuver`, {
                commentaire: document.getElementById(`comment-${id}`)?.value || '',
            });
            if (data.success) {
                toast.success('Demande approuvée ✓');
                fetchApprovals();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (id) => {
        setProcessing(id);
        try {
            const { data } = await axios.post(`/api/admin/approvals/${id}/rejeter`, {
                commentaire: document.getElementById(`comment-${id}`)?.value || 'Demande rejetée',
            });
            if (data.success) {
                toast.success('Demande rejetée');
                fetchApprovals();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setProcessing(null);
        }
    };

    const getTypeLabel = (type) => {
        const map = {
            'wallet_adjust': 'Ajustement de wallet',
            'withdrawal': 'Retrait',
            'refund': 'Remboursement',
            'role_change': 'Changement de rôle',
        };
        return map[type] || type;
    };

    const getTypeIcon = (type) => {
        if (type === 'wallet_adjust' || type === 'refund') return <Wallet size={16} className="text-blue-500" />;
        if (type === 'withdrawal') return <CreditCard size={16} className="text-orange-500" />;
        return <AlertCircle size={16} className="text-yellow-500" />;
    };

    const getStatusBadge = (statut) => {
        const map = {
            'en_attente': <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 flex items-center gap-1"><Clock size={12} /> En attente</span>,
            'approuvee': <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 flex items-center gap-1"><Check size={12} /> Approuvée</span>,
            'rejetee': <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 flex items-center gap-1"><X size={12} /> Rejetée</span>,
            'expiree': <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-700 flex items-center gap-1"><Clock size={12} /> Expirée</span>,
        };
        return map[statut] || statut;
    };

    const totalApprovals = approvals.length;
    const totalPages = Math.ceil(totalApprovals / itemsPerPage);
    const paginatedApprovals = approvals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => setCurrentPage(1), [filter]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-red-500 mx-auto" size={32} />
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-6xl mx-auto">
                {/* En-tête */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Approbations</h1>
                        <p className="text-sm text-gray-500 mt-1">{approvals.filter(a => a.statut === 'en_attente').length} en attente</p>
                    </div>
                    <button onClick={fetchApprovals} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                        <RefreshCw size={16} /> Actualiser
                    </button>
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5">
                    <div className="flex flex-wrap gap-3">
                        {['en_attente', 'approuvee', 'rejetee', 'expiree'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filter === status ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {status === 'en_attente' && 'En attente'}
                                {status === 'approuvee' && 'Approuvées'}
                                {status === 'rejetee' && 'Rejetées'}
                                {status === 'expiree' && 'Expirées'}
                            </button>
                        ))}
                        <span className="text-xs text-gray-400 flex items-center ml-auto">{totalApprovals} demande(s)</span>
                    </div>
                </div>

                {/* Liste */}
                {paginatedApprovals.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucune demande d'approbation</p>
                        <p className="text-sm text-gray-400 mt-1">Toutes les demandes sont traitées</p>
                    </div>
                ) : (
                    <div className="space-y-4 mt-5">
                        {paginatedApprovals.map((approval) => (
                            <div key={approval._id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                            {getTypeIcon(approval.type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-gray-900">{getTypeLabel(approval.type)}</span>
                                                {getStatusBadge(approval.statut)}
                                                <span className="text-sm font-medium text-gray-600">{approval.montant.toLocaleString('fr-FR')} FCFA</span>
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                <span className="flex items-center gap-1"><User size={14} /> {approval.demandePar?.nom || 'Inconnu'} · {approval.demandePar?.email || ''}</span>
                                                <span className="flex items-center gap-1 mt-0.5"><Calendar size={14} /> {new Date(approval.createdAt).toLocaleString('fr-FR')}</span>
                                            </div>
                                            {approval.approuvePar && (
                                                <div className="text-sm text-gray-500 mt-1">
                                                    <span className="flex items-center gap-1"><Check size={14} /> Approuvé par {approval.approuvePar?.nom || ''}</span>
                                                </div>
                                            )}
                                            {approval.commentaire && (
                                                <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg">"{approval.commentaire}"</p>
                                            )}
                                        </div>
                                    </div>

                                    {approval.statut === 'en_attente' && (
                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                            <textarea
                                                id={`comment-${approval._id}`}
                                                placeholder="Commentaire (optionnel)"
                                                className="w-full sm:w-48 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:border-gray-400 outline-none resize-none"
                                                rows={1}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApprove(approval._id)}
                                                    disabled={processing === approval._id}
                                                    className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    {processing === approval._id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    Approuver
                                                </button>
                                                <button
                                                    onClick={() => handleReject(approval._id)}
                                                    disabled={processing === approval._id}
                                                    className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    {processing === approval._id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                                                    Rejeter
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-5">
                        <p className="text-sm text-gray-500">Page {currentPage} / {totalPages}</p>
                        <div className="flex gap-1.5">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Approvals;