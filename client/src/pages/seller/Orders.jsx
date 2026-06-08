import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { assets } from '../../assets/assets'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { PDFDownloadLink } from '@react-pdf/renderer'
import OrderReceiptPDF from '../../components/OrderReceiptPDF'
import { Package, Calendar, Truck, CheckCircle, XCircle, Clock, Download, Filter, Search, RefreshCw, FileText, Eye } from 'lucide-react'

const Orders = () => {
    const { currency, axios } = useAppContext()
    const [orders, setOrders] = useState([])
    const [filteredOrders, setFilteredOrders] = useState([])
    const [updatingStatus, setUpdatingStatus] = useState(null)
    const [selectedImage, setSelectedImage] = useState(null)
    const location = useLocation()
    
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const fetchOrders = async () => {
        try {
            const { data } = await axios.get('/api/order/seller');
            if (data.success) {
                setOrders(data.orders)
                setFilteredOrders(data.orders)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
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
                fetchOrders();
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
            'Cancelled': 'Annulée'
        };
        return statusMap[status] || status;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Delivered': return <CheckCircle size={14} className="text-green-600" />;
            case 'Cancelled': return <XCircle size={14} className="text-red-600" />;
            case 'Shipped': case 'Out for Delivery': return <Truck size={14} className="text-purple-600" />;
            default: return <Clock size={14} className="text-blue-600" />;
        }
    };

    const getStatusColor = (status) => {
        if (status === 'Delivered') return 'bg-green-100 text-green-700';
        if (status === 'Cancelled') return 'bg-red-100 text-red-700';
        if (status === 'Shipped' || status === 'Out for Delivery') return 'bg-purple-100 text-purple-700';
        return 'bg-blue-100 text-blue-700';
    };

    const exportToExcel = () => {
        if (filteredOrders.length === 0) {
            toast.error('Aucune commande à exporter');
            return;
        }

        const exportDateTime = new Date();

        const exportData = filteredOrders.map(order => {
            const orderDate = new Date(order.createdAt);
            
            return {
                'N° Commande': order._id,
                'Date commande': orderDate.toLocaleDateString('fr-FR'),
                'Heure commande': orderDate.toLocaleTimeString('fr-FR'),
                'Client': `${order.address.firstName} ${order.address.lastName}`,
                'Téléphone': order.address.phone,
                'Quartier': order.address.street || '-',
                'Commune': order.address.communeName || '-',
                'Ville': order.address.cityName || order.address.city || '-',
                'Produits': order.items.map(item => 
                    `${item.product?.name || 'Produit indisponible'} (x${item.quantity})${item.color ? ` - ${item.color}` : ''}${item.size ? ` - ${item.size}` : ''}`
                ).join(', '),
                'Montant Total': `${order.amount} ${currency}`,
                'Statut': getStatusLabel(order.status),
                'Paiement': order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne",
                'Payé': order.isPaid ? "Oui" : "Non"
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        
        worksheet['!cols'] = [
            { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 25 },
            { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
            { wch: 60 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 8 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Commandes');
        const fileName = `commandes_${exportDateTime.toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        toast.success(`${filteredOrders.length} commande(s) exportée(s)`);
    };

    useEffect(() => {
        let filtered = [...orders]

        if (statusFilter !== 'all') {
            filtered = filtered.filter(order => order.status === statusFilter)
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
                order._id.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setFilteredOrders(filtered)
    }, [statusFilter, dateFilter, searchTerm, startDate, endDate, orders])

    const getStatusCount = (status) => {
        return orders.filter(o => o.status === status).length
    }

    const getTotalSales = () => {
        return filteredOrders.reduce((sum, order) => sum + order.amount, 0)
    }

    useEffect(() => {
        fetchOrders();
    }, [location.pathname])

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
                        <p className="text-sm text-gray-500 mt-1">Gérez toutes les commandes des clients</p>
                        {filteredOrders.length > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                                Total des ventes : <span className="font-semibold text-red-500">{getTotalSales().toLocaleString()} {currency}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition shadow-sm"
                    >
                        <Download size={16} />
                        Exporter ({filteredOrders.length})
                    </button>
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-gray-400" />
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="text-sm border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-red-500"
                            >
                                <option value="all">Tous les statuts ({orders.length})</option>
                                <option value="Order Placed">Commandée ({getStatusCount('Order Placed')})</option>
                                <option value="Confirmed">Confirmée ({getStatusCount('Confirmed')})</option>
                                <option value="Shipped">Expédiée ({getStatusCount('Shipped')})</option>
                                <option value="Out for Delivery">En livraison ({getStatusCount('Out for Delivery')})</option>
                                <option value="Delivered">Livrée ({getStatusCount('Delivered')})</option>
                                <option value="Cancelled">Annulée ({getStatusCount('Cancelled')})</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <select 
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="text-sm border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-red-500"
                            >
                                <option value="all">Toutes les dates</option>
                                <option value="today">Aujourd'hui</option>
                                <option value="week">Cette semaine</option>
                                <option value="month">Ce mois</option>
                                <option value="custom">Période personnalisée</option>
                            </select>
                        </div>

                        <div className="flex-1 flex items-center gap-2 min-w-[200px]">
                            <Search size={16} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par n° commande"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-red-500"
                            />
                        </div>
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

                    {(statusFilter !== 'all' || dateFilter !== 'all' || searchTerm) && (
                        <button
                            onClick={() => {
                                setStatusFilter('all')
                                setDateFilter('all')
                                setSearchTerm('')
                                setStartDate('')
                                setEndDate('')
                            }}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 mt-2"
                        >
                            <RefreshCw size={12} />
                            Réinitialiser les filtres
                        </button>
                    )}
                </div>

                <p className="text-sm text-gray-500">
                    {filteredOrders.length} commande(s) affichée(s) sur {orders.length} totale(s)
                </p>

                {filteredOrders.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                        <Package size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucune commande ne correspond aux filtres</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {filteredOrders.map((order, index) => (
                            <div key={index} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                                {/* En-tête commande */}
                                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2">
                                    <div className="flex items-center gap-3">
                                        <Package size={16} className="text-gray-400" />
                                        <span className="text-xs font-mono text-gray-500">#{order._id.slice(-8)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Calendar size={14} className="text-gray-400" />
                                        <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Items */}
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

                                    {/* Adresse livraison */}
                                    <div className="bg-gray-50 rounded-xl p-3">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Livraison</p>
                                        <p className="text-sm text-gray-700">{order.address.firstName} {order.address.lastName}</p>
                                        <p className="text-sm text-gray-600">{order.address.street}</p>
                                        <p className="text-sm text-gray-600">{order.address.communeName}, {order.address.cityName || order.address.city}</p>
                                        <p className="text-sm text-gray-600">{order.address.phone}</p>
                                    </div>

                                    {/* Totaux */}
                                    <div className="flex flex-wrap justify-between items-center">
                                        <div>
                                            <p className="text-xs text-gray-500">{order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne"}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{order.isPaid ? "Payé" : "En attente"}</p>
                                        </div>
                                        <p className="text-xl font-bold text-red-500">
                                            {order.amount.toLocaleString()} {currency}
                                        </p>
                                    </div>

                                    {/* Actions */}
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
                                                <option value="Cancelled">Annulée</option>
                                            </select>
                                            {updatingStatus === order._id && (
                                                <span className="text-xs text-gray-400">Mise à jour...</span>
                                            )}
                                            <PDFDownloadLink
                                                document={<OrderReceiptPDF order={order} currency={currency} />}
                                                fileName={`facture_${order._id.slice(-8)}.pdf`}
                                                className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition"
                                            >
                                                {({ loading }) => loading ? (
                                                    <span>Chargement...</span>
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
                )}
            </div>

            {/* Modal image */}
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