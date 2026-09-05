import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Package, MapPin, Phone, User, Calendar,
    Clock, CheckCircle, Truck, Loader2, ArrowLeft, AlertTriangle, X
} from 'lucide-react';

const LivraisonDetail = () => {
    const { orderId } = useParams();
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [showSignalement, setShowSignalement] = useState(false);
    const [raison, setRaison] = useState('');
    const [envoiSignalement, setEnvoiSignalement] = useState(false);

    useEffect(() => {
        const loadOrder = async () => {
            try {
                const { data: authData } = await axios.get('/api/staff/is-auth');
                if (!authData.success || authData.staffUser?.role !== 'livreur') {
                    navigate('/staff/login');
                    return;
                }

                const { data } = await axios.get('/api/order/livreur/mes-livraisons');
                if (data.success) {
                    const found = [...data.orders, ...data.historique].find(
                        o => o._id === orderId
                    );
                    if (found) setOrder(found);
                    else {
                        toast.error('Commande non trouvée');
                        navigate('/livreur/mes-livraisons');
                    }
                }
            } catch (error) {
                toast.error(error.response?.data?.message || error.message);
            } finally {
                setLoading(false);
            }
        };
        loadOrder();
    }, [axios, navigate, orderId]);

    const handleUpdateStatus = async (newStatus) => {
        if (!order) return;
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
                    const found = [...refreshData.orders, ...refreshData.historique].find(
                        o => o._id === orderId
                    );
                    if (found) setOrder(found);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setUpdating(false);
        }
    };

    const signalerProbleme = async () => {
        if (!raison.trim()) {
            toast.error('Décris le problème constaté');
            return;
        }
        setEnvoiSignalement(true);
        try {
            const { data } = await axios.post('/api/order/admin/litige/declarer', {
                orderId: order._id,
                raison: raison.trim(),
            });
            if (data.success) {
                toast.success('Signalé — un responsable va traiter ça');
                setShowSignalement(false);
                setRaison('');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setEnvoiSignalement(false);
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

    if (!order) {
        return (
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center px-4">
                <div className="text-center">
                    <Package className="mx-auto text-gray-400 mb-3" size={48} />
                    <h2 className="text-lg font-bold text-gray-800">Commande non trouvée</h2>
                    <button
                        onClick={() => navigate('/livreur/mes-livraisons')}
                        className="mt-4 inline-flex items-center gap-2 text-burgundy-600 hover:text-burgundy-700"
                    >
                        <ArrowLeft size={16} /> Retour aux livraisons
                    </button>
                </div>
            </div>
        );
    }

    const status = getStatusBadge(order.status);
    const isActive = !['Delivered', 'Returned', 'Cancelled'].includes(order.status);

    return (
        <div className="min-h-screen bg-ivory-200">
            <div className="bg-burgundy-600 text-ivory-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/livreur/mes-livraisons')}
                                className="p-1 hover:bg-blush-200/20 rounded-lg transition"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-lg font-bold">Commande #{order._id.slice(-8)}</h1>
                                <p className="text-sm text-blush-300">
                                    {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                            </div>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${status.className}`}>
                            {status.label}
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-4 mb-4">
                    <h3 className="font-semibold text-gray-800 text-sm mb-2">📋 Informations client</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                            <User size={14} />
                            <span>{order.address?.name || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <Phone size={14} />
                            <span>{order.address?.phone || 'N/A'}</span>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 text-gray-600">
                            <MapPin size={14} />
                            <span className="text-sm">
                                {order.address?.street || ''}, {order.address?.communeId?.name || ''}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-4 mb-4">
                    <h3 className="font-semibold text-gray-800 text-sm mb-2">🛒 Articles</h3>
                    <div className="space-y-2">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm border-b border-blush-100 pb-2 last:border-0 last:pb-0">
                                <div>
                                    <p className="font-medium text-gray-800">
                                        {item.name || item.product?.name || 'Produit'}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        x{item.quantity}
                                        {item.color && ` · ${item.color}`}
                                        {item.size && ` · ${item.size}`}
                                    </p>
                                </div>
                                <span className="font-medium text-gray-800">
                                    {(item.priceAtOrder * item.quantity).toLocaleString()} FCFA
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-blush-200 space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Total</span>
                            <span className="text-base font-bold text-burgundy-600">
                                {order.amount.toLocaleString()} FCFA
                            </span>
                        </div>
                    </div>
                </div>

                {isActive && (
                    <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-4">
                        <h3 className="font-semibold text-gray-800 text-sm mb-3">🎯 Actions</h3>
                        <div className="flex flex-col gap-2">
                            {order.status === 'Shipped' && (
                                <button
                                    onClick={() => handleUpdateStatus('Out for Delivery')}
                                    disabled={updating}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition disabled:opacity-50"
                                >
                                    {updating ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
                                    Récupérer le colis & démarrer la livraison
                                </button>
                            )}
                            {order.status === 'Out for Delivery' && (
                                <button
                                    onClick={() => handleUpdateStatus('Delivered')}
                                    disabled={updating}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition disabled:opacity-50"
                                >
                                    {updating ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                    Marquer comme livrée
                                </button>
                            )}
                            {/* [NOUVEAU] Le livreur est la seule personne présente si le
                                client constate un problème à l'instant de la livraison
                                (colis ouvert, mauvais article) — avant, il fallait
                                attendre que le client contacte le support plus tard. */}
                            {['Out for Delivery', 'Delivered'].includes(order.status) && (
                                <button
                                    onClick={() => setShowSignalement(true)}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition"
                                >
                                    <AlertTriangle size={18} /> Signaler un problème
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <button
                    onClick={() => navigate('/livreur/mes-livraisons')}
                    className="mt-4 flex items-center gap-2 text-gray-500 hover:text-burgundy-600 transition text-sm"
                >
                    <ArrowLeft size={16} /> Retour aux livraisons
                </button>
            </div>

            {showSignalement && (
                <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <AlertTriangle size={18} className="text-red-500" /> Signaler un problème
                            </h2>
                            <button onClick={() => setShowSignalement(false)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-3">
                            Ce que tu écris ici est transmis directement à un responsable qui va trancher.
                        </p>
                        <textarea
                            value={raison}
                            onChange={(e) => setRaison(e.target.value)}
                            rows={3}
                            placeholder="Ex : le client dit avoir reçu un article différent de sa commande"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none resize-none mb-4"
                        />
                        <button
                            onClick={signalerProbleme}
                            disabled={envoiSignalement}
                            className="w-full py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {envoiSignalement ? <Loader2 size={18} className="animate-spin" /> : <AlertTriangle size={18} />}
                            Envoyer le signalement
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LivraisonDetail;