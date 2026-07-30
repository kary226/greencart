import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Package, MapPin, Clock, CheckCircle, Loader2, Truck, Eye, Calendar, Phone, User, ChevronRight } from 'lucide-react';

const MesLivraisons = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [commandes, setCommandes] = useState([]);
    const [historique, setHistorique] = useState([]);
    const [moi, setMoi] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const loadLivraisons = async () => {
            try {
                const { data: authData } = await axios.get('/api/staff/is-auth');
                if (!authData.success || authData.staffUser?.role !== 'livreur') {
                    navigate('/staff/login');
                    return;
                }
                setMoi(authData.staffUser);

                const { data } = await axios.get('/api/order/livreur/mes-livraisons');
                if (data.success) {
                    setCommandes(data.orders || []);
                    setHistorique(data.historique || []);
                }
            } catch (error) {
                toast.error(error.response?.data?.message || error.message);
                if (error.response?.status === 401) navigate('/staff/login');
            } finally {
                setLoading(false);
            }
        };
        loadLivraisons();
    }, [axios, navigate]);

    const handleUpdateStatus = async (order, newStatus) => {
        setUpdating(true);
        try {
            const { data } = await axios.patch('/api/order/livreur/statut', {
                orderId: order._id,
                status: newStatus
            });
            if (data.success) {
                toast.success(newStatus === 'Delivered' ? 'Livraison confirmée ! 🎉' : 'Statut mis à jour');
                const { data: refreshData } = await axios.get('/api/order/livreur/mes-livraisons');
                if (refreshData.success) {
                    setCommandes(refreshData.orders || []);
                    setHistorique(refreshData.historique || []);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setUpdating(false);
        }
    };

    const getStatusBadge = (status) => {
        const config = {
            'Order Placed': { label: 'Commandée', className: 'bg-gray-100 text-gray-700' },
            'Confirmed': { label: 'Confirmée', className: 'bg-blue-100 text-blue-700' },
            'Shipped': { label: 'Expédiée', className: 'bg-indigo-100 text-indigo-700' },
            'Out for Delivery': { label: 'En livraison 🚚', className: 'bg-amber-100 text-amber-700' },
            'Delivered': { label: 'Livrée ✅', className: 'bg-green-100 text-green-700' },
            'Returned': { label: 'Retournée', className: 'bg-red-100 text-red-700' },
            'Cancelled': { label: 'Annulée', className: 'bg-red-100 text-red-700' },
        };
        return config[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center">
                <Loader2 className="animate-spin text-burgundy-600" size={40} />
            </div>
        );
    }

    const commandesActives = commandes.filter(o => !['Delivered', 'Returned', 'Cancelled'].includes(o.status));

    return (
        <div className="min-h-screen bg-ivory-200">
            <div className="bg-burgundy-600 text-ivory-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Truck size={24} />
                            <div>
                                <h1 className="text-lg font-bold">Mes livraisons</h1>
                                <p className="text-sm text-blush-300">{commandesActives.length} commande{commandesActives.length > 1 ? 's' : ''} en cours</p>
                            </div>
                        </div>
                        <span className="text-xs bg-blush-200/20 px-3 py-1 rounded-full">{moi?.nom}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Clock size={18} className="text-amber-500" /> Commandes à livrer
                </h2>

                {commandesActives.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-8 text-center mb-6">
                        <Package className="mx-auto text-gray-400 mb-3" size={48} />
                        <h3 className="text-lg font-medium text-gray-800">Aucune commande en cours</h3>
                        <p className="text-sm text-gray-500 mt-1">Vous serez notifié lorsqu'une nouvelle commande vous sera assignée</p>
                    </div>
                ) : (
                    <div className="space-y-4 mb-8">
                        {commandesActives.map((order) => {
                            const status = getStatusBadge(order.status);
                            return (
                                <div key={order._id} className="bg-white rounded-xl shadow-sm border border-blush-300 overflow-hidden hover:shadow-md transition">
                                    <div className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">Commande #{order._id.slice(-8)}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <Calendar size={12} />
                                                    {new Date(order.createdAt).toLocaleDateString('fr-FR')} · {order.items.length} article{order.items.length > 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.className}`}>{status.label}</span>
                                        </div>

                                        <div className="mt-2 text-sm border-t border-blush-100 pt-2">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <User size={14} /><span>{order.address?.name || 'Client'}</span>
                                                <span className="text-gray-300">|</span>
                                                <Phone size={14} /><span>{order.address?.phone || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-600 mt-0.5">
                                                <MapPin size={14} />
                                                <span className="text-xs">{order.address?.street || ''}, {order.address?.communeId?.name || ''}</span>
                                            </div>
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {order.items.slice(0, 3).map((item, idx) => (
                                                <span key={idx} className="text-xs bg-blush-100 text-gray-700 px-2 py-0.5 rounded-full">
                                                    {item.product?.name || 'Produit'} x{item.quantity}
                                                </span>
                                            ))}
                                            {order.items.length > 3 && <span className="text-xs text-gray-400">+{order.items.length - 3} autres</span>}
                                        </div>

                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-sm font-bold text-burgundy-600">{order.amount.toLocaleString()} FCFA</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => navigate(`/livreur/commande/${order._id}`)} className="text-sm text-gray-500 hover:text-burgundy-600 transition flex items-center gap-1">
                                                    <Eye size={14} /> Détails
                                                </button>
                                                {order.status === 'Out for Delivery' && (
                                                    <button onClick={() => handleUpdateStatus(order, 'Delivered')} className="flex items-center gap-1 text-sm bg-burgundy-600 text-ivory-200 px-3 py-1.5 rounded-lg hover:bg-burgundy-700 transition">
                                                        <CheckCircle size={14} /> Livré
                                                    </button>
                                                )}
                                                {order.status === 'Shipped' && (
                                                    <button onClick={() => handleUpdateStatus(order, 'Out for Delivery')} className="flex items-center gap-1 text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition">
                                                        <Truck size={14} /> En livraison
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircle size={18} className="text-green-500" /> Historique des livraisons
                </h2>

                {historique.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-6 text-center">
                        <p className="text-sm text-gray-500">Aucune livraison dans l'historique</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-blush-300 overflow-hidden">
                        <div className="divide-y divide-blush-200">
                            {historique.slice(0, 10).map((order) => {
                                const status = getStatusBadge(order.status);
                                return (
                                    <div key={order._id} className="px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">#{order._id.slice(-8)}</p>
                                            <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-gray-600">{order.amount.toLocaleString()} FCFA</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}>{status.label}</span>
                                            <button onClick={() => navigate(`/livreur/commande/${order._id}`)} className="p-1 text-gray-400 hover:text-burgundy-600 transition">
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MesLivraisons;