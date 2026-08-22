import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Search, Plus, X, Loader2, Pencil, Trash2, ChevronLeft, ChevronRight,
    Tag, CheckCircle, XCircle, Clock, AlertCircle
} from 'lucide-react';

const Coupons = () => {
    const { axios } = useAppContext();
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        code: '',
        discountType: 'percentage',
        discountValue: '',
        minPurchase: '',
        maxDiscount: '',
        startDate: '',
        endDate: '',
        usageLimit: '',
        usagePerUser: '1',
        isActive: true
    });

    const fetchCoupons = async () => {
        try {
            const { data } = await axios.get('/api/coupon/admin-list');
            if (data.success) setCoupons(data.coupons);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCoupons();
    }, []);

    const getCouponStatus = (coupon) => {
        const now = new Date();
        const start = new Date(coupon.startDate);
        const end = new Date(coupon.endDate);
        if (!coupon.isActive) return 'inactive';
        if (now < start) return 'upcoming';
        if (now > end) return 'expired';
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return 'exhausted';
        return 'active';
    };

    const getStatusStyle = (coupon) => {
        const status = getCouponStatus(coupon);
        const map = {
            active: { bg: 'bg-green-50', text: 'text-green-700', label: 'Actif', icon: <CheckCircle size={12} /> },
            upcoming: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'À venir', icon: <Clock size={12} /> },
            expired: { bg: 'bg-red-50', text: 'text-red-700', label: 'Expiré', icon: <XCircle size={12} /> },
            exhausted: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Épuisé', icon: <AlertCircle size={12} /> },
            inactive: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Désactivé', icon: <XCircle size={12} /> },
        };
        return map[status] || map.inactive;
    };

    const filteredCoupons = useMemo(() => {
        let filtered = [...coupons];
        if (searchTerm) {
            filtered = filtered.filter(c => c.code.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        if (statusFilter !== 'all') {
            filtered = filtered.filter(c => getCouponStatus(c) === statusFilter);
        }
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return filtered;
    }, [coupons, searchTerm, statusFilter]);

    const totalCoupons = filteredCoupons.length;
    const totalPages = Math.ceil(totalCoupons / itemsPerPage);
    const paginatedCoupons = filteredCoupons.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => setCurrentPage(1), [searchTerm, statusFilter]);

    const stats = {
        total: coupons.length,
        active: coupons.filter(c => getCouponStatus(c) === 'active').length,
        expired: coupons.filter(c => getCouponStatus(c) === 'expired').length,
        upcoming: coupons.filter(c => getCouponStatus(c) === 'upcoming').length,
        totalUsage: coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)
    };

    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        setFormData({ ...formData, code: result });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const endpoint = editingCoupon ? '/api/coupon/update' : '/api/coupon/add';
            const { data } = await axios.post(endpoint, formData);
            if (data.success) {
                toast.success(data.message);
                setShowForm(false);
                resetForm();
                fetchCoupons();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setEditingCoupon(null);
        setFormData({ code: '', discountType: 'percentage', discountValue: '', minPurchase: '', maxDiscount: '', startDate: '', endDate: '', usageLimit: '', usagePerUser: '1', isActive: true });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce code promo ?')) return;
        try {
            const { data } = await axios.post('/api/coupon/delete', { id });
            if (data.success) {
                toast.success(data.message);
                fetchCoupons();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const toggleStatus = async (id, isActive) => {
        try {
            const { data } = await axios.post('/api/coupon/toggle', { id, isActive: !isActive });
            if (data.success) {
                toast.success(data.message);
                fetchCoupons();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleEdit = (coupon) => {
        setEditingCoupon(coupon);
        setFormData({
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minPurchase: coupon.minPurchase || '',
            maxDiscount: coupon.maxDiscount || '',
            startDate: coupon.startDate?.split('T')[0] || '',
            endDate: coupon.endDate?.split('T')[0] || '',
            usageLimit: coupon.usageLimit || '',
            usagePerUser: coupon.usagePerUser || '1',
            isActive: coupon.isActive
        });
        setShowForm(true);
    };

    if (loading) {
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
                        <h1 className="text-2xl font-bold text-gray-900">Codes promo</h1>
                        <p className="text-sm text-gray-500 mt-1">{stats.total} codes · {stats.active} actifs · {stats.totalUsage} utilisations</p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowForm(!showForm); }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                    >
                        <Plus size={16} />
                        {showForm ? 'Annuler' : 'Ajouter un code'}
                    </button>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-5">
                        <h2 className="font-semibold text-gray-900 mb-4">
                            {editingCoupon ? 'Modifier' : 'Nouveau'} code promo
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm uppercase" placeholder="EX: PROMO20" required />
                                        <button type="button" onClick={generateRandomCode} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">🎲</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type de réduction *</label>
                                    <select value={formData.discountType} onChange={(e) => setFormData({ ...formData, discountType: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm">
                                        <option value="percentage">Pourcentage (%)</option>
                                        <option value="fixed">Montant fixe (FCFA)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valeur *</label>
                                    <input type="number" value={formData.discountValue} onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" placeholder={formData.discountType === 'percentage' ? 'Ex: 20' : 'Ex: 1000'} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Montant minimum</label>
                                    <input type="number" value={formData.minPurchase} onChange={(e) => setFormData({ ...formData, minPurchase: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" placeholder="Optionnel" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Réduction maximale</label>
                                    <input type="number" value={formData.maxDiscount} onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" placeholder="Optionnel (pour %)" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Utilisations max</label>
                                    <input type="number" value={formData.usageLimit} onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" placeholder="Illimité" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Par utilisateur</label>
                                    <input type="number" value={formData.usagePerUser} onChange={(e) => setFormData({ ...formData, usagePerUser: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                                    <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin *</label>
                                    <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" required />
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 text-red-500 rounded" />
                                    <span className="text-sm text-gray-700">Activer immédiatement</span>
                                </label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                    {submitting ? <Loader2 size={16} className="animate-spin inline" /> : (editingCoupon ? 'Mettre à jour' : 'Ajouter')}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Rechercher un code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-gray-400 outline-none text-sm" />
                        </div>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white">
                            <option value="all">Tous</option>
                            <option value="active">Actifs</option>
                            <option value="expired">Expirés</option>
                            <option value="upcoming">À venir</option>
                            <option value="exhausted">Épuisés</option>
                            <option value="inactive">Désactivés</option>
                        </select>
                        <span className="text-xs text-gray-400 flex items-center">{totalCoupons} code(s)</span>
                    </div>
                </div>

                {/* Liste */}
                {paginatedCoupons.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <Tag size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucun code promo trouvé</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-5">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Réduction</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Validité</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisations</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedCoupons.map((coupon) => {
                                        const status = getStatusStyle(coupon);
                                        const usagePercent = coupon.usageLimit ? Math.round((coupon.usedCount / coupon.usageLimit) * 100) : 0;
                                        return (
                                            <tr key={coupon._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 font-mono text-sm font-bold text-gray-900">{coupon.code}</td>
                                                <td className="px-6 py-4">
                                                    <span className="font-semibold text-red-600">
                                                        {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue.toLocaleString()} FCFA`}
                                                    </span>
                                                    {coupon.maxDiscount > 0 && coupon.discountType === 'percentage' && (
                                                        <span className="block text-xs text-gray-400">max {coupon.maxDiscount.toLocaleString()} FCFA</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <div>{new Date(coupon.startDate).toLocaleDateString()}</div>
                                                    <div className="text-xs text-gray-400">→ {new Date(coupon.endDate).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-sm text-gray-600">{coupon.usedCount} / {coupon.usageLimit || '∞'}</span>
                                                        {coupon.usageLimit && (
                                                            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(usagePercent, 100)}%` }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                                                        {status.icon} {status.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button onClick={() => toggleStatus(coupon._id, coupon.isActive)} className={`text-xs px-3 py-1.5 rounded-lg transition ${coupon.isActive ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' : 'text-green-600 bg-green-50 hover:bg-green-100'}`}>
                                                            {coupon.isActive ? 'Désactiver' : 'Activer'}
                                                        </button>
                                                        <button onClick={() => handleEdit(coupon)} className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Modifier</button>
                                                        <button onClick={() => handleDelete(coupon._id)} className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Supprimer</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
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

export default Coupons;