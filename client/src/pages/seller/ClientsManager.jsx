import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const ClientsManager = () => {
    const { axios } = useAppContext();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [clientOrders, setClientOrders] = useState([]);
    const [clientDetails, setClientDetails] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '-';
            return date.toLocaleDateString('fr-FR');
        } catch (error) {
            return '-';
        }
    };

    const fetchClients = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/api/user/admin/clients?search=${searchTerm}&page=${currentPage}`);
            if (data.success) {
                setClients(data.clients);
                setTotalPages(data.pages);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, [searchTerm, currentPage]);

    const viewClientDetails = (client) => {
        setSelectedClient(client);
        setClientDetails(client);
        setShowDetailsModal(true);
    };

    const viewClientOrders = async (client) => {
        setSelectedClient(client);
        setShowOrdersModal(true);
        setLoadingOrders(true);
        try {
            const { data } = await axios.get(`/api/order/admin/user/${client._id}`);
            if (data.success) {
                setClientOrders(data.orders);
                if (data.user) {
                    setClientDetails(data.user);
                }
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoadingOrders(false);
        }
    };

    const closeDetailsModal = () => {
        setShowDetailsModal(false);
        setSelectedClient(null);
        setClientDetails(null);
    };

    const closeOrdersModal = () => {
        setShowOrdersModal(false);
        setSelectedClient(null);
        setClientOrders([]);
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

    const getStatusColor = (status) => {
        if (status === 'Delivered') return 'bg-green-100 text-green-700';
        if (status === 'Cancelled') return 'bg-red-100 text-red-700';
        if (status === 'Shipped' || status === 'Out for Delivery') return 'bg-purple-100 text-purple-700';
        return 'bg-blue-100 text-blue-700';
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
                    <p className="text-sm text-gray-500 mt-1">Rechercher un client, voir ses informations et ses commandes</p>
                </div>

                {/* Barre de recherche */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Rechercher par nom, email ou téléphone..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition"
                            />
                        </div>
                        <button
                            onClick={() => fetchClients()}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition shadow-sm"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            Rechercher
                        </button>
                    </div>
                </div>

                {/* Tableau des clients */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                            <p className="mt-4 text-sm text-gray-500">Chargement des clients...</p>
                        </div>
                    </div>
                ) : clients.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <p className="text-gray-500">Aucun client trouvé</p>
                        <p className="text-sm text-gray-400 mt-1">Essayez une autre recherche</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Téléphone</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quartier / Rue</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ville / Commune</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inscrit le</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {clients.map((client) => (
                                        <tr key={client._id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-gray-900">{client.firstName} {client.lastName}</p>
                                                <p className="text-xs text-gray-400">{client.name}</p>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 text-sm">{client.email}</td>
                                            <td className="px-6 py-4 text-gray-600 text-sm">{client.phone || '-'}</td>
                                            <td className="px-6 py-4 text-gray-600 text-sm">{client.street || '-'}</td>
                                            <td className="px-6 py-4 text-gray-600 text-sm">
                                                {client.communeName ? `${client.communeName}` : '-'}
                                                {client.cityName ? ` / ${client.cityName}` : ''}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-sm">
                                                {formatDate(client.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => viewClientDetails(client)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="12" cy="12" r="3"/>
                                                            <path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z"/>
                                                        </svg>
                                                        Détails
                                                    </button>
                                                    <button
                                                        onClick={() => viewClientOrders(client)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                                            <line x1="2" y1="10" x2="22" y2="10"/>
                                                        </svg>
                                                        Commandes
                                                    </button>
                                                </div>
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
                    <div className="flex justify-center items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                        </button>
                        <span className="px-4 py-2 text-sm text-gray-600">
                            Page {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Modal Détails du client */}
            {showDetailsModal && selectedClient && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeDetailsModal}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
                            <h3 className="text-lg font-semibold text-gray-900">Informations client</h3>
                            <button onClick={closeDetailsModal} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-sm text-gray-500">Nom complet</span>
                                <span className="text-sm font-medium text-gray-900">{selectedClient.firstName} {selectedClient.lastName}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-sm text-gray-500">Email</span>
                                <span className="text-sm font-medium text-gray-900">{selectedClient.email}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-sm text-gray-500">Téléphone</span>
                                <span className="text-sm font-medium text-gray-900">{selectedClient.phone || 'Non renseigné'}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-sm text-gray-500">Quartier / Rue</span>
                                <span className="text-sm font-medium text-gray-900">{selectedClient.street || 'Non renseigné'}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-sm text-gray-500">Commune</span>
                                <span className="text-sm font-medium text-gray-900">{selectedClient.communeName || 'Non renseigné'}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-sm text-gray-500">Ville</span>
                                <span className="text-sm font-medium text-gray-900">{selectedClient.cityName || 'Non renseigné'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Membre depuis</span>
                                <span className="text-sm font-medium text-gray-900">
                                    {formatDate(selectedClient.createdAt)}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button onClick={closeDetailsModal} className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal des commandes */}
            {showOrdersModal && selectedClient && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeOrdersModal}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Commandes de {selectedClient.firstName} {selectedClient.lastName}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">{selectedClient.email} | {selectedClient.phone || 'Pas de téléphone'}</p>
                            </div>
                            <button onClick={closeOrdersModal} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
                            {loadingOrders ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                                </div>
                            ) : clientOrders.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                                        <line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/>
                                        <line x1="2" y1="10" x2="22" y2="10"/>
                                    </svg>
                                    <p className="text-gray-500">Aucune commande pour ce client</p>
                                </div>
                            ) : (
                                clientOrders.map((order, idx) => (
                                    <div key={idx} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-mono text-sm font-medium text-gray-900">#{order._id.slice(-8)}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {formatDate(order.createdAt)} à {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>
                                                {getStatusLabel(order.status)}
                                            </span>
                                        </div>

                                        <div className="border-t border-gray-100 pt-3 mt-3">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Articles commandés</p>
                                            <div className="space-y-2">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="flex justify-between items-center text-sm">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-medium text-gray-800">{item.product?.name || 'Produit'}</span>
                                                            {item.color && <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">{item.color}</span>}
                                                            {item.size && <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">{item.size}</span>}
                                                            <span className="text-xs text-gray-400">x {item.quantity}</span>
                                                        </div>
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
                                            </p>
                                            <p className="font-bold text-red-500">
                                                Total: {order.amount.toLocaleString()} FCFA
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-white">
                            <button onClick={closeOrdersModal} className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsManager;