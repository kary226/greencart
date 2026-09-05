import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { PackageCheck, Truck, Loader2, Clock, User, RefreshCw } from 'lucide-react';

/**
 * RÉCEPTION & REMISE (Opérations)
 * ================================================================
 * Cet écran n'existait pas : une commande collectée (« Collecte
 * terminée ») affichait au livreur « Les Opérations doivent
 * réceptionner le colis et le marquer Expédié », mais aucun écran ne
 * permettait aux Opérations de savoir laquelle réceptionner, ni de le
 * faire. Une commande pouvait rester bloquée indéfiniment à ce stade.
 *
 * Deux files d'attente, dans l'ordre où elles se produisent :
 *   1. À réceptionner — la collecte est terminée, le colis attend
 *      d'être physiquement reçu à l'entrepôt (Ready for Shipment).
 *      Action : receptionnerColis() → statut passe à "Shipped".
 *   2. À remettre au livreur — le colis est reçu (Shipped) et un
 *      livreur lui est déjà assigné (en général celui qui a collecté),
 *      mais personne n'a encore confirmé la remise physique du colis.
 *      Sans cette confirmation, le livreur ne peut pas déclarer
 *      "En livraison" (voir updateLivraisonStatus, orderController.js).
 *      Action : confirmerRemiseLivreur() → débloque "En livraison".
 */

const Reception = () => {
    const { axios } = useAppContext();
    const [tab, setTab] = useState('receptionner');
    const [aReceptionner, setAReceptionner] = useState([]);
    const [aRemettre, setARemettre] = useState([]);
    const [loading, setLoading] = useState(true);
    const [enCours, setEnCours] = useState(null);

    const fetchTout = useCallback(async () => {
        setLoading(true);
        try {
            const [r1, r2] = await Promise.all([
                axios.get('/api/order/seller/a-receptionner'),
                axios.get('/api/order/seller/a-remettre'),
            ]);
            if (r1.data.success) setAReceptionner(r1.data.orders || []);
            if (r2.data.success) setARemettre(r2.data.orders || []);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    }, [axios]);

    useEffect(() => { fetchTout(); }, [fetchTout]);

    const receptionner = async (orderId) => {
        setEnCours(orderId);
        try {
            const { data } = await axios.post('/api/order/reception', { orderId });
            if (data.success) {
                toast.success(data.message || 'Commande réceptionnée');
                fetchTout();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setEnCours(null);
        }
    };

    const confirmerRemise = async (orderId) => {
        setEnCours(orderId);
        try {
            const { data } = await axios.post('/api/order/seller/remettre-livreur', { orderId });
            if (data.success) {
                toast.success(data.message || 'Remise confirmée');
                fetchTout();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setEnCours(null);
        }
    };

    const formatDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-5xl mx-auto">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Réception & remise</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Colis collectés en attente d'entrer à l'entrepôt, puis d'être remis au livreur qui les livrera.
                        </p>
                    </div>
                    <button
                        onClick={fetchTout}
                        className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm hover:bg-gray-200 transition"
                    >
                        <RefreshCw size={15} /> Actualiser
                    </button>
                </div>

                <div className="flex gap-2 mt-5">
                    <button
                        onClick={() => setTab('receptionner')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 ${tab === 'receptionner' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                    >
                        <PackageCheck size={16} /> À réceptionner
                        {aReceptionner.length > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'receptionner' ? 'bg-white/20' : 'bg-gray-100'}`}>
                                {aReceptionner.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setTab('remettre')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 ${tab === 'remettre' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                    >
                        <Truck size={16} /> À remettre au livreur
                        {aRemettre.length > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'remettre' ? 'bg-white/20' : 'bg-gray-100'}`}>
                                {aRemettre.length}
                            </span>
                        )}
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="animate-spin text-gray-400" size={28} />
                    </div>
                ) : (
                    <div className="space-y-3 mt-5">
                        {tab === 'receptionner' && (
                            aReceptionner.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
                                    Rien à réceptionner pour l'instant.
                                </div>
                            ) : aReceptionner.map((order) => (
                                <div key={order._id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between gap-4 flex-wrap">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900">#{order._id.slice(-8).toUpperCase()}</p>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                                            <span>{(order.items || []).length} article(s)</span>
                                            <span className="flex items-center gap-1">
                                                <User size={12} /> Collecté par {order.collecteLivreurId?.nom || 'livreur inconnu'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} /> {formatDate(order.collecteReserveeLe)}
                                            </span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => receptionner(order._id)}
                                        disabled={enCours === order._id}
                                        className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2 shrink-0"
                                    >
                                        {enCours === order._id ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={15} />}
                                        Réceptionner
                                    </button>
                                </div>
                            ))
                        )}

                        {tab === 'remettre' && (
                            aRemettre.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
                                    Rien à remettre pour l'instant.
                                </div>
                            ) : aRemettre.map((order) => (
                                <div key={order._id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between gap-4 flex-wrap">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900">#{order._id.slice(-8).toUpperCase()}</p>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                                            <span>{(order.items || []).length} article(s)</span>
                                            <span className="flex items-center gap-1">
                                                <User size={12} /> Pour {order.livreurId?.nom || 'livreur inconnu'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} /> Reçu le {formatDate(order.shippedAt)}
                                            </span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => confirmerRemise(order._id)}
                                        disabled={enCours === order._id}
                                        className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-2 shrink-0"
                                    >
                                        {enCours === order._id ? <Loader2 size={15} className="animate-spin" /> : <Truck size={15} />}
                                        Confirmer la remise
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reception;