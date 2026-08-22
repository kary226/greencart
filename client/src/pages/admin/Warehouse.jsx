import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Package, Search, Plus, X, Loader2, Camera, Eye, ChevronLeft, ChevronRight,
    CheckCircle, XCircle, Clock, AlertTriangle, Truck, Box, RefreshCw
} from 'lucide-react';

const Warehouse = () => {
    const { axios } = useAppContext();
    const [scans, setScans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [showScanForm, setShowScanForm] = useState(false);
    const [scanForm, setScanForm] = useState({
        orderId: '',
        type: 'reception',
        emplacement: '',
        note: '',
        photos: [],
    });
    const [submitting, setSubmitting] = useState(false);

    const fetchScans = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
            });
            if (filter !== 'all') params.append('type', filter);
            if (searchTerm) params.append('search', searchTerm);

            const { data } = await axios.get(`/api/admin/warehouse/scans?${params}`);
            if (data.success) {
                setScans(data.scans || []);
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
        fetchScans();
    }, [currentPage, filter, searchTerm]);

    const handleScanSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const formData = new FormData();
        formData.append('orderId', scanForm.orderId);
        formData.append('type', scanForm.type);
        formData.append('emplacement', scanForm.emplacement || '');
        formData.append('note', scanForm.note || '');
        scanForm.photos.forEach((photo, i) => {
            formData.append('photos', photo);
        });

        try {
            const { data } = await axios.post('/api/admin/warehouse/scan', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (data.success) {
                toast.success(data.message);
                setShowScanForm(false);
                resetScanForm();
                fetchScans();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const resetScanForm = () => {
        setScanForm({
            orderId: '',
            type: 'reception',
            emplacement: '',
            note: '',
            photos: [],
        });
    };

    const getTypeLabel = (type) => {
        const map = {
            reception: '📦 Réception',
            preparation: '📋 Préparation',
            expedition: '🚚 Expédition',
            retour_reception: '📦 Retour reçu',
            retour_inspection: '🔍 Inspection retour',
            retour_decision: '✅ Décision retour',
        };
        return map[type] || type;
    };

    const getTypeColor = (type) => {
        const map = {
            reception: 'bg-blue-100 text-blue-700',
            preparation: 'bg-yellow-100 text-yellow-700',
            expedition: 'bg-purple-100 text-purple-700',
            retour_reception: 'bg-orange-100 text-orange-700',
            retour_inspection: 'bg-red-100 text-red-700',
            retour_decision: 'bg-green-100 text-green-700',
        };
        return map[type] || 'bg-gray-100 text-gray-700';
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

    if (loading && scans.length === 0) {
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
                        <h1 className="text-2xl font-bold text-gray-900">Entrepôt</h1>
                        <p className="text-sm text-gray-500 mt-1">{total} scan(s) enregistré(s)</p>
                    </div>
                    <button
                        onClick={() => { setShowScanForm(!showScanForm); if (!showScanForm) resetScanForm(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                    >
                        <Plus size={16} />
                        {showScanForm ? 'Annuler' : 'Nouveau scan'}
                    </button>
                </div>

                {/* Formulaire */}
                {showScanForm && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-5">
                        <h2 className="font-semibold text-gray-900 mb-4">Nouveau scan d'entrepôt</h2>
                        <form onSubmit={handleScanSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Commande *</label>
                                    <input
                                        type="text"
                                        value={scanForm.orderId}
                                        onChange={(e) => setScanForm({ ...scanForm, orderId: e.target.value })}
                                        placeholder="ID de la commande"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type de scan *</label>
                                    <select
                                        value={scanForm.type}
                                        onChange={(e) => setScanForm({ ...scanForm, type: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                        required
                                    >
                                        <option value="reception">Réception</option>
                                        <option value="preparation">Préparation</option>
                                        <option value="expedition">Expédition</option>
                                        <option value="retour_reception">Retour reçu</option>
                                        <option value="retour_inspection">Inspection retour</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Emplacement</label>
                                <input
                                    type="text"
                                    value={scanForm.emplacement}
                                    onChange={(e) => setScanForm({ ...scanForm, emplacement: e.target.value })}
                                    placeholder="Ex: A1-B2"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                                <textarea
                                    value={scanForm.note}
                                    onChange={(e) => setScanForm({ ...scanForm, note: e.target.value })}
                                    placeholder="État constaté, anomalies, etc."
                                    rows={2}
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
                                        setScanForm({ ...scanForm, photos: files });
                                    }}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">Jusqu'à 5 photos</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                    {submitting ? <Loader2 size={16} className="animate-spin inline" /> : 'Enregistrer le scan'}
                                </button>
                                <button type="button" onClick={() => setShowScanForm(false)} className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Statistiques */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    <StatCard icon={Package} label="Total scans" value={total} color="gray" />
                    <StatCard icon={Box} label="Réceptions" value={scans.filter(s => s.type === 'reception').length} color="blue" />
                    <StatCard icon={Truck} label="Expéditions" value={scans.filter(s => s.type === 'expedition').length} color="purple" />
                    <StatCard icon={AlertTriangle} label="Retours" value={scans.filter(s => s.type === 'retour_reception' || s.type === 'retour_inspection').length} color="orange" />
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
                            <option value="all">Tous les types</option>
                            <option value="reception">Réception</option>
                            <option value="preparation">Préparation</option>
                            <option value="expedition">Expédition</option>
                            <option value="retour_reception">Retour reçu</option>
                            <option value="retour_inspection">Inspection retour</option>
                        </select>
                        <button onClick={fetchScans} className="px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm hover:bg-gray-200 transition">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Liste */}
                {scans.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <Camera size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucun scan d'entrepôt</p>
                        <p className="text-sm text-gray-400 mt-1">Commencez par enregistrer une réception</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-5">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commande</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Emplacement</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Photos</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Opérateur</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {scans.map((scan) => (
                                        <tr key={scan._id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 font-mono text-sm font-medium text-gray-900">
                                                #{scan.orderId?._id?.slice(-6).toUpperCase() || scan.orderId?.slice(-6) || '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getTypeColor(scan.type)}`}>
                                                    {getTypeLabel(scan.type)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{scan.emplacement || '—'}</td>
                                            <td className="px-6 py-4">
                                                {scan.photos?.length > 0 ? (
                                                    <div className="flex -space-x-2">
                                                        {scan.photos.slice(0, 3).map((photo, i) => (
                                                            <a key={i} href={photo} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border-2 border-white overflow-hidden hover:z-10">
                                                                <img src={photo} alt="" className="w-full h-full object-cover" />
                                                            </a>
                                                        ))}
                                                        {scan.photos.length > 3 && (
                                                            <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                                                +{scan.photos.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{scan.scannePar?.nom || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(scan.scanneLe).toLocaleString('fr-FR')}
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
        </div>
    );
};

export default Warehouse;