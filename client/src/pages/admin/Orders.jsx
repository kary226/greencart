import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import {
    Search, Package, Calendar, Truck, CheckCircle, XCircle, Clock,
    Download, Filter, RefreshCw, FileText, Eye, RotateCw, AlertTriangle,
    Check, X, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    ShoppingBag, User, MapPin, Phone, CreditCard, ArrowLeft
} from 'lucide-react';

const Orders = () => {
    const { currency, axios } = useAppContext();
    const [activeTab, setActiveTab] = useState('orders');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);

    // Filtres
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sortBy, setSortBy] = useState('date');
    const [sortOrder, setSortOrder] = useState('desc');

    // Modales
    const [showReturnModal, setShowReturnModal] = useState(null);
    const [showDisputeModal, setShowDisputeModal] = useState(null);
    const [showOrderDetail, setShowOrderDetail] = useState(null);

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        shipped: 0,
        delivered: 0,
        returned: 0,
        cancelled: 0,
        disputed: 0,
    });

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/order/seller');
            if (data.success) {
                setOrders(data.orders || []);
                computeStats(data.orders || []);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    const computeStats = (ordersData) => {
        const statsData = {
            total: ordersData.length,
            pending: ordersData.filter(o => o.status === 'Order Placed' || o.status === 'Checking Availability').length,
            confirmed: ordersData.filter(o => o.status === 'Confirmed').length,
            shipped: ordersData.filter(o => o.status === 'Shipped').length,
            outForDelivery: ordersData.filter(o => o.status === 'Out for Delivery').length,
            delivered: ordersData.filter(o => o.status === 'Delivered').length,
            returned: ordersData.filter(o => o.status === 'Returned').length,
            cancelled: ordersData.filter(o => o.status === 'Cancelled').length,
            disputed: ordersData.filter(o => o.status === 'Disputed').length,
        };
        setStats(statsData);
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const updateOrderStatus = async (orderId, status, extra = {}) => {
        setUpdating(orderId);
        try {
            const { data } = await axios.post('/api/order/status', {
                orderId,
                status,
                ...extra,
            });
            if (data.success) {
                toast.success(data.message);
                fetchOrders();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setUpdating(null);
        }
    };

    const handleReturn = async (orderId, etat, note) => {
        await updateOrderStatus(orderId, 'Returned', { retourEtat: etat, retourNote: note });
        setShowReturnModal(null);
    };

    const handleDispute = async (orderId, raison) => {
        try {
            const { data } = await axios.post('/api/order/admin/litige/declarer', {
                orderId,
                raison,
            });
            if (data.success) {
                toast.success('Litige déclaré');
                fetchOrders();
                setShowDisputeModal(null);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const getStatusLabel = (status) => {
        const map = {
            'Order Placed': 'Commandée',
            'Checking Availability': 'Vérification',
            'Confirmed': 'Confirmée',
            'Shipped': 'Expédiée',
            'Out for Delivery': 'En livraison',
            'Delivered': 'Livrée',
            'Returned': 'Retournée',
            'Cancelled': 'Annulée',
            'Disputed': 'Litige',
        };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = {
            'Order Placed': 'bg-blue-100 text-blue-700',
            'Checking Availability': 'bg-yellow-100 text-yellow-700',
            'Confirmed': 'bg-blue-100 text-blue-700',
            'Shipped': 'bg-purple-100 text-purple-700',
            'Out for Delivery': 'bg-orange-100 text-orange-700',
            'Delivered': 'bg-green-100 text-green-700',
            'Returned': 'bg-red-100 text-red-700',
            'Cancelled': 'bg-gray-100 text-gray-700',
            'Disputed': 'bg-red-200 text-red-800',
        };
        return map[status] || 'bg-gray-100 text-gray-700';
    };

    const getDeliveryLabel = (order) => {
        if (order.status === 'Delivered' && order.deliveredAt) {
            return `Livrée le ${new Date(order.deliveredAt).toLocaleDateString('fr-FR')}`;
        }
        if (order.estimatedDeliveryStart && order.estimatedDeliveryEnd) {
            return `Estimée du ${new Date(order.estimatedDeliveryStart).toLocaleDateString('fr-FR')} au ${new Date(order.estimatedDeliveryEnd).toLocaleDateString('fr-FR')}`;
        }
        return null;
    };

    const filteredOrders = useMemo(() => {
        let filtered = [...orders];

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(o =>
                o._id.toLowerCase().includes(q) ||
                (o.address?.firstName + ' ' + o.address?.lastName).toLowerCase().includes(q) ||
                o.address?.phone?.includes(q)
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(o => o.status === statusFilter);
        }

        if (paymentFilter === 'cod') {
            filtered = filtered.filter(o => o.paymentType === 'COD');
        } else if (paymentFilter === 'online') {
            filtered = filtered.filter(o => o.paymentType !== 'COD');
        }

        if (dateFilter === 'today') {
            const today = new Date().toDateString();
            filtered = filtered.filter(o => new Date(o.createdAt).toDateString() === today);
        } else if (dateFilter === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            filtered = filtered.filter(o => new Date(o.createdAt) >= weekAgo);
        } else if (dateFilter === 'month') {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            filtered = filtered.filter(o => new Date(o.createdAt) >= monthAgo);
        }

        filtered.sort((a, b) => {
            let aVal, bVal;
            switch (sortBy) {
                case 'amount':
                    aVal = a.amount;
                    bVal = b.amount;
                    break;
                case 'status':
                    aVal = a.status;
                    bVal = b.status;
                    break;
                case 'customer':
                    aVal = (a.address?.firstName + ' ' + a.address?.lastName) || '';
                    bVal = (b.address?.firstName + ' ' + b.address?.lastName) || '';
                    break;
                default:
                    aVal = new Date(a.createdAt);
                    bVal = new Date(b.createdAt);
            }
            if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
            return aVal < bVal ? 1 : -1;
        });

        return filtered;
    }, [orders, searchTerm, statusFilter, dateFilter, paymentFilter, sortBy, sortOrder]);

    const totalOrders = filteredOrders.length;
    const totalPages = Math.ceil(totalOrders / itemsPerPage);
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => setCurrentPage(1), [searchTerm, statusFilter, dateFilter, paymentFilter, sortBy, sortOrder]);

    const StatCard = ({ icon: Icon, label, value, color = 'gray' }) => (
        <div className={`bg-white rounded-xl border border-gray-100 p-3.5`}>
            <div className="flex items-center gap-2">
                <Icon size={16} className={`text-${color}-500`} />
                <span className="text-xs text-gray-500">{label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    );

    const OrderItem = ({ order }) => (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-3">
                    <Package size={16} className="text-gray-400" />
                    <span className="text-xs font-mono text-gray-500">#{order._id.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                    <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                </span>
            </div>

            <div className="p-5 space-y-4">
                {/* Articles */}
                <div className="space-y-2">
                    {order.items?.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex gap-3 pb-2 border-b border-gray-100 last:border-0">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                {item.image || item.product?.image?.[0] ? (
                                    <img src={getPresetImageUrl(item.image || item.product?.image?.[0], "thumbnail")} alt="" className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-300" /></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{item.name || item.product?.name || 'Produit'}</p>
                                <div className="flex gap-2 mt-0.5">
                                    {item.color && item.color !== 'null' && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{item.color}</span>
                                    )}
                                    {item.size && item.size !== 'null' && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{item.size}</span>
                                    )}
                                    <span className="text-xs text-gray-400">x{item.quantity}</span>
                                </div>
                            </div>
                            <p className="text-sm font-medium text-gray-900">
                                {((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity).toLocaleString()} {currency}
                            </p>
                        </div>
                    ))}
                    {(order.items?.length || 0) > 3 && (
                        <p className="text-xs text-gray-400">+{order.items.length - 3} autre(s) article(s)</p>
                    )}
                </div>

                {/* Livraison */}
                <div className="bg-gray-50 rounded-xl p-3 text-sm">
                    <p className="font-medium text-gray-700">{order.address?.firstName} {order.address?.lastName}</p>
                    <p className="text-gray-600">{order.address?.street}</p>
                    <p className="text-gray-600">{order.address?.communeName}, {order.address?.cityName || order.address?.city}</p>
                    <p className="text-gray-600 flex items-center gap-1"><Phone size={12} /> {order.address?.phone}</p>
                    {getDeliveryLabel(order) && (
                        <p className={`text-xs mt-1 ${order.status === 'Delivered' ? 'text-green-600 font-medium' : 'text-blue-600'}`}>
                            {getDeliveryLabel(order)}
                        </p>
                    )}
                    {order.litige?.enCours && (
                        <p className="text-xs text-red-600 mt-1 font-medium">⚖️ Litige en cours</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <div>
                        <p className="text-xs text-gray-500">{order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne"}</p>
                        <p className="text-xs text-gray-500">{order.isPaid ? "✅ Payé" : "⏳ En attente"}</p>
                    </div>
                    <p className="text-xl font-bold text-red-500">{order.amount.toLocaleString()} {currency}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {order.status === 'Order Placed' && (
                        <button
                            onClick={() => updateOrderStatus(order._id, 'Confirmed')}
                            disabled={updating === order._id}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            Confirmer
                        </button>
                    )}
                    {order.status === 'Confirmed' && (
                        <button
                            onClick={() => updateOrderStatus(order._id, 'Shipped')}
                            disabled={updating === order._id}
                            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-xl hover:bg-purple-700 transition disabled:opacity-50"
                        >
                            Marquer expédiée
                        </button>
                    )}
                    {order.status === 'Shipped' && (
                        <button
                            onClick={() => updateOrderStatus(order._id, 'Out for Delivery')}
                            disabled={updating === order._id}
                            className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-xl hover:bg-orange-700 transition disabled:opacity-50"
                        >
                            En livraison
                        </button>
                    )}
                    {order.status === 'Out for Delivery' && (
                        <button
                            onClick={() => updateOrderStatus(order._id, 'Delivered')}
                            disabled={updating === order._id}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                        >
                            Marquer livrée
                        </button>
                    )}
                    {!['Delivered', 'Cancelled', 'Returned', 'Disputed'].includes(order.status) && (
                        <>
                            <button
                                onClick={() => setShowReturnModal(order)}
                                className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl hover:bg-red-100 transition"
                            >
                                Retour
                            </button>
                            <button
                                onClick={() => setShowDisputeModal(order)}
                                className="px-3 py-1.5 bg-yellow-50 text-yellow-600 text-xs font-medium rounded-xl hover:bg-yellow-100 transition"
                            >
                                Litige
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowOrderDetail(order)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-200 transition"
                    >
                        <Eye size={14} /> Détail
                    </button>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="animate-spin text-red-500 mx-auto" size={32} />
                    <p className="mt-3 text-sm text-gray-500">Chargement des commandes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                {/* En-tête */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
                    <p className="text-sm text-gray-500 mt-1">Gérez toutes les commandes de la plateforme</p>
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mt-4">
                    <StatCard icon={ShoppingBag} label="Total" value={stats.total} color="gray" />
                    <StatCard icon={Clock} label="En attente" value={stats.pending} color="yellow" />
                    <StatCard icon={Truck} label="Expédiées" value={stats.shipped} color="purple" />
                    <StatCard icon={Truck} label="En livraison" value={stats.outForDelivery} color="orange" />
                    <StatCard icon={CheckCircle} label="Livrées" value={stats.delivered} color="green" />
                    <StatCard icon={RotateCw} label="Retournées" value={stats.returned} color="red" />
                    <StatCard icon={XCircle} label="Annulées" value={stats.cancelled} color="gray" />
                    <StatCard icon={AlertTriangle} label="Litiges" value={stats.disputed} color="red" />
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par n° commande, client, téléphone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-gray-400 outline-none text-sm"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white"
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="Order Placed">Commandée</option>
                            <option value="Checking Availability">Vérification</option>
                            <option value="Confirmed">Confirmée</option>
                            <option value="Shipped">Expédiée</option>
                            <option value="Out for Delivery">En livraison</option>
                            <option value="Delivered">Livrée</option>
                            <option value="Returned">Retournée</option>
                            <option value="Cancelled">Annulée</option>
                            <option value="Disputed">Litige</option>
                        </select>

                        <select
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white"
                        >
                            <option value="all">Tous les paiements</option>
                            <option value="cod">À la livraison</option>
                            <option value="online">En ligne</option>
                        </select>

                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white"
                        >
                            <option value="all">Toutes les dates</option>
                            <option value="today">Aujourd'hui</option>
                            <option value="week">Cette semaine</option>
                            <option value="month">Ce mois</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white"
                        >
                            <option value="date">Trier par date</option>
                            <option value="amount">Trier par montant</option>
                            <option value="status">Trier par statut</option>
                            <option value="customer">Trier par client</option>
                        </select>

                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition flex items-center gap-1.5 text-gray-600"
                        >
                            {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>

                        <button
                            onClick={fetchOrders}
                            className="px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm hover:bg-gray-200 transition flex items-center gap-1.5"
                        >
                            <RefreshCw size={14} />
                            Actualiser
                        </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-gray-400">{totalOrders} commande(s) trouvée(s)</span>
                    </div>
                </div>

                {/* Liste */}
                {paginatedOrders.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <Package size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucune commande ne correspond aux filtres</p>
                    </div>
                ) : (
                    <div className="space-y-4 mt-5">
                        {paginatedOrders.map((order) => (
                            <OrderItem key={order._id} order={order} />
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-6">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">Lignes par page :</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-gray-400 outline-none"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                            >
                                <ChevronsLeft size={15} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            <span className="px-3 py-1.5 text-sm text-gray-600">Page {currentPage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                            >
                                <ChevronRight size={15} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                            >
                                <ChevronsRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Retour */}
            {showReturnModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <RotateCw size={18} className="text-red-500" />
                            Retour - #{showReturnModal._id.slice(-6).toUpperCase()}
                        </h3>
                        <p className="text-sm text-gray-500 mt-2">Précisez l'état du colis pour le retour.</p>
                        <div className="mt-4 space-y-3">
                            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-gray-400 transition">
                                <input type="radio" name="returnEtat" value="bon_etat" defaultChecked className="mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-800">Bon état</p>
                                    <p className="text-xs text-gray-400">Remis en stock, revendable</p>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-gray-400 transition">
                                <input type="radio" name="returnEtat" value="endommage" className="mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-800">Endommagé</p>
                                    <p className="text-xs text-gray-400">Mis au rebut, stock NON réintégré</p>
                                </div>
                            </label>
                            <textarea
                                placeholder="Note (optionnelle)"
                                id="returnNote"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-gray-400 outline-none resize-none"
                                rows={2}
                            />
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setShowReturnModal(null)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    const etat = document.querySelector('input[name="returnEtat"]:checked')?.value || 'bon_etat';
                                    const note = document.getElementById('returnNote')?.value || '';
                                    handleReturn(showReturnModal._id, etat, note);
                                }}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition"
                            >
                                Confirmer le retour
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Litige */}
            {showDisputeModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-yellow-500" />
                            Litige - #{showDisputeModal._id.slice(-6).toUpperCase()}
                        </h3>
                        <p className="text-sm text-gray-500 mt-2">Déclarer un litige sur cette commande.</p>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Raison du litige</label>
                            <textarea
                                id="disputeReason"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-gray-400 outline-none resize-none"
                                rows={3}
                                placeholder="Expliquez la raison du litige..."
                            />
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setShowDisputeModal(null)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    const raison = document.getElementById('disputeReason')?.value || '';
                                    if (!raison.trim()) { toast.error('Veuillez indiquer une raison'); return; }
                                    handleDispute(showDisputeModal._id, raison);
                                }}
                                className="flex-1 px-4 py-2.5 bg-yellow-600 text-white rounded-xl text-sm font-medium hover:bg-yellow-700 transition"
                            >
                                Déclarer le litige
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Détail */}
            {showOrderDetail && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900">
                                Détail - #{showOrderDetail._id.slice(-6).toUpperCase()}
                            </h3>
                            <button onClick={() => setShowOrderDetail(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-gray-500">Client</span> <br /><span className="font-medium">{showOrderDetail.address?.firstName} {showOrderDetail.address?.lastName}</span></div>
                                <div><span className="text-gray-500">Email</span> <br /><span className="font-medium">{showOrderDetail.address?.email || '-'}</span></div>
                                <div><span className="text-gray-500">Téléphone</span> <br /><span className="font-medium">{showOrderDetail.address?.phone}</span></div>
                                <div><span className="text-gray-500">Statut</span> <br /><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(showOrderDetail.status)}`}>{getStatusLabel(showOrderDetail.status)}</span></div>
                                <div><span className="text-gray-500">Paiement</span> <br /><span className="font-medium">{showOrderDetail.paymentType === "COD" ? "À la livraison" : "En ligne"}</span></div>
                                <div><span className="text-gray-500">Montant</span> <br /><span className="font-bold text-red-500">{showOrderDetail.amount.toLocaleString()} {currency}</span></div>
                            </div>

                            <div className="border-t border-gray-100 pt-3">
                                <p className="font-medium text-gray-700 mb-2">Articles</p>
                                {showOrderDetail.items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between py-1 text-sm border-b border-gray-50 last:border-0">
                                        <div>
                                            <span>{item.name || item.product?.name || 'Produit'}</span>
                                            {item.color && <span className="text-xs text-gray-400 ml-1">({item.color})</span>}
                                            {item.size && <span className="text-xs text-gray-400 ml-1">[{item.size}]</span>}
                                            <span className="text-xs text-gray-400 ml-1">x{item.quantity}</span>
                                        </div>
                                        <span className="font-medium">{((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity).toLocaleString()} {currency}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-100 pt-3">
                                <p className="font-medium text-gray-700">Adresse de livraison</p>
                                <p className="text-sm text-gray-600">{showOrderDetail.address?.street}</p>
                                <p className="text-sm text-gray-600">{showOrderDetail.address?.communeName}, {showOrderDetail.address?.cityName || showOrderDetail.address?.city}</p>
                            </div>

                            {getDeliveryLabel(showOrderDetail) && (
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="font-medium text-gray-700">Livraison</p>
                                    <p className="text-sm text-gray-600">{getDeliveryLabel(showOrderDetail)}</p>
                                </div>
                            )}

                            {showOrderDetail.litige?.enCours && (
                                <div className="border-t border-gray-100 pt-3 bg-yellow-50 p-3 rounded-xl">
                                    <p className="font-medium text-yellow-700">⚖️ Litige en cours</p>
                                    <p className="text-sm text-yellow-600">Raison : {showOrderDetail.litige.raison}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Orders;