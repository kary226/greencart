import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Loader2, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle,
    ChevronLeft, ChevronRight, Eye, Search, DollarSign, Calendar
} from 'lucide-react';

const Reconciliation = () => {
    const { axios } = useAppContext();
    const [loading, setLoading] = useState(true);
    const [ecarts, setEcarts] = useState([]);
    const [stats, setStats] = useState(null);
    const [running, setRunning] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage] = useState(20);
    const [selectedEcart, setSelectedEcart] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    const fetchStats = async () => {
        try {
            const { data } = await axios.get('/api/admin/reconciliation/stats');
            if (data.success) setStats(data.stats);
        } catch (error) {
            console.error('Erreur stats:', error);
        }
    };

    const fetchEcarts = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/api/admin/reconciliation/ecarts?page=${currentPage}&limit=${itemsPerPage}`);
            if (data.success) {
                setEcarts(data.ecarts || []);
                setTotalPages(Math.ceil((data.ecarts?.length || 0) / itemsPerPage));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchEcarts();
    }, [currentPage]);

    const handleRunReconciliation = async () => {
        if (!window.confirm('Lancer un rapprochement Jèko ? Cette opération peut prendre quelques secondes.')) return;
        setRunning(true);
        try {
            const { data } = await axios.post('/api/admin/reconciliation/run', {
                autoResoudre: false,
            });
            if (data.success) {
                toast.success(`Rapprochement terminé : ${data.totalEcards} écarts détectés`);
                fetchStats();
                fetchEcarts();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setRunning(false);
        }
    };

    const handleResolve = async (id) => {
        const note = prompt('Note de résolution (optionnelle) :');
        try {
            const { data } = await axios.post(`/api/admin/reconciliation/ecarts/${id}/resoudre`, { note: note || '' });
            if (data.success) {
                toast.success('Écart résolu');
                fetchStats();
                fetchEcarts();
                setShowDetail(false);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const getTypeEcartLabel = (type) => {
        const map = {
            montant: '💰 Écart de montant',
            statut: '📊 Écart de statut',
            manquant: '❌ Transaction manquante',
            doublon: '🔄 Doublon détecté',
            aucun: '✅ Aucun écart',
        };
        return map[type] || type;
    };

    const getTypeEcartColor = (type) => {
        const map = {
            montant: 'bg-yellow-100 text-yellow-700',
            statut: 'bg-blue-100 text-blue-700',
            manquant: 'bg-red-100 text-red-700',
            doublon: 'bg-orange-100 text-orange-700',
            aucun: 'bg-green-100 text-green-700',
        };
        return map[type] || 'bg-gray-100 text-gray-700';
    };

    if (loading && ecarts.length === 0) {
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
                        <h1 className="text-2xl font-bold text-gray-900">Rapprochement Jèko</h1>
                        <p className="text-sm text-gray-500 mt-1">Vérification des transactions entre Jèko et le wallet</p>
                    </div>
                    <button
                        onClick={handleRunReconciliation}
                        disabled={running}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50"
                    >
                        {running ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        {running ? 'En cours...' : 'Lancer le rapprochement'}
                    </button>
                </div>

                {/* Statistiques */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center gap-2 text-xs text-gray-500"><Clock size={16} className="text-gray-500" /> Total transactions</div>
                            <p className="text-xl font-bold text-gray-900 mt-1">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center gap-2 text-xs text-gray-500"><AlertTriangle size={16} className="text-yellow-500" /> Écarts non résolus</div>
                            <p className="text-xl font-bold text-yellow-600 mt-1">{stats.ecarts}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center gap-2 text-xs text-gray-500"><CheckCircle size={16} className="text-green-500" /> Résolus</div>
                            <p className="text-xl font-bold text-green-600 mt-1">{stats.resolvus}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center gap-2 text-xs text-gray-500"><DollarSign size={16} className="text-blue-500" /> Taux de résolution</div>
                            <p className="text-xl font-bold text-blue-600 mt-1">{stats.tauxResolution}%</p>
                        </div>
                    </div>
                )}

                {/* Liste des écarts */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-5">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900">Écarts de rapprochement</h2>
                        <span className="text-sm text-gray-400">{ecarts.length} écart(s)</span>
                    </div>

                    {ecarts.length === 0 ? (
                        <div className="text-center py-16">
                            <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                            <p className="text-gray-500">Aucun écart de rapprochement</p>
                            <p className="text-sm text-gray-400 mt-1">Toutes les transactions sont bien synchronisées</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commande</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Jèko</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Wallet</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Écart</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                        <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {ecarts.map((ecart) => (
                                        <tr key={ecart._id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 font-mono text-sm font-medium text-gray-900">
                                                #{ecart.orderId?._id?.slice(-6).toUpperCase() || '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getTypeEcartColor(ecart.typeEcart)}`}>
                                                    {getTypeEcartLabel(ecart.typeEcart)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                {ecart.jekoAmount?.toLocaleString('fr-FR') || 0} FCFA
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {ecart.internalAmount?.toLocaleString('fr-FR') || 0} FCFA
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-red-500">
                                                {ecart.montantEcart?.toLocaleString('fr-FR') || 0} FCFA
                                            </td>
                                            <td className="px-6 py-4">
                                                {ecart.resolu ? (
                                                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">✅ Résolu</span>
                                                ) : (
                                                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700">⏳ En attente</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => { setSelectedEcart(ecart); setShowDetail(true); }}
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
                    )}
                </div>

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
            {showDetail && selectedEcart && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900">Détail de l'écart</h3>
                            <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Commande</span><span className="font-mono font-medium">#{selectedEcart.orderId?._id?.slice(-6).toUpperCase() || '—'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeEcartColor(selectedEcart.typeEcart)}`}>{getTypeEcartLabel(selectedEcart.typeEcart)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Jèko</span><span className="font-medium">{selectedEcart.jekoAmount?.toLocaleString('fr-FR') || 0} FCFA</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Wallet</span><span className="font-medium">{selectedEcart.internalAmount?.toLocaleString('fr-FR') || 0} FCFA</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Écart</span><span className="font-bold text-red-500">{selectedEcart.montantEcart?.toLocaleString('fr-FR') || 0} FCFA</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Référence Jèko</span><span className="font-mono text-xs">{selectedEcart.jekoReference || '—'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{new Date(selectedEcart.runDate).toLocaleDateString('fr-FR')}</span></div>
                            {selectedEcart.noteResolution && (
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="font-medium text-gray-700">Note de résolution</p>
                                    <p className="text-gray-600">{selectedEcart.noteResolution}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 mt-5">
                            {!selectedEcart.resolu && (
                                <button onClick={() => handleResolve(selectedEcart._id)} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition">
                                    <CheckCircle size={16} className="inline mr-1" /> Résoudre
                                </button>
                            )}
                            <button onClick={() => setShowDetail(false)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reconciliation;