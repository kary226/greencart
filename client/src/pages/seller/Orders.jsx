import React, { useEffect, useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { assets } from '../../assets/assets'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { PDFDownloadLink } from '@react-pdf/renderer'
import OrderReceiptPDF from '../../components/OrderReceiptPDF'
import { Package, Calendar, Truck, CheckCircle, XCircle, Clock, Download, Filter, Search, RefreshCw, FileText, Eye, RotateCw } from 'lucide-react'

const Orders = () => {
    const { currency, axios } = useAppContext()
    const [orders, setOrders] = useState([])
    const [updatingStatus, setUpdatingStatus] = useState(null)
    const [selectedImage, setSelectedImage] = useState(null)
    const location = useLocation()
    
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [paymentFilter, setPaymentFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [sortBy, setSortBy] = useState('date')
    const [sortOrder, setSortOrder] = useState('desc')
    const [deliveryFilter, setDeliveryFilter] = useState('all')

    const fetchOrders = async () => {
        try {
            const { data } = await axios.get('/api/order/seller');
            if (data.success) {
                setOrders(data.orders)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    };

    // ✅ Fonction pour obtenir le libellé de livraison - Version professionnelle
    const getDeliveryLabel = (order) => {
        if (order.status === 'Delivered') {
            if (order.deliveredAt) {
                const deliveredDate = new Date(order.deliveredAt);
                return `Livrée le ${deliveredDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
            }
            return 'Livrée';
        }
        if (order.estimatedDeliveryStart && order.estimatedDeliveryEnd) {
            const start = new Date(order.estimatedDeliveryStart);
            const end = new Date(order.estimatedDeliveryEnd);
            return `Livraison estimée du ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} au ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        }
        return null;
    };

    // ✅ Fonction pour obtenir le libellé court
    const getDeliveryLabelShort = (order) => {
        if (order.status === 'Delivered') {
            if (order.deliveredAt) {
                const deliveredDate = new Date(order.deliveredAt);
                return `Livrée ${deliveredDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
            }
            return 'Livrée';
        }
        if (order.estimatedDeliveryStart && order.estimatedDeliveryEnd) {
            const start = new Date(order.estimatedDeliveryStart);
            const end = new Date(order.estimatedDeliveryEnd);
            return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
        }
        return null;
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        setUpdatingStatus(orderId)
        try {
            const { data } = await axios.post('/api/order/status', {
                orderId,
                status: newStatus
            });
            if (data.success) {
                toast.success(`Statut mis à jour : ${newStatus}`);
                await fetchOrders();
                setCurrentPage(1);
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setUpdatingStatus(null)
        }
    };

    const getStatusLabel = (status) => {
        const statusMap = {
            'Order Placed': 'Commandée',
            'Confirmed': 'Confirmée',
            'Shipped': 'Expédiée',
            'Out for Delivery': 'En livraison',
            'Delivered': 'Livrée',
            'Returned': 'Retournée',
            'Cancelled': 'Annulée'
        };
        return statusMap[status] || status;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Delivered': return <CheckCircle size={14} className="text-green-600" />;
            case 'Returned': return <RotateCw size={14} className="text-purple-600" />;
            case 'Cancelled': return <XCircle size={14} className="text-red-600" />;
            case 'Shipped': case 'Out for Delivery': return <Truck size={14} className="text-purple-600" />;
            default: return <Clock size={14} className="text-blue-600" />;
        }
    };

    const getStatusColor = (status) => {
        if (status === 'Delivered') return 'bg-green-100 text-green-700';
        if (status === 'Returned') return 'bg-purple-100 text-purple-700';
        if (status === 'Cancelled') return 'bg-red-100 text-red-700';
        if (status === 'Shipped' || status === 'Out for Delivery') return 'bg-purple-100 text-purple-700';
        return 'bg-blue-100 text-blue-700';
    };

    const deliveryStats = useMemo(() => {
        const toDeliver = orders.filter(o => 
            o.status !== 'Delivered' && o.status !== 'Cancelled' && o.status !== 'Returned'
        );
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayDeliveries = toDeliver.filter(o => {
            if (!o.estimatedDeliveryStart) return false;
            const deliveryDate = new Date(o.estimatedDeliveryStart);
            deliveryDate.setHours(0, 0, 0, 0);
            return deliveryDate.getTime() === today.getTime();
        });
        
        const weekDeliveries = toDeliver.filter(o => {
            if (!o.estimatedDeliveryStart) return false;
            const deliveryDate = new Date(o.estimatedDeliveryStart);
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            return deliveryDate >= today && deliveryDate <= weekFromNow;
        });

        return {
            total: toDeliver.length,
            today: todayDeliveries.length,
            week: weekDeliveries.length,
        };
    }, [orders]);

    const deliveryOrders = useMemo(() => {
        let filtered = orders.filter(o => 
            o.status !== 'Delivered' && o.status !== 'Cancelled' && o.status !== 'Returned'
        );

        if (deliveryFilter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            filtered = filtered.filter(o => {
                if (!o.estimatedDeliveryStart) return false;
                const deliveryDate = new Date(o.estimatedDeliveryStart);
                deliveryDate.setHours(0, 0, 0, 0);
                return deliveryDate.getTime() === today.getTime();
            });
        } else if (deliveryFilter === 'week') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            filtered = filtered.filter(o => {
                if (!o.estimatedDeliveryStart) return false;
                const deliveryDate = new Date(o.estimatedDeliveryStart);
                return deliveryDate >= today && deliveryDate <= weekFromNow;
            });
        }

        return filtered;
    }, [orders, deliveryFilter]);

    const filteredOrders = useMemo(() => {
        let filtered = [...orders]

        if (statusFilter !== 'all') {
            filtered = filtered.filter(order => order.status === statusFilter)
        }

        if (paymentFilter !== 'all') {
            filtered = filtered.filter(order => 
                paymentFilter === 'cod' ? order.paymentType === 'COD' : order.paymentType !== 'COD'
            )
        }

        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        const monthAgo = new Date(today)
        monthAgo.setMonth(monthAgo.getMonth() - 1)

        if (dateFilter === 'today') {
            filtered = filtered.filter(order => new Date(order.createdAt) >= today)
        } else if (dateFilter === 'week') {
            filtered = filtered.filter(order => new Date(order.createdAt) >= weekAgo)
        } else if (dateFilter === 'month') {
            filtered = filtered.filter(order => new Date(order.createdAt) >= monthAgo)
        } else if (dateFilter === 'custom' && startDate && endDate) {
            const start = new Date(startDate)
            const end = new Date(endDate)
            end.setHours(23, 59, 59)
            filtered = filtered.filter(order => {
                const orderDate = new Date(order.createdAt)
                return orderDate >= start && orderDate <= end
            })
        }

        if (searchTerm) {
            filtered = filtered.filter(order => 
                order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                `${order.address.firstName} ${order.address.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.address.phone.includes(searchTerm)
            )
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
                    aVal = `${a.address.firstName} ${a.address.lastName}`;
                    bVal = `${b.address.firstName} ${b.address.lastName}`;
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
        })

        return filtered
    }, [orders, statusFilter, dateFilter, searchTerm, startDate, endDate, paymentFilter, sortBy, sortOrder])

    const totalOrders = filteredOrders.length
    const totalPages = Math.ceil(totalOrders / itemsPerPage)
    const paginatedOrders = filteredOrders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    useEffect(() => {
        setCurrentPage(1)
    }, [statusFilter, dateFilter, searchTerm, startDate, endDate, paymentFilter, sortBy, sortOrder])

    const stats = {
        total: orders.length,
        totalAmount: orders.reduce((sum, o) => sum + o.amount, 0),
        byStatus: {
            placed: orders.filter(o => o.status === 'Order Placed').length,
            confirmed: orders.filter(o => o.status === 'Confirmed').length,
            shipped: orders.filter(o => o.status === 'Shipped').length,
            outForDelivery: orders.filter(o => o.status === 'Out for Delivery').length,
            delivered: orders.filter(o => o.status === 'Delivered').length,
            returned: orders.filter(o => o.status === 'Returned').length,
            cancelled: orders.filter(o => o.status === 'Cancelled').length
        },
        byPayment: {
            cod: orders.filter(o => o.paymentType === 'COD').length,
            online: orders.filter(o => o.paymentType !== 'COD').length
        }
    }

    const exportToExcel = () => {
        if (filteredOrders.length === 0) {
            toast.error('Aucune commande à exporter');
            return;
        }

        const exportDateTime = new Date();

        const exportData = filteredOrders
            .map(order => {
                const orderDate = new Date(order.createdAt);
                
                return {
                    'N° Commande': order._id,
                    'Date': orderDate.toLocaleDateString('fr-FR'),
                    'Heure': orderDate.toLocaleTimeString('fr-FR'),
                    'Client': `${order.address.firstName} ${order.address.lastName}`,
                    'Téléphone': order.address.phone,
                    'Quartier': order.address.street || '-',
                    'Commune': order.address.communeName || '-',
                    'Ville': order.address.cityName || order.address.city || '-',
                    'Produits': order.items.map(item => 
                        `${item.product?.name || 'Produit'} (x${item.quantity})${item.color ? ` ${item.color}` : ''}${item.size ? ` ${item.size}` : ''}`
                    ).join(', '),
                    'Montant': order.amount,
                    'Statut': getStatusLabel(order.status),
                    'Paiement': order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne",
                    'Payé': order.isPaid ? "Oui" : "Non",
                    'Livraison': getDeliveryLabel(order) || 'Non définie'
                };
            })
            .sort((a, b) => a['Client'].localeCompare(b['Client']));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        worksheet['!cols'] = [
            { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 15 },
            { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 60 }, { wch: 15 },
            { wch: 15 }, { wch: 25 }, { wch: 8 }, { wch: 35 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Commandes');

        const summaryData = [
            ['RAPPORT DES COMMANDES', ''],
            ['Date d\'export', exportDateTime.toLocaleDateString('fr-FR')],
            ['Heure d\'export', exportDateTime.toLocaleTimeString('fr-FR')],
            ['Total commandes', filteredOrders.length],
            ['Montant total', `${filteredOrders.reduce((sum, o) => sum + o.amount, 0).toLocaleString()} ${currency}`],
            [''],
            ['RÉPARTITION PAR STATUT', ''],
            ...Object.entries({
                'Commandée': stats.byStatus.placed,
                'Confirmée': stats.byStatus.confirmed,
                'Expédiée': stats.byStatus.shipped,
                'En livraison': stats.byStatus.outForDelivery,
                'Livrée': stats.byStatus.delivered,
                'Retournée': stats.byStatus.returned,
                'Annulée': stats.byStatus.cancelled
            }).map(([label, count]) => [label, count]),
            [''],
            ['RÉPARTITION PAR PAIEMENT', ''],
            ...Object.entries({
                'Paiement à la livraison': stats.byPayment.cod,
                'Paiement en ligne': stats.byPayment.online
            }).map(([label, count]) => [label, count])
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');

        const fileName = `commandes_${exportDateTime.toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        toast.success(`${filteredOrders.length} commande(s) exportée(s)`);
    };

    useEffect(() => {
        fetchOrders();
    }, [location.pathname])

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
                    <p className="text-sm text-gray-500 mt-1">Gérez toutes les commandes des clients</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Total commandes</p>
                            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Chiffre d'affaires</p>
                            <p className="text-xl font-bold text-red-500">{stats.totalAmount.toLocaleString()} {currency}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Livrées</p>
                            <p className="text-xl font-bold text-green-600">{stats.byStatus.delivered}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">En attente</p>
                            <p className="text-xl font-bold text-orange-500">{stats.byStatus.placed + stats.byStatus.confirmed}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">À livrer</p>
                            <p className="text-xl font-bold text-purple-600">{deliveryStats.total}</p>
                        </div>
                    </div>
                </div>

                {deliveryStats.total > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="bg-purple-50 px-5 py-3 border-b border-gray-100 flex flex-wrap justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Truck size={18} className="text-purple-600" />
                                <span className="font-medium text-gray-900">Livraisons à effectuer</span>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                    {deliveryStats.total} commandes
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setDeliveryFilter('all')}
                                    className={`text-xs px-3 py-1 rounded-full transition ${
                                        deliveryFilter === 'all' 
                                            ? 'bg-purple-600 text-white' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    Toutes ({deliveryStats.total})
                                </button>
                                <button
                                    onClick={() => setDeliveryFilter('today')}
                                    className={`text-xs px-3 py-1 rounded-full transition ${
                                        deliveryFilter === 'today' 
                                            ? 'bg-purple-600 text-white' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    Aujourd'hui ({deliveryStats.today})
                                </button>
                                <button
                                    onClick={() => setDeliveryFilter('week')}
                                    className={`text-xs px-3 py-1 rounded-full transition ${
                                        deliveryFilter === 'week' 
                                            ? 'bg-purple-600 text-white' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    Cette semaine ({deliveryStats.week})
                                </button>
                            </div>
                        </div>

                        {deliveryOrders.length > 0 && (
                            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                                {deliveryOrders.slice(0, 10).map((order) => (
                                    <div key={order._id} className="px-5 py-3 flex flex-wrap justify-between items-center gap-2 hover:bg-gray-50 transition">
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs font-mono text-gray-500">#{order._id.slice(-8)}</span>
                                            <span className="text-sm text-gray-700">
                                                {order.address?.firstName} {order.address?.lastName}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {order.address?.communeName || order.address?.city || '-'}
                                            </span>
                                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                {order.estimatedDeliveryStart 
                                                    ? new Date(order.estimatedDeliveryStart).toLocaleDateString('fr-FR')
                                                    : 'Non définie'
                                                }
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                                                {getStatusLabel(order.status)}
                                            </span>
                                            <select 
                                                value={order.status}
                                                onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                                                disabled={updatingStatus === order._id}
                                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-purple-500"
                                            >
                                                <option value="Confirmed">Confirmée</option>
                                                <option value="Shipped">Expédiée</option>
                                                <option value="Out for Delivery">En livraison</option>
                                                <option value="Delivered">Livrée</option>
                                            </select>
                                            {updatingStatus === order._id && (
                                                <span className="text-xs text-gray-400 animate-pulse">...</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {deliveryOrders.length > 10 && (
                                    <div className="px-5 py-2 text-center text-xs text-gray-400 bg-gray-50">
                                        + {deliveryOrders.length - 10} autres commandes
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher par n° commande, nom client, téléphone..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm"
                                />
                            </div>
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="all">Tous les statuts ({stats.total})</option>
                            <option value="Order Placed">Commandée ({stats.byStatus.placed})</option>
                            <option value="Confirmed">Confirmée ({stats.byStatus.confirmed})</option>
                            <option value="Shipped">Expédiée ({stats.byStatus.shipped})</option>
                            <option value="Out for Delivery">En livraison ({stats.byStatus.outForDelivery})</option>
                            <option value="Delivered">Livrée ({stats.byStatus.delivered})</option>
                            <option value="Returned">Retournée ({stats.byStatus.returned})</option>
                            <option value="Cancelled">Annulée ({stats.byStatus.cancelled})</option>
                        </select>

                        <select
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="all">Tous les paiements</option>
                            <option value="cod">Paiement à la livraison</option>
                            <option value="online">Paiement en ligne</option>
                        </select>

                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="all">Toutes les dates</option>
                            <option value="today">Aujourd'hui</option>
                            <option value="week">Cette semaine</option>
                            <option value="month">Ce mois</option>
                            <option value="custom">Période personnalisée</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="date">Trier par date</option>
                            <option value="amount">Trier par montant</option>
                            <option value="status">Trier par statut</option>
                            <option value="customer">Trier par client</option>
                        </select>

                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition flex items-center gap-2"
                        >
                            {sortOrder === 'asc' ? '↑ Croissant' : '↓ Décroissant'}
                        </button>

                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition shadow-sm"
                        >
                            <Download size={16} />
                            Exporter ({filteredOrders.length})
                        </button>
                    </div>

                    {dateFilter === 'custom' && (
                        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="text-sm border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-red-500"
                            />
                            <span className="text-gray-400">→</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="text-sm border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-red-500"
                            />
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-3">
                        <p className="text-xs text-gray-500">
                            {filteredOrders.length} commande(s) trouvée(s) sur {stats.total}
                        </p>
                        {(statusFilter !== 'all' || dateFilter !== 'all' || searchTerm || paymentFilter !== 'all') && (
                            <button
                                onClick={() => {
                                    setStatusFilter('all')
                                    setDateFilter('all')
                                    setSearchTerm('')
                                    setStartDate('')
                                    setEndDate('')
                                    setPaymentFilter('all')
                                    setSortBy('date')
                                    setSortOrder('desc')
                                }}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                            >
                                <RefreshCw size={12} />
                                Réinitialiser les filtres
                            </button>
                        )}
                    </div>
                </div>

                {filteredOrders.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                        <Package size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucune commande ne correspond aux filtres</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-5">
                            {paginatedOrders.map((order, index) => (
                                <div key={index} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2">
                                        <div className="flex items-center gap-3">
                                            <Package size={16} className="text-gray-400" />
                                            <span className="text-xs font-mono text-gray-500">#{order._id.slice(-8)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Calendar size={14} className="text-gray-400" />
                                            <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                                            <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        <div className="space-y-3">
                                            {order.items.map((item, idx) => (
                                                <div key={idx} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
                                                    {item.product?.image?.[0] && (
                                                        <div 
                                                            className="w-14 h-14 rounded-lg overflow-hidden cursor-pointer bg-gray-100 flex-shrink-0"
                                                            onClick={() => setSelectedImage(item.product.image[0])}
                                                        >
                                                            <img 
                                                                src={item.product.image[0]} 
                                                                alt={item.product?.name || 'Produit'}
                                                                className="w-full h-full object-cover hover:opacity-80 transition"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="font-medium text-gray-900">
                                                            {item.product?.name || 'Produit indisponible'} 
                                                            <span className="text-red-500 ml-1">x{item.quantity}</span>
                                                        </p>
                                                        <div className="flex gap-2 mt-1">
                                                            {item.color && item.color !== 'null' && (
                                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                    {item.color}
                                                                </span>
                                                            )}
                                                            {item.size && item.size !== 'null' && (
                                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                    {item.size}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="font-medium text-red-500 whitespace-nowrap">
                                                        {((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity).toLocaleString()} {currency}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="bg-gray-50 rounded-xl p-3">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Livraison</p>
                                            <p className="text-sm text-gray-700">{order.address.firstName} {order.address.lastName}</p>
                                            <p className="text-sm text-gray-600">{order.address.street}</p>
                                            <p className="text-sm text-gray-600">{order.address.communeName}, {order.address.cityName || order.address.city}</p>
                                            <p className="text-sm text-gray-600">{order.address.phone}</p>
                                            {getDeliveryLabel(order) && (
                                                <p className={`text-xs mt-1 ${order.status === 'Delivered' ? 'text-green-600 font-medium' : 'text-blue-600'}`}>
                                                    {getDeliveryLabel(order)}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap justify-between items-center">
                                            <div>
                                                <p className="text-xs text-gray-500">{order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne"}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{order.isPaid ? "Payé" : "En attente"}</p>
                                            </div>
                                            <p className="text-xl font-bold text-red-500">
                                                {order.amount.toLocaleString()} {currency}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(order.status)}
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>
                                                    {getStatusLabel(order.status)}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <select 
                                                    defaultValue={order.status}
                                                    onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                                                    disabled={updatingStatus === order._id}
                                                    className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-red-500"
                                                >
                                                    <option value="Order Placed">Commandée</option>
                                                    <option value="Confirmed">Confirmée</option>
                                                    <option value="Shipped">Expédiée</option>
                                                    <option value="Out for Delivery">En livraison</option>
                                                    <option value="Delivered">Livrée</option>
                                                    <option value="Returned">Retournée</option>
                                                    <option value="Cancelled">Annulée</option>
                                                </select>
                                                {updatingStatus === order._id && (
                                                    <span className="text-xs text-gray-400 animate-pulse">Mise à jour...</span>
                                                )}
                                                <PDFDownloadLink
                                                    document={<OrderReceiptPDF order={order} currency={currency} />}
                                                    fileName={`facture_${order._id.slice(-8)}.pdf`}
                                                    className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition"
                                                >
                                                    {({ loading }) => loading ? (
                                                        <span className="text-xs">Chargement...</span>
                                                    ) : (
                                                        <>
                                                            <FileText size={12} />
                                                            PDF
                                                        </>
                                                    )}
                                                </PDFDownloadLink>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

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

            {selectedImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-[90vw] max-h-[90vh]">
                        <img 
                            src={selectedImage} 
                            alt="Agrandissement"
                            className="max-w-full max-h-[90vh] object-contain rounded-xl"
                        />
                        <button 
                            className="absolute top-2 right-2 bg-white rounded-full w-8 h-8 flex items-center justify-center text-black hover:bg-gray-200 transition"
                            onClick={() => setSelectedImage(null)}
                        >
                            <XCircle size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Orders