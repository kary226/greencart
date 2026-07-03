import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const DeliveryManager = () => {
    const { axios } = useAppContext();
    const [activeTab, setActiveTab] = useState('types');
    const [loading, setLoading] = useState(true);
    
    // Types de livraison
    const [deliveryTypes, setDeliveryTypes] = useState([]);
    const [showTypeForm, setShowTypeForm] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [typeForm, setTypeForm] = useState({ name: '', description: '', order: 0 });
    
    // Prix de livraison
    const [deliveryPrices, setDeliveryPrices] = useState([]);
    const [cities, setCities] = useState([]);
    const [communes, setCommunes] = useState([]);
    const [loadingCommunes, setLoadingCommunes] = useState(false);
    const [showPriceForm, setShowPriceForm] = useState(false);
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [editingPrice, setEditingPrice] = useState(null);
    const [priceForm, setPriceForm] = useState({ deliveryTypeId: '', cityId: '', communeId: '', price: '' });
    const [bulkForm, setBulkForm] = useState({ deliveryTypeId: '', cityId: '', communeNames: '', price: '' });
    const [selectedCityFilter, setSelectedCityFilter] = useState('');

    // ✅ NOUVEAU : Livraisons à effectuer
    const [orders, setOrders] = useState([]);
    const [orderFilter, setOrderFilter] = useState('all'); // all, pending, shipped, delivered
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingOrder, setUpdatingOrder] = useState(null);

    const fetchDeliveryTypes = async () => {
        try {
            const { data } = await axios.get('/api/delivery/types/admin');
            if (data.success) setDeliveryTypes(data.types);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const fetchDeliveryPrices = async () => {
        try {
            const { data } = await axios.get('/api/delivery/prices/admin');
            if (data.success) setDeliveryPrices(data.prices);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const fetchCities = async () => {
        try {
            const { data } = await axios.get('/api/location/admin/cities');
            if (data.success) setCities(data.cities);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const fetchCommunes = async (cityId) => {
        if (!cityId) {
            setCommunes([]);
            return;
        }
        setLoadingCommunes(true);
        try {
            const { data } = await axios.get(`/api/location/communes/${cityId}`);
            if (data.success) setCommunes(data.communes);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingCommunes(false);
        }
    };

    // ✅ Récupérer les commandes à livrer
    const fetchOrdersToDeliver = async () => {
        try {
            const { data } = await axios.get('/api/order/seller');
            if (data.success) {
                // Filtrer les commandes qui ne sont pas encore livrées ou annulées
                const pendingOrders = data.orders.filter(o => 
                    o.status !== 'Delivered' && o.status !== 'Cancelled' && o.status !== 'Returned'
                );
                setOrders(pendingOrders);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        Promise.all([
            fetchDeliveryTypes(), 
            fetchDeliveryPrices(), 
            fetchCities(),
            fetchOrdersToDeliver()
        ]).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (priceForm.cityId) {
            fetchCommunes(priceForm.cityId);
        } else {
            setCommunes([]);
        }
    }, [priceForm.cityId]);

    // ✅ Mettre à jour le statut d'une commande (marquer comme livrée)
    const updateOrderStatus = async (orderId, newStatus) => {
        setUpdatingOrder(orderId);
        try {
            const { data } = await axios.post('/api/order/status', {
                orderId,
                status: newStatus
            });
            if (data.success) {
                toast.success(`Commande #${orderId.slice(-8)} ${newStatus === 'Delivered' ? 'livrée ✅' : 'mis à jour'}`);
                await fetchOrdersToDeliver();
                await fetchDeliveryPrices();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setUpdatingOrder(null);
        }
    };

    const handleTypeSubmit = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (editingType) {
                res = await axios.post('/api/delivery/type/update', { id: editingType._id, ...typeForm });
            } else {
                res = await axios.post('/api/delivery/type/add', typeForm);
            }
            if (res.data.success) {
                toast.success(res.data.message);
                setShowTypeForm(false);
                setEditingType(null);
                setTypeForm({ name: '', description: '', order: 0 });
                fetchDeliveryTypes();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleDeleteType = async (id) => {
        if (!window.confirm('Supprimer ce type de livraison ?')) return;
        try {
            const { data } = await axios.post('/api/delivery/type/delete', { id });
            if (data.success) {
                toast.success(data.message);
                fetchDeliveryTypes();
                fetchDeliveryPrices();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handlePriceSubmit = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (editingPrice) {
                res = await axios.post('/api/delivery/price/update', { id: editingPrice._id, price: priceForm.price });
            } else {
                const payload = {
                    deliveryTypeId: priceForm.deliveryTypeId,
                    cityId: priceForm.cityId || null,
                    communeId: priceForm.communeId || null,
                    price: priceForm.price
                };
                res = await axios.post('/api/delivery/price/add', payload);
            }
            if (res.data.success) {
                toast.success(res.data.message);
                setShowPriceForm(false);
                setEditingPrice(null);
                setPriceForm({ deliveryTypeId: '', cityId: '', communeId: '', price: '' });
                fetchDeliveryPrices();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleBulkSubmit = async (e) => {
        e.preventDefault();
        if (!bulkForm.deliveryTypeId || !bulkForm.cityId || !bulkForm.communeNames || !bulkForm.price) {
            toast.error('Tous les champs sont requis');
            return;
        }
        try {
            const { data } = await axios.post('/api/delivery/price/bulk', bulkForm);
            if (data.success) {
                toast.success(data.message);
                setShowBulkForm(false);
                setBulkForm({ deliveryTypeId: '', cityId: '', communeNames: '', price: '' });
                fetchDeliveryPrices();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleDeletePrice = async (id) => {
        if (!window.confirm('Supprimer ce tarif ?')) return;
        try {
            const { data } = await axios.post('/api/delivery/price/delete', { id });
            if (data.success) {
                toast.success(data.message);
                fetchDeliveryPrices();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const filteredPrices = selectedCityFilter 
        ? deliveryPrices.filter(p => p.cityId?._id === selectedCityFilter || p.cityId === selectedCityFilter)
        : deliveryPrices;

    // ✅ Filtrer les commandes
    const filteredOrders = orders.filter(order => {
        const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
        const matchesSearch = searchTerm === '' || 
            order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `${order.address?.firstName} ${order.address?.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // ✅ Statistiques des livraisons
    const stats = {
        total: orders.length,
        confirmed: orders.filter(o => o.status === 'Confirmed').length,
        shipped: orders.filter(o => o.status === 'Shipped').length,
        outForDelivery: orders.filter(o => o.status === 'Out for Delivery').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-500">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestion des livraisons</h1>
                    <p className="text-sm text-gray-500 mt-1">Configurez les types et tarifs de livraison</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('types')}
                        className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition whitespace-nowrap ${
                            activeTab === 'types' 
                                ? 'bg-white text-red-500 border-b-2 border-red-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Types de livraison
                    </button>
                    <button
                        onClick={() => setActiveTab('prices')}
                        className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition whitespace-nowrap ${
                            activeTab === 'prices' 
                                ? 'bg-white text-red-500 border-b-2 border-red-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Tarifs par commune
                    </button>
                    <button
                        onClick={() => setActiveTab('deliveries')}
                        className={`px-6 py-2.5 text-sm font-medium rounded-t-lg transition whitespace-nowrap ${
                            activeTab === 'deliveries' 
                                ? 'bg-white text-red-500 border-b-2 border-red-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        🚚 Livraisons à effectuer ({stats.total})
                    </button>
                </div>

                {/* ✅ NOUVEL ONGLET : Livraisons à effectuer */}
                {activeTab === 'deliveries' && (
                    <div>
                        {/* Statistiques */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                <p className="text-xs text-gray-500">Total à livrer</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                <p className="text-xs text-gray-500">Confirmées</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                <p className="text-xs text-gray-500">Expédiées</p>
                                <p className="text-2xl font-bold text-purple-600">{stats.shipped}</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                <p className="text-xs text-gray-500">En livraison</p>
                                <p className="text-2xl font-bold text-orange-600">{stats.outForDelivery}</p>
                            </div>
                        </div>

                        {/* Filtres */}
                        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-6">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="text"
                                    placeholder="Rechercher par n° commande ou client..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                />
                                <select
                                    value={orderFilter}
                                    onChange={(e) => setOrderFilter(e.target.value)}
                                    className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                >
                                    <option value="all">Tous les statuts</option>
                                    <option value="Confirmed">Confirmées</option>
                                    <option value="Shipped">Expédiées</option>
                                    <option value="Out for Delivery">En livraison</option>
                                </select>
                            </div>
                        </div>

                        {/* Liste des commandes */}
                        {filteredOrders.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                                <div className="text-4xl mb-4">📦</div>
                                <p className="text-gray-500">Aucune livraison à effectuer</p>
                                <p className="text-sm text-gray-400 mt-1">Toutes les commandes sont livrées ou en attente</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredOrders.map((order) => {
                                    const orderDate = new Date(order.createdAt);
                                    const deliveryStart = order.estimatedDeliveryStart 
                                        ? new Date(order.estimatedDeliveryStart).toLocaleDateString('fr-FR') 
                                        : 'Non définie';
                                    
                                    const statusColors = {
                                        'Confirmed': 'bg-blue-100 text-blue-700',
                                        'Shipped': 'bg-purple-100 text-purple-700',
                                        'Out for Delivery': 'bg-orange-100 text-orange-700',
                                    };
                                    const statusLabels = {
                                        'Confirmed': 'Confirmée',
                                        'Shipped': 'Expédiée',
                                        'Out for Delivery': 'En livraison',
                                    };

                                    return (
                                        <div key={order._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                                            <div className="p-4">
                                                <div className="flex flex-wrap justify-between items-start gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-bold text-gray-900">
                                                                #{order._id.slice(-8).toUpperCase()}
                                                            </span>
                                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-700'}`}>
                                                                {statusLabels[order.status] || order.status}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 space-y-0.5 text-sm text-gray-600">
                                                            <p>👤 {order.address?.firstName} {order.address?.lastName}</p>
                                                            <p>📞 {order.address?.phone}</p>
                                                            <p>📍 {order.address?.street}, {order.address?.city || order.address?.communeName}</p>
                                                            <p className="text-xs text-gray-400">Commande du {orderDate.toLocaleDateString('fr-FR')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-red-600">{order.amount.toLocaleString()} FCFA</p>
                                                        <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full mt-1">
                                                            🚚 Livraison estimée : {deliveryStart}
                                                        </p>
                                                        <button
                                                            onClick={() => updateOrderStatus(order._id, 'Delivered')}
                                                            disabled={updatingOrder === order._id}
                                                            className={`mt-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2 mx-auto`}
                                                        >
                                                            {updatingOrder === order._id ? (
                                                                '⏳ Mise à jour...'
                                                            ) : (
                                                                <>
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <polyline points="20 6 9 17 4 12"/>
                                                                    </svg>
                                                                    Marquer livrée
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Reste des onglets inchangé */}
                {activeTab === 'types' && (
                    <div>
                        {/* ... (contenu existant) ... */}
                    </div>
                )}

                {activeTab === 'prices' && (
                    <div>
                        {/* ... (contenu existant) ... */}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeliveryManager;