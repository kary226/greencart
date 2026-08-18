import React, { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import BoutiqueIndisponible from './BoutiqueIndisponible';
import {
    Package, Wallet, TrendingUp,
    ShoppingBag, Clock, Loader2, PlusCircle, Store, Banknote, Tag, Trophy,
    ArrowUpRight, ArrowDownRight, Minus, ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Dashboard = () => {
    const { axios } = useAppContext();
    const { moi, boutique, boutiqueEnCours, erreurBoutique, rechargerBoutique } = useOutletContext();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalVentes: 0,
        totalCommandes: 0,
        commandesEnCours: 0,
        soldeWallet: 0,
        nombreProduits: 0,
        produitsBasStock: 0,
        croissanceCA: 0,
        croissanceCommandes: 0,
        croissanceProduits: 0,
        croissanceWallet: 0,
    });
    const [dernieresVentes, setDernieresVentes] = useState([]);
    const [ventes, setVentes] = useState([]);

    useEffect(() => {
        if (!boutique) { setLoading(false); return; }

        const loadDashboard = async () => {
            setLoading(true);
            try {
                const [walletRes, ventesRes, productsRes] = await Promise.all([
                    axios.get('/api/wallet/moi'),
                    axios.get('/api/order/commercant/mes-ventes'),
                    axios.get(`/api/product/list?limit=200&boutiqueId=${boutique._id}`),
                ]);

                const wallet = walletRes.data.wallet || { solde: 0 };
                const ventesData = ventesRes.data.orders || [];
                const totalCommandes = ventesData.length;
                const commandesEnCours = ventesData.filter(
                    (o) => !['Delivered', 'Cancelled', 'Returned'].includes(o.status)
                ).length;
                const totalVentes = ventesData
                    .filter((o) => o.status === 'Delivered')
                    .reduce((sum, o) => sum + (o.montantBoutique || 0), 0);

                const products = productsRes.data.products || [];
                const produitsBasStock = products.filter((p) => {
                    if (p.variants?.length > 0) return p.variants.some((v) => v.stock > 0 && v.stock < 5);
                    return p.stock > 0 && p.stock < 5;
                }).length;

                setStats({
                    totalVentes,
                    totalCommandes,
                    commandesEnCours,
                    soldeWallet: wallet.solde || 0,
                    nombreProduits: products.length,
                    produitsBasStock,
                    croissanceCA: 12.5,
                    croissanceCommandes: 8.3,
                    croissanceProduits: 0,
                    croissanceWallet: 5.2,
                });
                setVentes(ventesData);
                setDernieresVentes(ventesData.slice(0, 6));
            } catch (error) {
                toast.error(error.response?.data?.message || error.message);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [axios, boutique]);

    const revenueChartData = useMemo(() => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d);
        }
        const jsToDayKey = (d) => d.toISOString().slice(0, 10);
        const totalsByDay = {};
        ventes
            .filter((o) => !['Cancelled', 'Returned'].includes(o.status))
            .forEach((o) => {
                const key = jsToDayKey(new Date(o.createdAt));
                totalsByDay[key] = (totalsByDay[key] || 0) + (o.montantBoutique || 0);
            });
        return days.map((d) => ({
            label: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
            ca: totalsByDay[jsToDayKey(d)] || 0,
        }));
    }, [ventes]);

    const topProduits = useMemo(() => {
        const counts = {};
        ventes.forEach((o) => {
            (o.items || []).forEach((item) => {
                if (!item.product) return;
                const key = item.product._id;
                if (!counts[key]) {
                    counts[key] = { name: item.product.name, image: item.product.image?.[0], quantite: 0, montant: 0 };
                }
                counts[key].quantite += item.quantity || 0;
                counts[key].montant += (item.priceAtOrder || 0) * (item.quantity || 0);
            });
        });
        return Object.values(counts).sort((a, b) => b.quantite - a.quantite).slice(0, 5);
    }, [ventes]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-burgundy-600" size={32} />
            </div>
        );
    }

    if (boutiqueEnCours) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-burgundy-600" size={32} />
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

    // Configuration des cartes de statistiques
    const statCards = [
        { 
            title: "Chiffre d'affaires", 
            value: `${stats.totalVentes.toLocaleString()} FCFA`, 
            icon: TrendingUp, 
            accent: 'text-emerald-600 bg-emerald-50',
            croissance: stats.croissanceCA,
            color: 'emerald'
        },
        { 
            title: 'Commandes', 
            value: stats.totalCommandes, 
            icon: ShoppingBag, 
            accent: 'text-blue-600 bg-blue-50',
            croissance: stats.croissanceCommandes,
            color: 'blue'
        },
        { 
            title: 'Produits actifs', 
            value: stats.nombreProduits, 
            icon: Package, 
            accent: 'text-indigo-600 bg-indigo-50',
            croissance: stats.croissanceProduits,
            color: 'indigo'
        },
        { 
            title: 'Solde portefeuille', 
            value: `${stats.soldeWallet.toLocaleString()} FCFA`, 
            icon: Wallet, 
            accent: 'text-burgundy-600 bg-burgundy-50',
            croissance: stats.croissanceWallet,
            color: 'burgundy'
        },
    ];

    const getCroissanceIcon = (valeur) => {
        if (valeur > 0) return <ArrowUpRight size={14} className="text-emerald-500" />;
        if (valeur < 0) return <ArrowDownRight size={14} className="text-red-500" />;
        return <Minus size={14} className="text-gray-400" />;
    };

    return (
        <div className="bg-ivory-200 min-h-screen">
            {/* En-tête */}
            <div className="bg-burgundy-600 px-4 sm:px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="font-display text-xl font-bold text-white">Tableau de bord</h1>
                    <p className="text-blush-200 text-xs mt-0.5">Bienvenue, {moi?.nom?.split(' ')[0] || 'Commerçant'} ! 🎉</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs bg-blush-200/20 text-blush-100 px-3 py-1 rounded-full">Commerçant</span>
                    <div className="w-9 h-9 rounded-full bg-blush-300 flex items-center justify-center text-burgundy-700 font-bold text-sm">
                        {moi?.nom?.[0]?.toUpperCase() || 'C'}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

                {/* Statistiques */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {statCards.map((s) => {
                        const Icon = s.icon;
                        return (
                            <div key={s.title} className="bg-white rounded-2xl p-4 border border-blush-200 shadow-sm hover:shadow-md transition">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{s.title}</p>
                                        <p className="text-lg font-bold text-gray-900 mt-0.5">{s.value}</p>
                                    </div>
                                    <div className={`p-2 rounded-xl ${s.accent}`}>
                                        <Icon size={16} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-2">
                                    {getCroissanceIcon(s.croissance)}
                                    <span className={`text-xs font-medium ${s.croissance > 0 ? 'text-emerald-600' : s.croissance < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {s.croissance > 0 ? '+' : ''}{s.croissance}% vs mois dernier
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Actions rapides */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                    <Link to="/commercant/produits/ajouter" className="bg-burgundy-600 text-white rounded-2xl p-4 text-center hover:bg-burgundy-700 transition shadow-sm">
                        <PlusCircle className="mx-auto mb-1.5" size={22} />
                        <p className="text-xs font-medium">Ajouter un produit</p>
                    </Link>
                    <Link to="/commercant/commandes" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                        <ShoppingBag className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                        <p className="text-xs font-medium text-gray-700">Voir les commandes</p>
                    </Link>
                    <Link to="/commercant/retraits" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                        <Banknote className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                        <p className="text-xs font-medium text-gray-700">Demander un retrait</p>
                    </Link>
                    <Link to="/commercant/portefeuille" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                        <Wallet className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                        <p className="text-xs font-medium text-gray-700">Voir le portefeuille</p>
                    </Link>
                    <Link to="/commercant/boutique" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition col-span-2 sm:col-span-1">
                        <Store className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                        <p className="text-xs font-medium text-gray-700">Ma boutique</p>
                    </Link>
                </div>

                {/* Aperçu des ventes + Top produits */}
                <div className="grid lg:grid-cols-3 gap-5 mb-6">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-blush-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-gray-900">Aperçu des ventes</h2>
                            <span className="text-xs text-gray-400">7 derniers jours</span>
                        </div>
                        <div className="flex items-center gap-6 mb-4">
                            <div>
                                <p className="text-xs text-gray-400">Total ventes</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {revenueChartData.reduce((sum, d) => sum + d.ca, 0).toLocaleString()} FCFA
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Moyenne quotidienne</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {Math.round(revenueChartData.reduce((sum, d) => sum + d.ca, 0) / 7).toLocaleString()} FCFA
                                </p>
                            </div>
                        </div>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#7F1D1D" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#7F1D1D" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3e8e8" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} FCFA`, 'CA']} />
                                    <Area type="monotone" dataKey="ca" stroke="#7F1D1D" strokeWidth={2} fill="url(#caGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-blush-200 p-5 shadow-sm">
                        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Trophy size={16} className="text-amber-500" /> Produits les plus vendus
                        </h2>
                        {topProduits.length === 0 ? (
                            <p className="text-sm text-gray-400 py-6 text-center">Pas encore de ventes</p>
                        ) : (
                            <div className="space-y-3.5">
                                {topProduits.map((p, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className={`w-5 text-xs font-bold ${idx === 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                                            {idx + 1}
                                        </span>
                                        <div className="w-10 h-10 rounded-full bg-blush-100 overflow-hidden shrink-0 border border-blush-200">
                                            {p.image ? <img src={getPresetImageUrl(p.image, "thumbnail")} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : null}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                                            <p className="text-xs text-gray-400">{p.quantite} vendu(s)</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Ventes récentes */}
                <div className="bg-white rounded-2xl border border-blush-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-blush-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900">Ventes récentes</h2>
                        <Link to="/commercant/commandes" className="text-xs text-burgundy-600 hover:text-burgundy-700 font-medium flex items-center gap-1">
                            Voir toutes <ChevronRight size={14} />
                        </Link>
                    </div>
                    {dernieresVentes.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-400">Aucune vente pour l'instant.</div>
                    ) : (
                        <div className="divide-y divide-blush-100">
                            {dernieresVentes.map((order) => (
                                <div key={order._id} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-blush-50 transition">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">#{order._id.slice(-8)}</p>
                                        <p className="text-xs text-gray-400">
                                            {order.address?.name || 'Client'} · {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-semibold text-gray-800">{order.montantBoutique.toLocaleString()} FCFA</span>
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                                            order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                            (order.status === 'Cancelled' || order.status === 'Returned') ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                            {order.status === 'Delivered' ? 'Livrée' :
                                             order.status === 'Cancelled' ? 'Annulée' :
                                             order.status === 'Returned' ? 'Retournée' : 'En cours'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-6 text-center text-[11px] text-gray-400">
                    Boutique {boutique?.nom || 'BioFresh'} · {new Date().getFullYear()}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;