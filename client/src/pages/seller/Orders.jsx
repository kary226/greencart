import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { assets } from '../../assets/assets'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { PDFDownloadLink } from '@react-pdf/renderer'
import OrderReceiptPDF from '../../components/OrderReceiptPDF'

const Orders = () => {
    const {currency, axios} = useAppContext()
    const [orders, setOrders] = useState([])
    const [filteredOrders, setFilteredOrders] = useState([])
    const [updatingStatus, setUpdatingStatus] = useState(null)
    const [selectedImage, setSelectedImage] = useState(null)
    const location = useLocation()
    
    // Filtres
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const fetchOrders = async () =>{
        try {
            const { data } = await axios.get('/api/order/seller');
            if(data.success){
                setOrders(data.orders)
                setFilteredOrders(data.orders)
            }else{
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
            if(data.success){
                toast.success(`Statut mis à jour : ${newStatus}`);
                fetchOrders();
            }else{
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

    // Fonction d'export Excel améliorée
    const exportToExcel = () => {
        if (filteredOrders.length === 0) {
            toast.error('Aucune commande à exporter');
            return;
        }

        const exportDateTime = new Date();
        const formattedExportDate = exportDateTime.toLocaleDateString('fr-FR');
        const formattedExportTime = exportDateTime.toLocaleTimeString('fr-FR');

        const exportData = filteredOrders.map(order => {
            const orderDate = new Date(order.createdAt);
            
            return {
                'N° Commande': order._id,
                'Date commande': orderDate.toLocaleDateString('fr-FR'),
                'Heure commande': orderDate.toLocaleTimeString('fr-FR'),
                'Client': `${order.address.firstName} ${order.address.lastName}`,
                'Téléphone': order.address.phone,
                'Ville': order.address.city || '-',
                'Commune': order.address.state || '-',
                'Quartier': order.address.street || '-',
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
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
            { wch: 60 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 8 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Commandes');
        const fileName = `commandes_GreenCart_${exportDateTime.toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        toast.success(`${filteredOrders.length} commande(s) exportée(s)`);
    };

    // Appliquer les filtres
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

    useEffect(()=>{
        fetchOrders();
    },[location.pathname]) // ← AJOUT DE location.pathname

    return (
        <>
            <div className='no-scrollbar flex-1 h-[95vh] overflow-y-scroll'>
                <div className="md:p-10 p-4 space-y-4">
                    <div className="flex justify-between items-center flex-wrap gap-3">
                        <div>
                            <h2 className="text-lg font-medium">Liste des commandes</h2>
                            {filteredOrders.length > 0 && (
                                <p className="text-sm text-gray-500 mt-1">
                                    Total des ventes : {getTotalSales()} {currency}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={exportToExcel}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm flex items-center gap-2"
                        >
                            📊 Exporter Excel ({filteredOrders.length})
                        </button>
                    </div>
                    
                    {/* Barre de filtres */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                        <div className="flex flex-wrap gap-3 items-center">
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none"
                            >
                                <option value="all">📋 Tous les statuts ({orders.length})</option>
                                <option value="Order Placed">🟡 Commandée ({getStatusCount('Order Placed')})</option>
                                <option value="Confirmed">🔵 Confirmée ({getStatusCount('Confirmed')})</option>
                                <option value="Shipped">🟣 Expédiée ({getStatusCount('Shipped')})</option>
                                <option value="Out for Delivery">🟠 En livraison ({getStatusCount('Out for Delivery')})</option>
                                <option value="Delivered">🟢 Livrée ({getStatusCount('Delivered')})</option>
                                <option value="Cancelled">🔴 Annulée ({getStatusCount('Cancelled')})</option>
                            </select>

                            <select 
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none"
                            >
                                <option value="all">📅 Toutes les dates</option>
                                <option value="today">📆 Aujourd'hui</option>
                                <option value="week">📆 Cette semaine</option>
                                <option value="month">📆 Ce mois</option>
                                <option value="custom">📆 Période personnalisée</option>
                            </select>

                            <input
                                type="text"
                                placeholder="🔍 Rechercher par n° commande"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 min-w-[200px] text-sm border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-primary"
                            />
                        </div>

                        {dateFilter === 'custom' && (
                            <div className="flex flex-wrap gap-3">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none"
                                />
                                <span className="text-gray-500">→</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none"
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
                                className="text-xs text-primary hover:underline"
                            >
                                ✕ Réinitialiser les filtres
                            </button>
                        )}
                    </div>

                    <p className="text-sm text-gray-500">
                        {filteredOrders.length} commande(s) affichée(s) sur {orders.length} totale(s)
                    </p>

                    {filteredOrders.length === 0 ? (
                        <p className="text-gray-500 text-center py-10">Aucune commande ne correspond aux filtres</p>
                    ) : (
                        filteredOrders.map((order, index) => (
                            <div key={index} className="flex flex-col p-5 max-w-4xl rounded-md border border-gray-300 space-y-3">
                                
                                <div className="flex flex-wrap justify-between items-center border-b border-gray-200 pb-2">
                                    <p className="text-xs text-gray-400">📦 Commande : {order._id.slice(-8)}</p>
                                    <p className="text-sm text-gray-500">📅 {new Date(order.createdAt).toLocaleDateString()}</p>
                                </div>

                                <div className="flex flex-col gap-5">
                                    
                                    <div className="flex gap-5">
                                        <div className="flex-1">
                                            {order.items.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100 last:border-0">
                                                    {item.product?.image?.[0] && (
                                                        <img 
                                                            src={item.product.image[0]} 
                                                            alt={item.product?.name || 'Produit'}
                                                            className="w-14 h-14 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition"
                                                            onClick={() => setSelectedImage(item.product.image[0])}
                                                        />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="font-medium">
                                                            {item.product?.name || 'Produit indisponible'}{" "} 
                                                            <span className="text-primary">x {item.quantity}</span>
                                                        </p>
                                                        <div className="flex gap-2 mt-1 flex-wrap">
                                                            {item.color && item.color !== 'null' && (
                                                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                                                    🎨 {item.color}
                                                                </span>
                                                            )}
                                                            {item.size && item.size !== 'null' && (
                                                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                                                     {item.size}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="font-medium text-primary whitespace-nowrap">
                                                        {(item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity}{currency}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="text-sm md:text-base text-black/60 bg-gray-50 p-3 rounded-lg">
                                        <p className='text-black/80 font-medium mb-1'>📍 Livraison</p>
                                        <p>{order.address.firstName} {order.address.lastName}</p>
                                        <p>{order.address.street}, {order.address.city}</p>
                                        <p>{order.address.phone}</p>
                                    </div>

                                    <div className="flex flex-wrap justify-between items-center">
                                        <div className="flex flex-col text-sm">
                                            <p> {order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne"}</p>
                                            <p> {order.isPaid ? "✅ Payé" : "⏳ En attente"}</p>
                                        </div>
                                        <p className="font-bold text-xl text-primary">
                                            Total: {order.amount}{currency}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-gray-600">Statut :</span>
                                        <span className={`text-sm px-3 py-1 rounded-full ${
                                            order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                                            order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                            order.status === 'Shipped' || order.status === 'Out for Delivery' ? 'bg-purple-100 text-purple-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <select 
                                            defaultValue={order.status}
                                            onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                                            disabled={updatingStatus === order._id}
                                            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 outline-none focus:border-primary"
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
                                            className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 transition text-center"
                                        >
                                            {({ loading }) => loading ? '⏳...' : '📄 PDF'}
                                        </PDFDownloadLink>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
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
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        />
                        <button 
                            className="absolute top-2 right-2 bg-white rounded-full w-8 h-8 flex items-center justify-center text-black hover:bg-gray-200 transition"
                            onClick={() => setSelectedImage(null)}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}

export default Orders