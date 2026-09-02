import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { notifier } from '../../utils/notifications';
import MonActivite from './MonActivite';
import { Package, MapPin, Clock, CheckCircle, Loader2, Truck, Eye, Calendar, Phone, User, Hand, Layers, BarChart3 } from 'lucide-react';

const MesLivraisons = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [commandes, setCommandes] = useState([]);
    const [collectes, setCollectes] = useState([]);
    const [historique, setHistorique] = useState([]);
    const [moi, setMoi] = useState(null);
    const [tab, setTab] = useState('collectes');

    const refresh = async () => {
        const [liv, col] = await Promise.all([
            axios.get('/api/order/livreur/mes-livraisons'),
            axios.get('/api/order/livreur/collectes')
        ]);
        if (liv.data.success) {
            setCommandes(liv.data.orders || []);
            setHistorique(liv.data.historique || []);
        }
        if (col.data.success) setCollectes(col.data.orders || []);
    };

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (!data.success || data.staffUser?.role !== 'livreur') {
                    navigate('/staff/login'); return;
                }
                setMoi(data.staffUser);
                await refresh();
            } catch (e) {
                toast.error(e.response?.data?.message || e.message);
                if (e.response?.status === 401) navigate('/staff/login');
            } finally { setLoading(false); }
        };
        load();
    }, [axios, navigate]);

    // Une collecte se prend au premier arrivé. Sans rafraîchissement, le
    // livreur devait recharger la page pour découvrir qu'une commande était
    // disponible — et la manquait au profit d'un collègue qui, lui, venait
    // de recharger. 45 s : assez court pour rester compétitif, assez long
    // pour ne pas mitrailler le serveur depuis un téléphone.
    const nbCollectes = React.useRef(null);
    useEffect(() => {
        if (!moi) return undefined;
        const minuterie = setInterval(async () => {
            try {
                const { data } = await axios.get('/api/order/livreur/collectes');
                if (!data.success) return;
                const liste = data.orders || [];
                setCollectes(liste);

                // On n'annonce qu'une AUGMENTATION, et jamais au premier
                // passage : sinon toute collecte déjà là passerait pour neuve.
                if (nbCollectes.current !== null && liste.length > nbCollectes.current) {
                    const nouvelles = liste.length - nbCollectes.current;
                    notifier.nouveaute(
                        nouvelles === 1 ? 'Nouvelle collecte disponible' : `${nouvelles} nouvelles collectes disponibles`
                    );
                }
                nbCollectes.current = liste.length;
            } catch { /* réseau capricieux : on retentera au prochain tour */ }
        }, 45_000);
        return () => clearInterval(minuterie);
    }, [axios, moi]);

    const reserve = async (order) => {
        try {
            const { data } = await axios.post('/api/order/livreur/collectes/reserver', { orderId: order._id });
            if (data.success) {
                toast.success('Collecte réservée. Elle disparaît maintenant des autres livreurs.');
                await refresh();
            }
        } catch (e) { toast.error(e.response?.data?.message || e.message); }
    };

    const collect = async (order, item) => {
        try {
            const { data } = await axios.post('/api/order/livreur/collectes/collecter', {
                orderId: order._id, itemId: item._id
            });
            if (data.success) {
                toast.success(data.tousCollectes ? 'Tous les articles sont collectés.' : 'Article collecté.');
                await refresh();
            }
        } catch (e) { toast.error(e.response?.data?.message || e.message); }
    };

    const statusBadge = (status) => ({
        'Confirmed': ['Confirmée', 'bg-blue-100 text-blue-700'],
        'Collecting': ['Collecte en cours', 'bg-amber-100 text-amber-700'],
        'Ready for Shipment': ['Collecte terminée', 'bg-purple-100 text-purple-700'],
        'Shipped': ['Expédiée', 'bg-indigo-100 text-indigo-700'],
        'Out for Delivery': ['En livraison 🚚', 'bg-amber-100 text-amber-700'],
        'Delivered': ['Livrée ✅', 'bg-green-100 text-green-700'],
        'Returned': ['Retournée', 'bg-red-100 text-red-700'],
        'Cancelled': ['Annulée', 'bg-red-100 text-red-700'],
    }[status] || [status, 'bg-gray-100 text-gray-700']);

    if (loading) return <div className="min-h-screen bg-ivory-200 flex items-center justify-center"><Loader2 className="animate-spin text-burgundy-600" size={40}/></div>;

    return (
        <div className="min-h-screen bg-ivory-200">
            <div className="bg-burgundy-600 text-ivory-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3"><Truck size={24}/><div><h1 className="text-lg font-bold">Espace livreur</h1><p className="text-sm text-blush-300">{moi?.nom}</p></div></div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Trois onglets : ce qu'il y a à prendre, ce qu'il y a à
                    livrer, et le bilan de ce qui est fait. */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                    <button onClick={() => setTab('collectes')} className={`p-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm ${tab==='collectes'?'bg-burgundy-600 text-white':'bg-white text-gray-600'}`}>
                        <Hand size={17}/> <span className="hidden sm:inline">Récupérer</span><span className="sm:hidden">Prendre</span> ({collectes.length})
                    </button>
                    <button onClick={() => setTab('livraisons')} className={`p-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm ${tab==='livraisons'?'bg-burgundy-600 text-white':'bg-white text-gray-600'}`}>
                        <Truck size={17}/> Livrer ({commandes.length})
                    </button>
                    <button onClick={() => setTab('activite')} className={`p-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm ${tab==='activite'?'bg-burgundy-600 text-white':'bg-white text-gray-600'}`}>
                        <BarChart3 size={17}/> Mon activité
                    </button>
                </div>

                {tab === 'activite' && <MonActivite />}

                {tab === 'collectes' && (
                    <>
                        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Layers size={18}/> Commandes à récupérer</h2>
                        {collectes.length === 0 ? <div className="bg-white rounded-xl p-8 text-center"><Package className="mx-auto text-gray-400 mb-3" size={48}/><p className="text-gray-500">Aucune collecte disponible.</p></div> :
                            <div className="space-y-4">{collectes.map(order => {
                                const mine = String(order.collecteLivreurId || '') === String(moi?._id || '');
                                const [label, cls] = statusBadge(order.status);
                                const activeItems = order.items.filter(i => i.availabilityStatus !== 'unavailable');
                                return <div key={order._id} className="bg-white rounded-xl shadow-sm border border-blush-300 p-4">
                                    <div className="flex justify-between items-start">
                                        <div><p className="font-medium">Commande #{order._id.slice(-8)}</p><p className="text-xs text-gray-500 mt-1">{new Date(order.createdAt).toLocaleDateString('fr-FR')} · {activeItems.length} article(s)</p></div>
                                        <span className={`text-xs px-2 py-1 rounded-full ${cls}`}>{label}</span>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        {activeItems.map(item => <div key={item._id} className="flex items-center justify-between border rounded-lg p-2">
                                            <span className="text-sm">{item.name || item.product?.name || 'Produit'} × {item.quantity}</span>
                                            {item.availabilityStatus === 'collected' ? <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle size={14}/> Collecté</span> :
                                                mine ? <button onClick={() => collect(order,item)} className="text-xs bg-burgundy-600 text-white px-3 py-1.5 rounded-lg">Collecter</button> : <span className="text-xs text-gray-400">À récupérer</span>}
                                        </div>)}
                                    </div>
                                    {!mine && order.status === 'Confirmed' && <button onClick={() => reserve(order)} className="mt-3 w-full bg-burgundy-600 text-white py-2 rounded-lg">Récupérer cette commande</button>}
                                    {mine && order.status === 'Ready for Shipment' && <div className="mt-3 text-sm bg-green-50 text-green-700 rounded-lg p-3">Tous les articles sont collectés. Les Opérations doivent réceptionner le colis et le marquer Expédié.</div>}
                                </div>
                            })}</div>}
                    </>
                )}

                {tab === 'livraisons' && (
                    <>
                        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Clock size={18}/> Mes livraisons</h2>
                        {commandes.length === 0 ? <div className="bg-white rounded-xl p-8 text-center"><p className="text-gray-500">Aucune livraison en cours.</p></div> :
                            <div className="space-y-4">{commandes.map(order => {
                                const [label, cls] = statusBadge(order.status);
                                return <div key={order._id} className="bg-white rounded-xl shadow-sm border border-blush-300 p-4">
                                    <div className="flex justify-between"><div><p className="font-medium">Commande #{order._id.slice(-8)}</p><p className="text-xs text-gray-500"><Calendar size={12} className="inline"/> {new Date(order.createdAt).toLocaleDateString('fr-FR')}</p></div><span className={`text-xs px-2 py-1 rounded-full ${cls}`}>{label}</span></div>
                                    <div className="mt-2 text-sm text-gray-600"><div><User size={14} className="inline"/> {order.address?.name || 'Client'} · <Phone size={14} className="inline"/> {order.address?.phone || 'N/A'}</div><div><MapPin size={14} className="inline"/> {order.address?.street || ''}</div></div>
                                    <div className="mt-3 flex justify-end gap-2">
                                        <button onClick={() => navigate(`/livreur/commande/${order._id}`)} className="text-sm text-gray-500 flex items-center gap-1"><Eye size={14}/> Détails</button>
                                        {order.status === 'Shipped' && <button onClick={() => axios.patch('/api/order/livreur/statut',{orderId:order._id,status:'Out for Delivery'}).then(refresh).catch(e=>toast.error(e.response?.data?.message||e.message))} className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg"><Truck size={14} className="inline"/> En livraison</button>}
                                        {order.status === 'Out for Delivery' && <button onClick={() => axios.patch('/api/order/livreur/statut',{orderId:order._id,status:'Delivered'}).then(refresh).catch(e=>toast.error(e.response?.data?.message||e.message))} className="text-sm bg-burgundy-600 text-white px-3 py-1.5 rounded-lg"><CheckCircle size={14} className="inline"/> Livré</button>}
                                    </div>
                                </div>
                            })}</div>}
                    </>
                )}

                <h2 className="font-semibold text-gray-800 mt-8 mb-3">Historique</h2>
                <div className="bg-white rounded-xl border border-blush-300 p-4">
                    {historique.slice(0,10).map(order => <div key={order._id} className="flex justify-between py-2 border-b last:border-0">
                        <span>#{order._id.slice(-8)}</span><span className="text-xs text-gray-500">{statusBadge(order.status)[0]}</span>
                    </div>)}
                    {!historique.length && <p className="text-sm text-gray-500">Aucun historique.</p>}
                </div>
            </div>
        </div>
    );
};
export default MesLivraisons;
