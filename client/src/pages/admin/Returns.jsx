import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Package, Search, Loader2, ChevronLeft, ChevronRight, RefreshCw,
    Clock, CheckCircle, XCircle, AlertTriangle, Eye, Camera,
    User, Calendar, DollarSign, FileText, Plus
} from 'lucide-react';

const Returns = () => {
    const { axios } = useAppContext();
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [selectedReturn, setSelectedReturn] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showInspectModal, setShowInspectModal] = useState(false);
    const [showResolveModal, setShowResolveModal] = useState(false);

    const [inspectForm, setInspectForm] = useState({
        etat: 'bon_etat',
        note: '',
        photos: [],
    });
    const [resolveForm, setResolveForm] = useState({
        resolution: 'refund_client',
        responsabilite: 'non_determinee',
        montantDecide: '',
        remboursementMethode: 'rcoins',
        motif: '',
        noteInterne: '',
        noteClient: '',
    });
    const [submitting, setSubmitting] = useState(false);

    const fetchReturns = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
            });
            if (filter !== 'all') params.append('statut', filter);
            if (searchTerm) params.append('search', searchTerm);

            const { data } = await axios.get(`/api/admin/returns?${params}`);
            if (data.success) {
                setReturns(data.returns || []);
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
        fetchReturns();
    }, [currentPage, filter, searchTerm]);

    const viewReturn = async (id) => {
        try {
            const { data } = await axios.get(`/api/admin/returns/${id}`);
            if (data.success) {
                setSelectedReturn(data.return);
                setShowDetailModal(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const handleInspect = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const formData = new FormData();
        formData.append('etat', inspectForm.etat);
        formData.append('note', inspectForm.note);
        inspectForm.photos.forEach((photo) => {
            formData.append('photos', photo);
        });

        try {
            const { data } = await axios.post(`/api/admin/returns/${selectedReturn._id}/inspect`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (data.success) {
                toast.success(data.message);
                setShowInspectModal(false);
                setShowDetailModal(false);
                fetchReturns();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleResolve = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const payload = {
            resolution: resolveForm.resolution,
            responsabilite: resolveForm.responsabilite,
            montantDecide: parseFloat(resolveForm.montantDecide) || 0,
            remboursementMethode: resolveForm.remboursementMethode,
            motif: resolveForm.motif,
            noteInterne: resolveForm.noteInterne,
            noteClient: resolveForm.noteClient,
        };

        try {
            const { data } = await axios.post(`/api/admin/returns/${selectedReturn._id}/resolve`, payload);
            if (data.success) {
                toast.success(data.message);
                setShowResolveModal(false);
                setShowDetailModal(false);
                fetchReturns();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!window.confirm('Confirmer le rejet de ce retour ?')) return;
        setSubmitting(true);
        try {
            const { data } = await axios.post(`/api/admin/returns/${selectedReturn._id}/reject`, {
                motif: 'Rejeté par l\'admin',
                noteInterne: 'Aucun remboursement',
            });
            if (data.success) {
                toast.success(data.message);
                setShowDetailModal(false);
                fetchReturns();
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
            return_requested: '📩 Demande de retour',
            return_pickup: '📦 Colis récupéré',
            return_received: '📦 Colis reçu',
            return_inspection: '🔍 En inspection',
            resolved: '✅ Résolu',
        };
        return map[statut] || statut;
    };

    const getStatusColor = (statut) => {
        const map = {
            return_requested: 'bg-yellow-100 text-yellow-700',
            return_pickup: 'bg-blue-100 text-blue-700',
            return_received: 'bg-green-100 text-green-700',
            return_inspection: 'bg-orange-100 text-orange-700',
            resolved: 'bg-purple-100 text-purple-700',
        };
        return map[statut] || 'bg-gray-100 text-gray-700';
    };

    const getResolutionLabel = (resolution) => {
        const map = {
            refund_client: '💰 Remboursé',
            reroute_to_seller: '🔄 Renvoyé au commerçant',
            reject_return: '❌ Rejeté',
            partial_refund: '💰 Remboursement partiel',
        };
        return map[resolution] || resolution;
    };

    if (loading && returns.length === 0) {
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
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Retours</h1>
                    <p className="text-sm text-gray-500 mt-1">{total} retour(s)</p>
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500"><Clock size={16} className="text-yellow-500" /> En attente</div>
                        <p className="text-xl font-bold text-gray-900 mt-1">{returns.filter(r => r.statut !== 'resolved').length}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500"><Camera size={16} className="text-orange-500" /> En inspection</div>
                        <p className="text-xl font-bold text-gray-900 mt-1">{returns.filter(r => r.statut === 'return_inspection').length}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500"><CheckCircle size={16} className="text-green-500" /> Résolus</div>
                        <p className="text-xl font-bold text-gray-900 mt-1">{returns.filter(r => r.statut === 'resolved').length}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500"><DollarSign size={16} className="text-purple-500" /> Montant total remboursé</div>
                        <p className="text-xl font-bold text-gray-900 mt-1">
                            {returns.reduce((sum, r) => sum + (r.montantDecide || 0), 0).toLocaleString('fr-FR')} FCFA
                        </p>
                    </div>
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
                            <option value="return_requested">Demande de retour</option>
                            <option value="return_pickup">Colis récupéré</option>
                            <option value="return_received">Colis reçu</option>
                            <option value="return_inspection">En inspection</option>
                            <option value="resolved">Résolus</option>
                        </select>
                        <button onClick={fetchReturns} className="px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm hover:bg-gray-200 transition">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Liste */}
                {returns.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <Package size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucun retour</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-5">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commande</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Responsabilité</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Scans</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Créé le</th>
                                        <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {returns.map((returnCase) => (
                                        <tr key={returnCase._id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 font-mono text-sm font-medium text-gray-900">
                                                #{returnCase.orderId?._id?.slice(-6).toUpperCase() || returnCase.orderId?.slice(-6) || '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(returnCase.statut)}`}>
                                                    {getStatusLabel(returnCase.statut)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {returnCase.responsabilite === 'commercant' && '🛒 Commerçant'}
                                                {returnCase.responsabilite === 'transport' && '🚚 Transport'}
                                                {returnCase.responsabilite === 'client' && '👤 Client'}
                                                {returnCase.responsabilite === 'non_determinee' && '—'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                {returnCase.montantDecide > 0 ? `${returnCase.montantDecide.toLocaleString('fr-FR')} FCFA` : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {returnCase.scans?.length || 0}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(returnCase.createdAt).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => viewReturn(returnCase._id)}
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
            {showDetailModal && selectedReturn && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900">
                                Retour - #{selectedReturn.orderId?._id?.slice(-6).toUpperCase() || '—'}
                            </h3>
                            <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-gray-500">Statut</span><br /><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedReturn.statut)}`}>{getStatusLabel(selectedReturn.statut)}</span></div>
                                <div><span className="text-gray-500">Responsabilité</span><br /><span className="font-medium">{selectedReturn.responsabilite || 'Non déterminée'}</span></div>
                                <div><span className="text-gray-500">Montant décidé</span><br /><span className="font-bold text-red-500">{selectedReturn.montantDecide > 0 ? `${selectedReturn.montantDecide.toLocaleString('fr-FR')} FCFA` : '—'}</span></div>
                                <div><span className="text-gray-500">Résolution</span><br /><span className="font-medium">{selectedReturn.resolution ? getResolutionLabel(selectedReturn.resolution) : '—'}</span></div>
                            </div>

                            {selectedReturn.scans?.length > 0 && (
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="font-medium text-gray-700 mb-2">Scans associés ({selectedReturn.scans.length})</p>
                                    <div className="space-y-2">
                                        {selectedReturn.scans.map((scan, i) => (
                                            <div key={i} className="bg-gray-50 rounded-xl p-3 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="font-medium">{scan.type}</span>
                                                    <span className="text-gray-400">{new Date(scan.scanneLe).toLocaleString('fr-FR')}</span>
                                                </div>
                                                {scan.note && <p className="text-gray-600 mt-1">{scan.note}</p>}
                                                {scan.photos?.length > 0 && (
                                                    <div className="flex gap-2 mt-2">
                                                        {scan.photos.map((photo, j) => (
                                                            <a key={j} href={photo} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                                                                <img src={photo} alt="" className="w-full h-full object-cover" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedReturn.noteInterne && (
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="font-medium text-gray-700">Note interne</p>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">{selectedReturn.noteInterne}</p>
                                </div>
                            )}

                            {selectedReturn.noteClient && (
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="font-medium text-gray-700">Note client</p>
                                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-xl">{selectedReturn.noteClient}</p>
                                </div>
                            )}

                            <div className="flex gap-2 pt-4 border-t border-gray-100">
                                {selectedReturn.statut === 'return_received' && (
                                    <button onClick={() => { setShowInspectModal(true); }} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 transition">
                                        <Camera size={16} className="inline mr-1" /> Inspection
                                    </button>
                                )}
                                {selectedReturn.statut === 'return_inspection' && (
                                    <>
                                        <button onClick={() => { setShowResolveModal(true); }} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition">
                                            <CheckCircle size={16} className="inline mr-1" /> Résoudre
                                        </button>
                                        <button onClick={handleReject} disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-50">
                                            <XCircle size={16} className="inline mr-1" /> Rejeter
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Inspection */}
            {showInspectModal && selectedReturn && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Inspection du retour</h3>
                        <form onSubmit={handleInspect} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">État du colis</label>
                                <select
                                    value={inspectForm.etat}
                                    onChange={(e) => setInspectForm({ ...inspectForm, etat: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                    required
                                >
                                    <option value="bon_etat">✅ Bon état — remis en stock</option>
                                    <option value="endommage">❌ Endommagé — mis au rebut</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note d'inspection</label>
                                <textarea
                                    value={inspectForm.note}
                                    onChange={(e) => setInspectForm({ ...inspectForm, note: e.target.value })}
                                    placeholder="État constaté, anomalies..."
                                    rows={3}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        setInspectForm({ ...inspectForm, photos: files });
                                    }}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 transition disabled:opacity-50">
                                    {submitting ? <Loader2 size={16} className="animate-spin inline" /> : 'Enregistrer l\'inspection'}
                                </button>
                                <button type="button" onClick={() => setShowInspectModal(false)} className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Résolution */}
            {showResolveModal && selectedReturn && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-semibold text-gray-900 mb-4">Résoudre le retour</h3>
                        <form onSubmit={handleResolve} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Résolution</label>
                                <select
                                    value={resolveForm.resolution}
                                    onChange={(e) => setResolveForm({ ...resolveForm, resolution: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                    required
                                >
                                    <option value="refund_client">💰 Rembourser le client</option>
                                    <option value="reroute_to_seller">🔄 Renvoyer au commerçant</option>
                                    <option value="reject_return">❌ Rejeter le retour</option>
                                    <option value="partial_refund">💰 Remboursement partiel</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Responsabilité</label>
                                <select
                                    value={resolveForm.responsabilite}
                                    onChange={(e) => setResolveForm({ ...resolveForm, responsabilite: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                >
                                    <option value="non_determinee">Non déterminée</option>
                                    <option value="commercant">Commerçant</option>
                                    <option value="transport">Transport</option>
                                    <option value="client">Client</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Montant décidé (FCFA)</label>
                                <input
                                    type="number"
                                    value={resolveForm.montantDecide}
                                    onChange={(e) => setResolveForm({ ...resolveForm, montantDecide: e.target.value })}
                                    placeholder="0"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de remboursement</label>
                                <select
                                    value={resolveForm.remboursementMethode}
                                    onChange={(e) => setResolveForm({ ...resolveForm, remboursementMethode: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                >
                                    <option value="rcoins">RCOINS</option>
                                    <option value="moyen_paiement_origine">Moyen d'origine</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
                                <textarea
                                    value={resolveForm.motif}
                                    onChange={(e) => setResolveForm({ ...resolveForm, motif: e.target.value })}
                                    placeholder="Raison du remboursement"
                                    rows={2}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none resize-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note interne</label>
                                <textarea
                                    value={resolveForm.noteInterne}
                                    onChange={(e) => setResolveForm({ ...resolveForm, noteInterne: e.target.value })}
                                    placeholder="Visible uniquement par le staff"
                                    rows={2}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note client</label>
                                <textarea
                                    value={resolveForm.noteClient}
                                    onChange={(e) => setResolveForm({ ...resolveForm, noteClient: e.target.value })}
                                    placeholder="Message visible par le client"
                                    rows={2}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none resize-none"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">
                                    {submitting ? <Loader2 size={16} className="animate-spin inline" /> : 'Confirmer la résolution'}
                                </button>
                                <button type="button" onClick={() => setShowResolveModal(false)} className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Returns;