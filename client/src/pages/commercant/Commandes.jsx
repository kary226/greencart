import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import BoutiqueIndisponible from './BoutiqueIndisponible';
import { Search, Loader2, ShoppingBag, ChevronDown, MapPin, Phone } from 'lucide-react';

// Mêmes libellés que OrderDetail.jsx (côté client) — une commande a un seul
// statut, il ne doit pas se lire différemment selon qui la consulte.
const STATUS_MAP = {
    'Order Placed': { text: 'En cours', badge: 'bg-ramses-50 text-ramses-700' },
    'Confirmed': { text: 'En cours', badge: 'bg-ramses-50 text-ramses-700' },
    'Shipped': { text: 'En cours', badge: 'bg-ramses-50 text-ramses-700' },
    'Out for Delivery': { text: 'En cours', badge: 'bg-ramses-50 text-ramses-700' },
    'Delivered': { text: 'Livrée', badge: 'bg-ok-50 text-ok-500' },
    'Returned': { text: 'Retournée', badge: 'bg-ink-100 text-ink-500' },
    'Cancelled': { text: 'Annulée', badge: 'bg-ink-100 text-ink-500' },
};
const statutAffichage = (s) => STATUS_MAP[s] || { text: s, badge: 'bg-ink-100 text-ink-500' };

const ONGLETS = [
    { key: 'toutes', label: 'Toutes' },
    { key: 'en_cours', label: 'En cours' },
    { key: 'livrees', label: 'Livrées' },
    { key: 'terminees', label: 'Annulées / retournées' },
];

const appartientOnglet = (statut, onglet) => {
    if (onglet === 'toutes') return true;
    if (onglet === 'livrees') return statut === 'Delivered';
    if (onglet === 'terminees') return statut === 'Cancelled' || statut === 'Returned';
    // 'en_cours' : tout le reste
    return !['Delivered', 'Cancelled', 'Returned'].includes(statut);
};

