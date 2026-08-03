import React, { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Package, Wallet, TrendingUp, TrendingDown, Minus, ShoppingBag, Clock,
    Loader2, PlusCircle, Store, Banknote, Tag, Trophy, ChevronRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import clsx from 'clsx';

const PERIOD_OPTIONS = [
    { label: '7 derniers jours', short: '7 jours', days: 7 },
    { label: '14 derniers jours', short: '14 jours', days: 14 },
    { label: '30 derniers jours', short: '30 jours', days: 30 },
];

const STATUS_STYLES = {
    Delivered: { label: 'Livrée', className: 'bg-green-100 text-green-700' },
    Cancelled: { label: 'Annulée', className: 'bg-red-100 text-red-700' },
    Returned: { label: 'Retournée', className: 'bg-red-100 text-red-700' },
};
const statusStyle = (status) =>
    STATUS_STYLES[status] || { label: status === 'Pending' ? 'En attente' : status || 'En cours', className: 'bg-amber-100 text-amber-700' };

const cardMotion = {
    hidden: { opacity: 0, y: 10 },
    show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.35, ease: 'easeOut' } }),
};

const Trend = ({ value, label = 'vs mois dernier' }) => {
    if (value === null || value === undefined) return null;
    const isFlat = value === 0;
    const isUp = value > 0;
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1 text-[11px] font-medium mt-1.5',
                isFlat ? 'text-gray-400' : isUp ? 'text-emerald-600' : 'text-red-500'
            )}
        >
            {isFlat ? <Minus size={12} /> : isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isFlat ? '0%' : `${isUp ? '+' : ''}${value}%`} {label}
        </span>
    );
};

