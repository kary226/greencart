import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const CouponManager = () => {
    const { axios } = useAppContext();
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);
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
            if (data.success) {
                setCoupons(data.coupons);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCoupons();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            let res;
            if (editingCoupon) {
                res = await axios.post('/api/coupon/update', { id: editingCoupon._id, ...formData });
            } else {
                res = await axios.post('/api/coupon/add', formData);
            }
            
            if (res.data.success) {
                toast.success(res.data.message);
                setShowForm(false);
                setEditingCoupon(null);
                setFormData({
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
                fetchCoupons();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
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

    const handleToggleStatus = async (id, isActive) => {
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
            startDate: coupon.startDate.split('T')[0],
            endDate: coupon.endDate.split('T')[0],
            usageLimit: coupon.usageLimit || '',
            usagePerUser: coupon.usagePerUser || '1',
            isActive: coupon.isActive
        });
        setShowForm(true);
    };

    const getStatusBadge = (coupon) => {
        const now = new Date();
        const start = new Date(coupon.startDate);
        const end = new Date(coupon.endDate);
        
        if (!coupon.isActive) return 'bg-gray-100 text-gray-500';
        if (now < start) return 'bg-yellow-100 text-yellow-700';
        if (now > end) return 'bg-red-100 text-red-700';
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return 'bg-red-100 text-red-700';
        return 'bg-green-100 text-green-700';
    };

    const getStatusText = (coupon) => {
        const now = new Date();
        const start = new Date(coupon.startDate);
        const end = new Date(coupon.endDate);
        
        if (!coupon.isActive) return 'Désactivé';
        if (now < start) return 'À venir';
        if (now > end) return 'Expiré';
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return 'Épuisé';
        return 'Actif';
    };

    if (loading) {
        return <div className="p-10 text-center">Chargement...</div>;
    }

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll">
            <div className="md:p-10 p-4 space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Codes promo</h2>
                    <button
                        onClick={() => {
                            setEditingCoupon(null);
                            setFormData({
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
                            setShowForm(!showForm);
                        }}
                        className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                    >
                        {showForm ? 'Annuler' : '+ Ajouter un code promo'}
                    </button>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4">
                        <h3 className="text-lg font-semibold">{editingCoupon ? 'Modifier' : 'Ajouter'} un code promo</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Code promo *</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary uppercase"
                                    placeholder="EX: PROMO20"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Type de réduction *</label>
                                <select
                                    value={formData.discountType}
                                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                >
                                    <option value="percentage">Pourcentage (%)</option>
                                    <option value="fixed">Montant fixe (FCFA)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Valeur de réduction *</label>
                                <input
                                    type="number"
                                    value={formData.discountValue}
                                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    placeholder={formData.discountType === 'percentage' ? 'Ex: 20' : 'Ex: 1000'}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Montant minimum d'achat</label>
                                <input
                                    type="number"
                                    value={formData.minPurchase}
                                    onChange={(e) => setFormData({ ...formData, minPurchase: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    placeholder="Ex: 5000 (optionnel)"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Réduction maximale</label>
                                <input
                                    type="number"
                                    value={formData.maxDiscount}
                                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    placeholder="Ex: 2000 (optionnel, % uniquement)"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre max d'utilisations total</label>
                                <input
                                    type="number"
                                    value={formData.usageLimit}
                                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    placeholder="Ex: 100 (optionnel)"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Utilisations par utilisateur</label>
                                <input
                                    type="number"
                                    value={formData.usagePerUser}
                                    onChange={(e) => setFormData({ ...formData, usagePerUser: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    placeholder="Ex: 1 (défaut)"
                                />
                                <p className="text-xs text-gray-400 mt-1">Nombre de fois qu'un même utilisateur peut utiliser ce code</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Date de début *</label>
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Date de fin *</label>
                                <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium">Activer immédiatement</span>
                            </label>
                        </div>

                        <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition">
                            {editingCoupon ? 'Mettre à jour' : 'Ajouter'}
                        </button>
                    </form>
                )}

                {/* Liste des coupons */}
                <div className="overflow-x-auto">
                    <table className="w-full bg-white border rounded-xl overflow-hidden">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left">Code</th>
                                <th className="px-4 py-3 text-left">Réduction</th>
                                <th className="px-4 py-3 text-left">Min. d'achat</th>
                                <th className="px-4 py-3 text-left">Validité</th>
                                <th className="px-4 py-3 text-left">Utilisations</th>
                                <th className="px-4 py-3 text-left">Par utilisateur</th>
                                <th className="px-4 py-3 text-left">Statut</th>
                                <th className="px-4 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {coupons.map((coupon) => (
                                <tr key={coupon._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono font-bold text-primary">{coupon.code}</td>
                                    <td className="px-4 py-3">
                                        {coupon.discountType === 'percentage' 
                                            ? `${coupon.discountValue}%` 
                                            : `${coupon.discountValue} FCFA`}
                                    </td>
                                    <td className="px-4 py-3">{coupon.minPurchase > 0 ? `${coupon.minPurchase} FCFA` : '-'}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {new Date(coupon.startDate).toLocaleDateString()}<br/>
                                        → {new Date(coupon.endDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        {coupon.usedCount} / {coupon.usageLimit || '∞'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {coupon.usagePerUser || 1} fois
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(coupon)}`}>
                                            {getStatusText(coupon)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleToggleStatus(coupon._id, coupon.isActive)}
                                                className={`text-sm px-3 py-1 rounded transition ${
                                                    coupon.isActive 
                                                        ? 'bg-red-50 text-red-500 hover:bg-red-100' 
                                                        : 'bg-green-50 text-green-500 hover:bg-green-100'
                                                }`}
                                            >
                                                {coupon.isActive ? 'Désactiver' : 'Activer'}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(coupon)}
                                                className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 transition"
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                onClick={() => handleDelete(coupon._id)}
                                                className="text-sm bg-red-50 text-red-500 px-3 py-1 rounded hover:bg-red-100 transition"
                                            >
                                                Supprimer
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {coupons.length === 0 && !showForm && (
                    <p className="text-gray-500 text-center py-10">Aucun code promo. Cliquez sur "Ajouter un code promo" pour commencer.</p>
                )}
            </div>
        </div>
    );
};

export default CouponManager;