import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const CouponManager = () => {
    const { axios } = useAppContext();
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);
    
    // 🔍 ÉTATS POUR LA RECHERCHE ET LES FILTRES
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, active, expired, upcoming, inactive
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');
    
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

    // 📊 Fonction pour obtenir le statut d'un coupon
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
        switch(status) {
            case 'active':
                return { bg: 'bg-green-100', text: 'text-green-700', label: 'Actif', icon: '✅' };
            case 'upcoming':
                return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'À venir', icon: '⏳' };
            case 'expired':
                return { bg: 'bg-red-100', text: 'text-red-700', label: 'Expiré', icon: '❌' };
            case 'exhausted':
                return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Épuisé', icon: '📊' };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Désactivé', icon: '⏸️' };
        }
    };

    // 📊 COUPONS FILTRÉS ET TRIÉS
    const filteredCoupons = useMemo(() => {
        let filtered = [...coupons];

        // Recherche par code
        if (searchTerm) {
            filtered = filtered.filter(c => 
                c.code.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filtre par statut
        if (statusFilter !== 'all') {
            filtered = filtered.filter(c => getCouponStatus(c) === statusFilter);
        }

        // Tri
        filtered.sort((a, b) => {
            let aVal, bVal;
            switch (sortBy) {
                case 'code':
                    aVal = a.code;
                    bVal = b.code;
                    break;
                case 'discount':
                    aVal = a.discountValue;
                    bVal = b.discountValue;
                    break;
                case 'validity':
                    aVal = new Date(a.startDate);
                    bVal = new Date(b.startDate);
                    break;
                case 'usage':
                    aVal = (a.usedCount / (a.usageLimit || Infinity)) * 100;
                    bVal = (b.usedCount / (b.usageLimit || Infinity)) * 100;
                    break;
                default:
                    aVal = new Date(a.createdAt);
                    bVal = new Date(b.createdAt);
            }
            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        return filtered;
    }, [coupons, searchTerm, statusFilter, sortBy, sortOrder]);

    // 📄 PAGINATION
    const totalCoupons = filteredCoupons.length;
    const totalPages = Math.ceil(totalCoupons / itemsPerPage);
    const paginatedCoupons = filteredCoupons.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page quand les filtres changent
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, sortBy, sortOrder]);

    // 📊 STATISTIQUES
    const stats = {
        total: coupons.length,
        active: coupons.filter(c => getCouponStatus(c) === 'active').length,
        expired: coupons.filter(c => getCouponStatus(c) === 'expired').length,
        upcoming: coupons.filter(c => getCouponStatus(c) === 'upcoming').length,
        totalUsage: coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)
    };

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
            startDate: coupon.startDate?.split('T')[0] || '',
            endDate: coupon.endDate?.split('T')[0] || '',
            usageLimit: coupon.usageLimit || '',
            usagePerUser: coupon.usagePerUser || '1',
            isActive: coupon.isActive
        });
        setShowForm(true);
    };

    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData({ ...formData, code: result });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-500">Chargement des codes promo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6 space-y-6">
                {/* Header avec statistiques */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Codes promo</h1>
                    <p className="text-sm text-gray-500 mt-1">Gérez les réductions et promotions</p>
                    
                    {/* Cartes statistiques */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Actifs</p>
                            <p className="text-xl font-bold text-green-600">{stats.active}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Expirés</p>
                            <p className="text-xl font-bold text-red-500">{stats.expired}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">À venir</p>
                            <p className="text-xl font-bold text-yellow-600">{stats.upcoming}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Utilisations</p>
                            <p className="text-xl font-bold text-blue-600">{stats.totalUsage}</p>
                        </div>
                    </div>
                </div>

                {/* Barre de recherche et filtres */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Recherche */}
                        <div className="flex-1">
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Rechercher un code promo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm"
                                />
                            </div>
                        </div>

                        {/* Filtre par statut */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="active">Actifs</option>
                            <option value="expired">Expirés</option>
                            <option value="upcoming">À venir</option>
                            <option value="exhausted">Épuisés</option>
                            <option value="inactive">Désactivés</option>
                        </select>

                        {/* Tri */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="createdAt">Trier par date</option>
                            <option value="code">Trier par code</option>
                            <option value="discount">Trier par réduction</option>
                            <option value="validity">Trier par validité</option>
                            <option value="usage">Trier par utilisation</option>
                        </select>

                        {/* Ordre de tri */}
                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition flex items-center gap-2"
                        >
                            {sortOrder === 'asc' ? '↑ Croissant' : '↓ Décroissant'}
                        </button>

                        {/* Bouton ajouter */}
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
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition shadow-sm"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="16"/>
                                <line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                            {showForm ? 'Annuler' : 'Ajouter un code promo'}
                        </button>
                    </div>

                    {/* Résultats */}
                    <div className="mt-3 text-xs text-gray-500">
                        {totalCoupons} code(s) promo trouvé(s)
                    </div>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingCoupon ? 'Modifier le code promo' : 'Nouveau code promo'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Code promo *</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none uppercase"
                                            placeholder="EX: PROMO20"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={generateRandomCode}
                                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition"
                                            title="Générer un code aléatoire"
                                        >
                                            🎲
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type de réduction *</label>
                                    <select
                                        value={formData.discountType}
                                        onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    >
                                        <option value="percentage">Pourcentage (%)</option>
                                        <option value="fixed">Montant fixe (FCFA)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valeur de réduction *</label>
                                    <input
                                        type="number"
                                        value={formData.discountValue}
                                        onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        placeholder={formData.discountType === 'percentage' ? 'Ex: 20' : 'Ex: 1000'}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Montant minimum d'achat</label>
                                    <input
                                        type="number"
                                        value={formData.minPurchase}
                                        onChange={(e) => setFormData({ ...formData, minPurchase: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        placeholder="Optionnel"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Réduction maximale</label>
                                    <input
                                        type="number"
                                        value={formData.maxDiscount}
                                        onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        placeholder="Optionnel (pour %)"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre max d'utilisations</label>
                                    <input
                                        type="number"
                                        value={formData.usageLimit}
                                        onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        placeholder="Illimité"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Utilisations par utilisateur</label>
                                    <input
                                        type="number"
                                        value={formData.usagePerUser}
                                        onChange={(e) => setFormData({ ...formData, usagePerUser: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin *</label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-4 h-4 text-red-500 focus:ring-red-500 rounded"
                                    />
                                    <span className="text-sm text-gray-700">Activer immédiatement</span>
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                    {editingCoupon ? 'Mettre à jour' : 'Ajouter le code promo'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-6 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                                >
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Liste des coupons */}
                {paginatedCoupons.length === 0 && !showForm ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M2 12l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2"/>
                            <path d="M2 4h20v16H2z"/>
                            <line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                        <p className="text-gray-500">Aucun code promo trouvé</p>
                        <p className="text-sm text-gray-400 mt-1">Cliquez sur "Ajouter un code promo" pour commencer</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Réduction</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Min. d'achat</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Validité</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisations</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedCoupons.map((coupon) => {
                                            const status = getStatusStyle(coupon);
                                            const usagePercent = coupon.usageLimit 
                                                ? Math.round((coupon.usedCount / coupon.usageLimit) * 100)
                                                : 0;
                                            return (
                                                <tr key={coupon._id} className="hover:bg-gray-50 transition">
                                                    <td className="px-6 py-4">
                                                        <span className="font-mono text-sm font-bold text-gray-900">{coupon.code}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        <span className="font-semibold text-red-600">
                                                            {coupon.discountType === 'percentage' 
                                                                ? `${coupon.discountValue}%` 
                                                                : `${coupon.discountValue.toLocaleString()} FCFA`}
                                                        </span>
                                                        {coupon.maxDiscount > 0 && coupon.discountType === 'percentage' && (
                                                            <span className="text-xs text-gray-400 block">
                                                                max {coupon.maxDiscount.toLocaleString()} FCFA
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {coupon.minPurchase > 0 ? `${coupon.minPurchase.toLocaleString()} FCFA` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        <div>{new Date(coupon.startDate).toLocaleDateString()}</div>
                                                        <div className="text-xs text-gray-400">→ {new Date(coupon.endDate).toLocaleDateString()}</div>
                                                     </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-sm text-gray-600">
                                                                {coupon.usedCount} / {coupon.usageLimit || '∞'}
                                                            </span>
                                                            {coupon.usageLimit && (
                                                                <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-red-500 rounded-full"
                                                                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                     </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                                                            <span>{status.icon}</span>
                                                            {status.label}
                                                        </span>
                                                     </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleToggleStatus(coupon._id, coupon.isActive)}
                                                                className={`text-xs px-3 py-1.5 rounded-lg transition ${
                                                                    coupon.isActive 
                                                                        ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' 
                                                                        : 'text-green-600 bg-green-50 hover:bg-green-100'
                                                                }`}
                                                            >
                                                                {coupon.isActive ? 'Désactiver' : 'Activer'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleEdit(coupon)}
                                                                className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                            >
                                                                Modifier
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(coupon._id)}
                                                                className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                                                            >
                                                                Supprimer
                                                            </button>
                                                        </div>
                                                     </td>
                                                 </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-between items-center mt-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">Lignes par page :</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-red-500 outline-none"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                                
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                                    >
                                        «
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                                    >
                                        ‹
                                    </button>
                                    <span className="px-4 py-1.5 text-sm text-gray-600">
                                        Page {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                                    >
                                        ›
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                                    >
                                        »
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CouponManager;