const Dashboard = () => {
    const { axios } = useAppContext();
    const { moi, boutique } = useOutletContext();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalVentes: 0,
        totalCommandes: 0,
        commandesEnCours: 0,
        soldeWallet: 0,
        nombreProduits: 0,
        produitsBasStock: 0,
    });
    const [dernieresVentes, setDernieresVentes] = useState([]);
    const [ventes, setVentes] = useState([]);
    const [periodDays, setPeriodDays] = useState(7);

    useEffect(() => {
        if (!boutique) return;

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

    // Revenu des N derniers jours (commandes non annulées/retournées de sa boutique)
    const revenueChartData = useMemo(() => {
        const days = [];
        for (let i = periodDays - 1; i >= 0; i--) {
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
            label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
            ca: totalsByDay[jsToDayKey(d)] || 0,
        }));
    }, [ventes, periodDays]);

    const periodTotals = useMemo(() => {
        const total = revenueChartData.reduce((sum, d) => sum + d.ca, 0);
        const moyenne = revenueChartData.length ? Math.round(total / revenueChartData.length) : 0;
        return { total, moyenne };
    }, [revenueChartData]);

    // Tendances mois en cours vs mois dernier (CA + nombre de commandes)
    const trends = useMemo(() => {
        const now = new Date();
        const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        let caCur = 0, caPrev = 0, cmdCur = 0, cmdPrev = 0;
        ventes.forEach((o) => {
            const d = new Date(o.createdAt);
            const isCancelled = ['Cancelled', 'Returned'].includes(o.status);
            const montant = o.status === 'Delivered' ? (o.montantBoutique || 0) : 0;
            if (d >= startCurrentMonth) {
                caCur += montant;
                if (!isCancelled) cmdCur += 1;
            } else if (d >= startPrevMonth && d < startCurrentMonth) {
                caPrev += montant;
                if (!isCancelled) cmdPrev += 1;
            }
        });

        const pct = (cur, prev) => {
            if (prev === 0) return cur > 0 ? 100 : 0;
            return Math.round(((cur - prev) / prev) * 1000) / 10;
        };

        return { ca: pct(caCur, caPrev), commandes: pct(cmdCur, cmdPrev) };
    }, [ventes]);

    // Top 5 produits par quantité vendue (calculé à partir des ventes de la boutique)
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

    const statCards = [
        {
            title: 'Chiffre d\'affaires',
            sub: 'mois en cours',
            value: stats.totalVentes,
            suffix: ' FCFA',
            icon: TrendingUp,
            trend: trends.ca,
        },
        {
            title: 'Commandes',
            sub: 'mois en cours',
            value: stats.totalCommandes,
            icon: ShoppingBag,
            trend: trends.commandes,
        },
        {
            title: 'Produits',
            sub: 'actifs',
            value: stats.nombreProduits,
            icon: Package,
            trend: null,
        },
        {
            title: 'Solde portefeuille',
            value: stats.soldeWallet,
            suffix: ' FCFA',
            icon: Wallet,
            trend: null,
        },
        {
            title: 'En cours',
            sub: 'commandes à traiter',
            value: stats.commandesEnCours,
            icon: Clock,
            trend: null,
        },
        {
            title: 'Stock bas',
            sub: 'moins de 5 unités',
            value: stats.produitsBasStock,
            icon: Package,
            trend: null,
            alert: stats.produitsBasStock > 0,
        },
    ];

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-7">
                <h1 className="font-display text-2xl font-semibold text-gray-900">
                    Bienvenue, {moi?.nom?.split(' ')[0]} 👋
                </h1>
                <p className="text-sm text-gray-400 mt-1">Voici ce qui se passe dans votre boutique aujourd'hui.</p>
            </motion.div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 mb-8">
                {statCards.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <motion.div
                            key={s.title}
                            custom={i}
                            variants={cardMotion}
                            initial="hidden"
                            animate="show"
                            className={clsx(
                                'bg-white rounded-2xl p-5 border transition',
                                s.alert ? 'border-red-200 hover:border-red-300' : 'border-blush-200 hover:border-blush-400 hover:shadow-sm'
                            )}
                        >
                            <div className={clsx(
                                'w-11 h-11 rounded-2xl flex items-center justify-center mb-3',
                                s.alert ? 'text-red-600 bg-red-50' : 'text-burgundy-700 bg-burgundy-50'
                            )}>
                                <Icon size={19} />
                            </div>
                            <p className="text-[13px] text-gray-500 font-medium leading-tight">{s.title}</p>
                            {s.sub && <p className="text-[11px] text-gray-400 leading-tight">{s.sub}</p>}
                            <p className="text-2xl font-bold text-gray-900 mt-1.5 truncate">
                                <CountUp end={s.value} duration={1} separator=" " />
                                {s.suffix || ''}
                            </p>
                            <Trend value={s.trend} />
                        </motion.div>
                    );
                })}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                <Link to="/commercant/produits/ajouter" className="bg-burgundy-600 text-white rounded-2xl p-4 text-center hover:bg-burgundy-700 transition">
                    <PlusCircle className="mx-auto mb-1.5" size={22} />
                    <p className="text-sm font-medium">Ajouter un produit</p>
                </Link>
                <Link to="/commercant/commandes" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                    <ShoppingBag className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                    <p className="text-sm font-medium text-gray-700">Voir les commandes</p>
                </Link>
                <Link to="/commercant/codes-promo" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                    <Tag className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                    <p className="text-sm font-medium text-gray-700">Codes promo</p>
                </Link>
                <Link to="/commercant/retraits" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                    <Banknote className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                    <p className="text-sm font-medium text-gray-700">Demander un retrait</p>
                </Link>
                <Link to="/commercant/portefeuille" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                    <Wallet className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                    <p className="text-sm font-medium text-gray-700">Voir le portefeuille</p>
                </Link>
            </div>

            <div className="grid lg:grid-cols-3 gap-5 mb-8">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-blush-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-900">Aperçu des ventes</h2>
                        <select
                            value={periodDays}
                            onChange={(e) => setPeriodDays(Number(e.target.value))}
                            className="text-xs border border-blush-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:border-burgundy-400 bg-white"
                        >
                            {PERIOD_OPTIONS.map((opt) => (
                                <option key={opt.days} value={opt.days}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#9f1239" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#9f1239" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3e8e8" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} FCFA`, 'CA']} />
                                <Area type="monotone" dataKey="ca" stroke="#9f1239" strokeWidth={2} fill="url(#caGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-blush-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-gray-400">Total ventes · {PERIOD_OPTIONS.find((p) => p.days === periodDays)?.short}</p>
                            <p className="text-base font-bold text-gray-900 mt-0.5">{periodTotals.total.toLocaleString()} FCFA</p>
                        </div>
                        <div className="bg-blush-50 rounded-xl p-3.5">
                            <p className="text-[11px] text-gray-400">Moyenne quotidienne</p>
                            <p className="text-base font-bold text-gray-900 mt-0.5">{periodTotals.moyenne.toLocaleString()} FCFA</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-blush-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Trophy size={16} className="text-amber-500" /> Produits les plus vendus
                        </h2>
                        <Link to="/commercant/produits" className="text-xs font-medium text-burgundy-600 hover:text-burgundy-700">
                            Voir tout
                        </Link>
                    </div>
                    {topProduits.length === 0 ? (
                        <p className="text-sm text-gray-400 py-6 text-center">Pas encore de ventes</p>
                    ) : (
                        <div className="space-y-3">
                            {topProduits.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <span className="w-5 text-xs font-bold text-gray-400">{idx + 1}</span>
                                    <div className="w-9 h-9 rounded-lg bg-blush-100 overflow-hidden shrink-0">
                                        {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : null}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-gray-800 truncate">{p.name}</p>
                                        <p className="text-xs text-gray-400">{p.quantite} vendu(s)</p>
                                    </div>
                                    <span className="text-xs font-semibold text-burgundy-700 bg-burgundy-50 px-2 py-1 rounded-full shrink-0">
                                        {p.quantite}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-blush-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-blush-100 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900">Ventes récentes</h2>
                    <Link to="/commercant/commandes" className="text-xs font-medium text-burgundy-600 hover:text-burgundy-700">
                        Voir toutes les commandes
                    </Link>
                </div>

                {dernieresVentes.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-400">Aucune vente pour l'instant.</div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-blush-100">
                                        <th className="px-6 py-3 font-medium">Commande</th>
                                        {dernieresVentes.some((o) => o.user?.nom) && <th className="px-3 py-3 font-medium">Client</th>}
                                        <th className="px-3 py-3 font-medium">Produits</th>
                                        <th className="px-3 py-3 font-medium">Montant</th>
                                        <th className="px-3 py-3 font-medium">Statut</th>
                                        <th className="px-3 py-3 font-medium">Date</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-blush-100">
                                    {dernieresVentes.map((order) => {
                                        const st = statusStyle(order.status);
                                        return (
                                            <tr key={order._id} className="hover:bg-blush-50/60 transition">
                                                <td className="px-6 py-3.5 font-medium text-gray-800">#{order._id.slice(-8)}</td>
                                                {dernieresVentes.some((o) => o.user?.nom) && (
                                                    <td className="px-3 py-3.5 text-gray-600">{order.user?.nom || '—'}</td>
                                                )}
                                                <td className="px-3 py-3.5 text-gray-500 max-w-[220px] truncate">
                                                    {order.items.length} article(s) de votre boutique
                                                </td>
                                                <td className="px-3 py-3.5 font-semibold text-gray-800">{order.montantBoutique.toLocaleString()} FCFA</td>
                                                <td className="px-3 py-3.5">
                                                    <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', st.className)}>{st.label}</span>
                                                </td>
                                                <td className="px-3 py-3.5 text-gray-500 whitespace-nowrap">
                                                    {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                                                </td>
                                                <td className="px-6 py-3.5 text-right">
                                                    <ChevronRight size={16} className="text-gray-300 inline-block" />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile list */}
                        <div className="md:hidden divide-y divide-blush-100">
                            {dernieresVentes.map((order) => {
                                const st = statusStyle(order.status);
                                return (
                                    <div key={order._id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800">#{order._id.slice(-8)}</p>
                                            <p className="text-xs text-gray-400 truncate">
                                                {order.user?.nom ? `${order.user.nom} · ` : ''}
                                                {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-gray-800">{order.montantBoutique.toLocaleString()} FCFA</p>
                                                <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-medium', st.className)}>{st.label}</span>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-300" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Dashboard;