const CommandeCard = ({ order }) => {
    const [ouverte, setOuverte] = useState(false);
    const badge = statutAffichage(order.status);
    const client = order.address
        ? `${order.address.firstName || ''} ${order.address.lastName || ''}`.trim() || 'Client'
        : 'Client';
    const nombreArticles = (order.items || []).reduce((n, it) => n + (it.quantity || 0), 0);

    return (
        <div className="bg-white rounded-2xl border border-ink-200 overflow-hidden">
            <button
                type="button"
                onClick={() => setOuverte((o) => !o)}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-ink-50 transition"
                aria-expanded={ouverte}
            >
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">#{order._id.slice(-8)}</p>
                    <p className="text-xs text-ink-400 mt-0.5">
                        {client} · {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · {nombreArticles} article{nombreArticles > 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-ink-900">
                        {(order.montantBoutique || 0).toLocaleString()} FCFA
                    </span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${badge.badge}`}>
                        {badge.text}
                    </span>
                    <ChevronDown size={16} className={`text-ink-400 transition-transform shrink-0 ${ouverte ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {ouverte && (
                <div className="border-t border-ink-100 px-5 py-4 grid gap-4">
                    {order.address && (
                        <div className="grid sm:grid-cols-2 gap-3 text-[13px] text-ink-600">
                            <p className="flex items-center gap-2">
                                <MapPin size={14} className="text-ink-400 shrink-0" />
                                {[order.address.street, order.address.communeName, order.address.cityName]
                                    .filter(Boolean).join(', ') || '—'}
                            </p>
                            <p className="flex items-center gap-2">
                                <Phone size={14} className="text-ink-400 shrink-0" />
                                {order.address.phone || '—'}
                            </p>
                        </div>
                    )}

                    <ul className="grid gap-2.5">
                        {(order.items || []).map((item, idx) => (
                            <li key={idx} className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-ink-50 border border-ink-100 overflow-hidden shrink-0">
                                    {item.product?.image?.[0] && (
                                        <img
                                            src={getPresetImageUrl(item.product.image[0], 'thumbnail')}
                                            alt={item.product?.name || ''}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-ink-800 truncate">{item.product?.name || 'Produit supprimé'}</p>
                                    <p className="text-xs text-ink-400">
                                        {item.quantity} × {(item.priceAtOrder || 0).toLocaleString()} FCFA
                                        {(item.selectedColor || item.selectedSize) && (
                                            <> · {[item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')}</>
                                        )}
                                    </p>
                                </div>
                                <span className="text-sm font-semibold text-ink-800 shrink-0">
                                    {((item.priceAtOrder || 0) * (item.quantity || 0)).toLocaleString()} FCFA
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const Commandes = () => {
    const { axios } = useAppContext();
    const { boutique, boutiqueEnCours, erreurBoutique, rechargerBoutique } = useOutletContext();

    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [onglet, setOnglet] = useState('toutes');
    const [recherche, setRecherche] = useState('');
    const [nbAffiches, setNbAffiches] = useState(20);

    useEffect(() => {
        if (!boutique) { setLoading(false); return; }
        (async () => {
            setLoading(true);
            try {
                const { data } = await axios.get('/api/order/commercant/mes-ventes');
                if (data.success) {
                    setOrders(data.orders || []);
                } else {
                    toast.error(data.message);
                }
            } catch (error) {
                toast.error(error.response?.data?.message || error.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [axios, boutique]);

    const filtrees = useMemo(() => {
        const terme = recherche.trim().toLowerCase();
        return orders.filter((o) => {
            if (!appartientOnglet(o.status, onglet)) return false;
            if (!terme) return true;
            const client = `${o.address?.firstName || ''} ${o.address?.lastName || ''}`.toLowerCase();
            return o._id.toLowerCase().includes(terme) || client.includes(terme);
        });
    }, [orders, onglet, recherche]);

    const compteurs = useMemo(() => {
        const c = { toutes: orders.length, en_cours: 0, livrees: 0, terminees: 0 };
        orders.forEach((o) => {
            if (appartientOnglet(o.status, 'en_cours')) c.en_cours += 1;
            else if (o.status === 'Delivered') c.livrees += 1;
            else c.terminees += 1;
        });
        return c;
    }, [orders]);

    if (loading || boutiqueEnCours) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-ramses-600" size={32} />
            </div>
        );
    }

    if (!boutique) {
        return (
            <div className="py-16 px-4">
                <BoutiqueIndisponible erreur={erreurBoutique} onRetry={rechargerBoutique} />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <header className="mb-5">
                <h1 className="rs-h1">Commandes</h1>
                <p className="text-[13px] text-ink-400 mt-1">
                    Les commandes contenant au moins un article de votre boutique.
                </p>
            </header>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex gap-1.5 overflow-x-auto rs-scroll">
                    {ONGLETS.map((o) => (
                        <button
                            key={o.key}
                            onClick={() => setOnglet(o.key)}
                            className={`shrink-0 px-3.5 py-2 rounded-xl text-[13px] font-medium transition ${
                                onglet === o.key ? 'bg-ramses-600 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'
                            }`}
                        >
                            {o.label} <span className="opacity-70">({compteurs[o.key]})</span>
                        </button>
                    ))}
                </div>
                <div className="relative sm:ml-auto sm:w-64">
                    <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                    <input
                        type="text"
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        placeholder="N° commande, nom du client…"
                        className="rs-input rs-input--icon-l"
                    />
                </div>
            </div>

            {filtrees.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ink-200 p-12 text-center">
                    <ShoppingBag size={28} className="text-ink-300 mx-auto mb-2" />
                    <p className="text-sm text-ink-400">
                        {orders.length === 0 ? "Aucune commande pour l'instant." : 'Aucune commande ne correspond à ce filtre.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid gap-2.5">
                        {filtrees.slice(0, nbAffiches).map((order) => (
                            <CommandeCard key={order._id} order={order} />
                        ))}
                    </div>
                    {filtrees.length > nbAffiches && (
                        <button
                            onClick={() => setNbAffiches((n) => n + 20)}
                            className="rs-btn rs-btn--secondary w-full mt-4"
                        >
                            Afficher plus ({filtrees.length - nbAffiches} restantes)
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default Commandes;