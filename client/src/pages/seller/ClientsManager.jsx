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
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingOrders, setLoadingOrders] = useState(false);

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

    const viewClientOrders = async (client) => {
        setSelectedClient(client);
        setShowOrdersModal(true);
        setLoadingOrders(true);
        try {
            const { data } = await axios.get(`/api/order/admin/user/${client._id}`);
            if (data.success) {
                setClientOrders(data.orders);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoadingOrders(false);
        }
    };

    const closeModal = () => {
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
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll">
            <div className="md:p-10 p-4 space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h2 className="text-2xl font-bold">Gestion des clients</h2>
                        <p className="text-gray-500 text-sm mt-1">Rechercher un client et voir ses commandes</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Rechercher par nom, email ou téléphone..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                        />
                        <button
                            onClick={() => fetchClients()}
                            className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition"
                        >
                            🔍 Rechercher
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10">Chargement...</div>
                ) : clients.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">Aucun client trouvé</div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Client</th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Téléphone</th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Date d'inscription</th>
                                    <th className="px-6 py-3 text-center text-sm font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {clients.map((client) => (
                                    <tr key={client._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium">{client.firstName} {client.lastName}</p>
                                                <p className="text-xs text-gray-400">{client.name}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{client.email}</td>
                                        <td className="px-6 py-4 text-gray-600">{client.phone || '-'}</td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">
                                            {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => viewClientOrders(client)}
                                                className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-lg hover:bg-blue-100 transition text-sm"
                                            >
                                                📦 Voir commandes
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            ◀
                        </button>
                        <span className="px-3 py-1">
                            Page {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            ▶
                        </button>
                    </div>
                )}
            </div>

            {showOrdersModal && selectedClient && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    Commandes de {selectedClient.firstName} {selectedClient.lastName}
                                </h3>
                                <p className="text-sm text-gray-500">{selectedClient.email} | {selectedClient.phone || 'Pas de téléphone'}</p>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loadingOrders ? (
                                <div className="text-center py-10">Chargement des commandes...</div>
                            ) : clientOrders.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">Aucune commande pour ce client</div>
                            ) : (
                                clientOrders.map((order, idx) => (
                                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-medium">Commande #{order._id.slice(-8)}</p>
                                                <p className="text-xs text-gray-400">
                                                    {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                                                </p>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                                                {getStatusLabel(order.status)}
                                            </span>
                                        </div>

                                        <div className="border-t pt-3">
                                            <p className="text-sm font-medium mb-2">Articles commandés :</p>
                                            <div className="space-y-2">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="flex justify-between items-center text-sm">
                                                        <div>
                                                            <span className="font-medium">{item.product?.name || 'Produit'}</span>
                                                            {item.color && <span className="text-xs text-gray-400 ml-2">🎨 {item.color}</span>}
                                                            {item.size && <span className="text-xs text-gray-400 ml-2">📐 {item.size}</span>}
                                                            <span className="text-xs text-gray-400 ml-2">x {item.quantity}</span>
                                                        </div>
                                                        <span className="font-medium text-primary">
                                                            {(item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity} FCFA
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="border-t pt-3 flex justify-between items-center">
                                            <p className="text-sm text-gray-500">
                                                {order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne"}
                                            </p>
                                            <p className="font-bold text-primary">
                                                Total: {order.amount} FCFA
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t bg-gray-50">
                            <button onClick={closeModal} className="w-full py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition">
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