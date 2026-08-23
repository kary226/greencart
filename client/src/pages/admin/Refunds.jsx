import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Search, Loader2, ChevronLeft, ChevronRight, RefreshCw,
    CheckCircle, XCircle, Clock, AlertTriangle, Eye, Plus,
    DollarSign, User, Calendar, FileText, ExternalLink
} from 'lucide-react';

const Refunds = () => {
    const { axios } = useAppContext();
    const [refunds, setRefunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedRefund, setSelectedRefund] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [createForm, setCreateForm] = useState({
        orderId: '',
        montant: '',
        methode: 'rcoins',
        motif: '',
        noteInterne: '',
        noteClient: '',
    });

    const fetchRefunds = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
            });
            if (filter !== 'all') params.append('statut', filter);
            if (searchTerm) params.append('search', searchTerm);

            const { data } = await axios.get(`/api/admin/refunds?${params}`);
            if (data.success) {
                setRefunds(data.refunds || []);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRefunds();
    }, [currentPage, filter, searchTerm]);

    const viewRefund = async (id) => {
        try {
            const { data } = await axios.get(`/api/admin/refunds/${id}`);
            if (data.success) {
                setSelectedRefund(data.refund);
                setShowDetailModal(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { data } = await axios.post('/api/admin/refunds', {
                orderId: createForm.orderId,
                montant: parseFloat(createForm.montant),
                methode: createForm.methode,
                motif: createForm.motif,
                noteInterne: createForm.noteInterne,
                noteClient: createForm.noteClient,
            });
            if (data.success) {
                toast.success(data.message);
                setShowCreateModal(false);
                resetCreateForm();
                fetchRefunds();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const resetCreateForm = () => {
        setCreateForm({
            orderId: '',
            montant: '',
            methode: 'rcoins',
            motif: '',
            noteInterne: '',
            noteClient: '',
        });
    };

    const handleApprove = async (id) => {
        if (!window.confirm('Confirmer l\'approbation de ce remboursement ?')) return;
        setSubmitting(true);
        try {
            const { data } = await axios.post(`/api/admin/refunds/${id}/approve`);
            if (data.success) {
                toast.success(data.message);
                setShowDetailModal(false);
                fetchRefunds();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async (id) => {
        const motif = prompt('Motif du rejet :');
        if (motif === null) return;
        setSubmitting(true);
        try {
            const { data } = await axios.post(`/api/admin/refunds/${id}/reject`, { motif });
            if (data.success) {
                toast.success(data.message);
                setShowDetailModal(false);
                fetchRefunds();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleComplete = async (id) => {
        const ref = prompt('Référence du virement (optionnelle) :');
        setSubmitting(true);
        try {
            const { data } = await axios.post(`/api/admin/refunds/${id}/complete`, {
                providerReference: ref || '',
            });
            if (data.success) {
                toast.success(data.message);
                setShowDetailModal(false);
                fetchRefunds();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusLabel = (statut) => {
        const map = {
            requested: '📩 Demandé',
            approved: '✅ Approuvé',
            processing: '⏳ En cours',
            completed: '✅ Terminé',
            failed: '❌ Échoué',
            rejected: '❌ Rejeté',
        };
        return map[statut] || statut;
    };

    const getStatusColor = (statut) => {
        const map = {
            requested: 'bg-yellow-100 text-yellow-700',
            approved: 'bg-blue-100 text-blue-700',
            processing: 'bg-orange-100 text-orange-700',
            completed: 'bg-green-100 text-green-700',
            failed: 'bg-red-100 text-red-700',
            rejected: 'bg-red-100 text-red-700',
        };
        return map[statut] || 'bg-gray-100 text-gray-700';
    };

    const getMethodLabel = (methode) => {
        const map = {
            rcoins: '💎 RCOINS',
            moyen_paiement_origine: '💳 Moyen d\'origine',
        };
        return map[methode] || methode;
    };

    const StatCard = ({ icon: Icon, label, value, color = 'gray' }) => (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2">
                <Icon size={16} className={`text-${color}-500`} />
                <span className="text-xs text-gray-500">{label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    );

    if (loading && refunds.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-red-500 mx-auto" size={32} />
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                {/* En-tête */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Remboursements</h1>
                        <p className="text-sm text-gray-500 mt-1">{total} remboursement(s)</p>
                    </div>
                    <button
                        onClick={() => { setShowCreateModal(!showCreateModal); if (!showCreateModal) resetCreateForm(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                    >
                        <Plus size={16} />
                        {showCreateModal ? 'Annuler' : 'Nouveau remboursement'}
                    </button>
                </div>

                {/* Formulaire de création */}
                {showCreateModal && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-5">
                        <h2 className="font-semibold text-gray-900 mb-4">Nouveau remboursement</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Commande *</label>
                                    <input
                                        type="text"
                                        value={createForm.orderId}
                                        onChange={(e) => setCreateForm({ ...createForm, orderId: e.target.value })}
                                        placeholder="ID de la commande"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA) *</label>
                                    <input
                                        type="number"
                                        value={createForm.montant}
                                        onChange={(e) => setCreateForm({ ...createForm, montant: e.target.value })}
                                        placeholder="0"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Méthode</label>
                                    <select
                                        value={createForm.methode}
                                        onChange={(e) => setCreateForm({ ...createForm, methode: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                    >
                                        <option value="rcoins">RCOINS</option>
                                        <option value="moyen_paiement_origine">Moyen d'origine</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Motif *</label>
                                    <input
                                        type="text"
                                        value={createForm.motif}
                                        onChange={(e) => setCreateForm({ ...createForm, motif: e.target.value })}
                                        placeholder="Raison du remboursement"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note interne</label>
                                <textarea
                                    value={createForm.noteInterne}
                                    onChange={(e) => setCreateForm({ ...createForm, noteInterne: e.target.value })}
                                    placeholder="Visible uniquement par le staff"
                                    rows={2}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note client</label>
                                <textarea
                                    value={createForm.noteClient}
                                    onChange={(e) => setCreateForm({ ...createForm, noteClient: e.target.value })}
                                    placeholder="Visible par le client"
                                    rows={2}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                    {submitting ? <Loader2 size={16} className="animate-spin inline" /> : 'Créer le remboursement'}
                                </button>
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Statistiques */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    <StatCard icon={Clock} label="En attente" value={refunds.filter(r => r.statut === 'requested').length} color="yellow" />
                    <StatCard icon={CheckCircle} label="Approuvés" value={refunds.filter(r => r.statut === 'approved' || r.statut === 'processing').length} color="blue" />
                    <StatCard icon={CheckCircle} label="Terminés" value={refunds.filter(r => r.statut === 'completed').length} color="green" />
                    <StatCard icon={DollarSign} label="Montant total" value={refunds.reduce((sum, r) => sum + (r.montantApprouve || 0), 0).toLocaleString('fr-FR') + ' FCFA'} color="red" />
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par ID de commande..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-gray-400 outline-none text-sm"
                            />
                        </div>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white"
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="requested">Demandés</option>
                            <option value="approved">Approuvés</option>
                            <option value="processing">En cours</option>
                            <option value="completed">Terminés</option>
                            <option value="rejected">Rejetés</option>
                        </select>
                        <button onClick={fetchRefunds} className="px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm hover:bg-gray-200 transition">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Liste */}
                {refunds.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <DollarSign size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucun remboursement</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-5">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commande</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Méthode</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Motif</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Demandé par</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Créé le</th>
                                        <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {refunds.map((refund) => (
                                        <tr key={refund._id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 font-mono text-sm font-medium text-gray-900">
                                                #{refund.orderId?._id?.slice(-6).toUpperCase() || refund.orderId?.slice(-6) || '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(refund.statut)}`}>
                                                    {getStatusLabel(refund.statut)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {getMethodLabel(refund.methode)}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                {refund.montantApprouve.toLocaleString('fr-FR')} FCFA
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-[150px] truncate">
                                                {refund.motif}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{refund.demandePar?.nom || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(refund.createdAt).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => viewRefund(refund._id)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                >
                                                    <Eye size={14} /> Voir
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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

            {/* Modal Détail */}
            {showDetailModal && selectedRefund && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900">
                                Remboursement - {selectedRefund.refundId?.slice(-8) || '—'}
                            </h3>
                            <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-gray-500">Commande</span><br /><span className="font-mono font-medium">#{selectedRefund.orderId?._id?.slice(-6).toUpperCase() || '—'}</span></div>
                                <div><span className="text-gray-500">Statut</span><br /><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedRefund.statut)}`}>{getStatusLabel(selectedRefund.statut)}</span></div>
                                <div><span className="text-gray-500">Montant</span><br /><span className="font-bold text-red-500">{selectedRefund.montantApprouve.toLocaleString('fr-FR')} FCFA</span></div>
                                <div><span className="text-gray-500">Méthode</span><br /><span className="font-medium">{getMethodLabel(selectedRefund.methode)}</span></div>
                                <div><span className="text-gray-500">Motif</span><br /><span className="text-gray-700">{selectedRefund.motif}</span></div>
                                <div><span className="text-gray-500">Référence</span><br /><span className="font-mono text-sm">{selectedRefund.refundId}</span></div>
                            </div>

                            {selectedRefund.noteInterne && (
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="font-medium text-gray-700">Note interne</p>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">{selectedRefund.noteInterne}</p>
                                </div>
                            )}

                            {selectedRefund.noteClient && (
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="font-medium text-gray-700">Note client</p>
                                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-xl">{selectedRefund.noteClient}</p>
                                </div>
                            )}

                            {selectedRefund.providerReference && (
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="font-medium text-gray-700">Référence externe</p>
                                    <p className="text-sm text-gray-600">{selectedRefund.providerReference}</p>
                                </div>
                            )}

                            <div className="flex gap-2 pt-4 border-t border-gray-100 flex-wrap">
                                {selectedRefund.statut === 'requested' && (
                                    <>
                                        <button onClick={() => handleApprove(selectedRefund._id)} disabled={submitting} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">
                                            <CheckCircle size={16} className="inline mr-1" /> Approuver
                                        </button>
                                        <button onClick={() => handleReject(selectedRefund._id)} disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-50">
                                            <XCircle size={16} className="inline mr-1" /> Rejeter
                                        </button>
                                    </>
                                )}
                                {(selectedRefund.statut === 'approved' || selectedRefund.statut === 'processing') && (
                                    <button onClick={() => handleComplete(selectedRefund._id)} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                                        <CheckCircle size={16} className="inline mr-1" /> Marquer terminé
                                    </button>
                                )}
                                <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Refunds;