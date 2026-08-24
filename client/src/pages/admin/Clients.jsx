import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Search, User, Mail, Phone, MapPin, Home, ChevronLeft, ChevronRight,
    Loader2, X, ShoppingBag, Eye, Calendar
} from 'lucide-react';

const Clients = () => {
    const { axios } = useAppContext();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [itemsPerPage] = useState(20);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientOrders, setClientOrders] = useState([]);
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const fetchClients = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/api/user/admin/clients?search=${searchTerm}&page=${currentPage}&limit=${itemsPerPage}`);
            if (data.success) {
                setClients(data.clients || []);
                setTotalPages(data.pages || 1);
                setTotal(data.total || 0);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, [searchTerm, currentPage]);

    const viewClientOrders = async (client) => {
        setSelectedClient(client);
        setShowOrdersModal(true);
        setLoadingOrders(true);
        try {
            const { data } = await axios.get(`/api/order/admin/user/${client._id}`);
            if (data.success) {
                setClientOrders(data.orders || []);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoadingOrders(false);
        }
    };

    const getStatusLabel = (status) => {
        const map = {
            'Order Placed': 'Commandée',
            'Confirmed': 'Confirmée',
            'Shipped': 'Expédiée',
            'Out for Delivery': 'En livraison',
            'Delivered': 'Livrée',
            'Cancelled': 'Annulée',
            'Returned': 'Retournée',
        };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = {
            'Delivered': 'bg-green-100 text-green-700',
            'Cancelled': 'bg-gray-100 text-gray-700',
            'Returned': 'bg-red-100 text-red-700',
            'Shipped': 'bg-purple-100 text-purple-700',
            'Out for Delivery': 'bg-orange-100 text-orange-700',
            'Confirmed': 'bg-blue-100 text-blue-700',
        };
        return map[status] || 'bg-blue-100 text-blue-700';
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const totalClients = total;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="animate-spin text-red-500 mx-auto" size={32} />
                    <p className="mt-3 text-sm text-gray-500">Chargement des clients...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                {/* En-tête */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
                        <p className="text-sm text-gray-500 mt-1">{totalClients} client(s) inscrit(s)</p>
                    </div>
                </div>

                {/* Recherche */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par nom, email ou téléphone..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-gray-400 outline-none text-sm"
                            />
                        </div>
                        <button
                            onClick={fetchClients}
                            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition"
                        >
                            Rechercher
                        </button>
                    </div>
                </div>

                {/* Liste */}
                {clients.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <User size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucun client trouvé</p>
                        <p className="text-sm text-gray-400 mt-1">Essayez une autre recherche</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-5">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Téléphone</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Adresse</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inscrit le</th>
                                        <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {clients.map((client) => (
                                        <tr key={client._id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm">
                                                        {(client.firstName?.[0] || client.name?.[0] || '?').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {client.firstName} {client.lastName}
                                                        </p>
                                                        <p className="text-xs text-gray-400">{client.name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{client.email}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{client.phone || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {client.street || '-'}
                                                {client.communeName && <span className="block text-xs text-gray-400">{client.communeName}</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{formatDate(client.createdAt)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => viewClientOrders(client)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                >
                                                    <ShoppingBag size={14} />
                                                    Commandes
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                                <p className="text-sm text-gray-500">Page {currentPage} / {totalPages}</p>
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Commandes */}
            {showOrdersModal && selectedClient && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900">
                                    Commandes de {selectedClient.firstName} {selectedClient.lastName}
                                </h3>
                                <p className="text-sm text-gray-500">{selectedClient.email}</p>
                            </div>
                            <button onClick={() => setShowOrdersModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
                            {loadingOrders ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="animate-spin text-red-500" size={24} />
                                </div>
                            ) : clientOrders.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                                    <ShoppingBag size={32} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500">Aucune commande pour ce client</p>
                                </div>
                            ) : (
                                clientOrders.map((order) => (
                                    <div key={order._id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-mono text-sm font-medium text-gray-900">
                                                    #{order._id.slice(-8).toUpperCase()}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {formatDate(order.createdAt)} à {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>
                                                {getStatusLabel(order.status)}
                                            </span>
                                        </div>

                                        <div className="border-t border-gray-100 pt-3 mt-3">
                                            <div className="space-y-1.5">
                                                {order.items?.map((item, i) => (
                                                    <div key={i} className="flex justify-between text-sm">
                                                        <span className="text-gray-700">
                                                            {item.name || item.product?.name || 'Produit'}
                                                            <span className="text-xs text-gray-400 ml-1">x{item.quantity}</span>
                                                        </span>
                                                        <span className="font-medium text-gray-900">
                                                            {((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity).toLocaleString()} FCFA
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-100 pt-3 mt-3 flex justify-between items-center">
                                            <p className="text-xs text-gray-500">
                                                {order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne"}
                                                {order.isPaid ? ' ✅' : ' ⏳'}
                                            </p>
                                            <p className="font-bold text-red-500">{order.amount.toLocaleString()} FCFA</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-white">
                            <button
                                onClick={() => setShowOrdersModal(false)}
                                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clients;