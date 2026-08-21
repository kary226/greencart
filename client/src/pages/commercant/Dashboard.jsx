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

                const wallet = walletRes.data.wallet || { solde: 0, soldeEnAttente: 0 };
                const ventesData = ventesRes.data.orders || [];
                const totalCommandes = ventesData.length;

                // Les ventes exposent désormais un statut commerçant
                // (statut.cle) et non le statut logistique interne.
                const commandesEnCours = ventesData.filter(
                    (o) => ['a_confirmer', 'confirmee'].includes(o.statut?.cle)
                ).length;
                const aConfirmer = ventesData.filter((o) => o.statut?.cle === 'a_confirmer').length;

                // Chiffre d'affaires = ce qui a été validé, donc réellement acquis.
                const totalVentes = ventesData
                    .filter((o) => o.fondsLiberes)
                    .reduce((sum, o) => sum + (o.montantBoutique || 0), 0);

                // Croissance RÉELLE : mois en cours comparé au mois précédent.
                // Les valeurs affichées ici étaient auparavant codées en dur
                // (+12,5 %, +8,3 %…) — des chiffres inventés présentés comme
                // des mesures, ce qui est pire que pas de chiffre du tout.
                const maintenant = new Date();
                const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
                const debutMoisPrecedent = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);

                const dansPeriode = (o, debut, fin) => {
                    const d = new Date(o.dateCommande);
                    return d >= debut && (!fin || d < fin);
                };
                const sommeSur = (debut, fin) => ventesData
                    .filter((o) => dansPeriode(o, debut, fin))
                    .reduce((sum, o) => sum + (o.montantBoutique || 0), 0);
                const compteSur = (debut, fin) => ventesData.filter((o) => dansPeriode(o, debut, fin)).length;

                // Pas de croissance calculable sans mois précédent : on
                // renvoie null, et l'affichage n'écrit rien plutôt qu'un 0 %
                // trompeur.
                const evolution = (actuel, precedent) => {
                    if (!precedent) return null;
                    return Math.round(((actuel - precedent) / precedent) * 1000) / 10;
                };

                const caMois = sommeSur(debutMois, null);
                const caMoisPrecedent = sommeSur(debutMoisPrecedent, debutMois);
                const cmdMois = compteSur(debutMois, null);
                const cmdMoisPrecedent = compteSur(debutMoisPrecedent, debutMois);

                const products = productsRes.data.products || [];
                const produitsBasStock = products.filter((p) => {
                    if (p.variants?.length > 0) return p.variants.some((v) => v.stock > 0 && v.stock < 5);
                    return p.stock > 0 && p.stock < 5;
                }).length;

                setStats({
                    totalVentes,
                    totalCommandes,
                    commandesEnCours,
                    aConfirmer,
                    soldeWallet: wallet.solde || 0,
                    soldeEnAttente: wallet.soldeEnAttente || 0,
                    nombreProduits: products.length,
                    produitsBasStock,
                    croissanceCA: evolution(caMois, caMoisPrecedent),
                    croissanceCommandes: evolution(cmdMois, cmdMoisPrecedent),
                    croissanceProduits: null,
                    croissanceWallet: null,
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
            .filter((o) => !['annulee', 'retournee'].includes(o.statut?.cle))
            .forEach((o) => {
                const key = jsToDayKey(new Date(o.dateCommande));
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
                <Loader2 className="animate-spin text-ramses-600" size={32} />
            </div>
        );
    }

    if (boutiqueEnCours) {
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

    // Configuration des cartes de statistiques
    const statCards = [
        { 
            title: "Chiffre d'affaires", 
            value: `${stats.totalVentes.toLocaleString()} FCFA`, 
            icon: TrendingUp, 
            accent: 'text-ramses-600 bg-ramses-50',
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
            accent: 'text-ramses-600 bg-ramses-50',
            croissance: stats.croissanceWallet,
            color: 'burgundy'
        },
    ];

    const getCroissanceIcon = (valeur) => {
        if (valeur > 0) return <ArrowUpRight size={14} className="text-ramses-600" />;
        if (valeur < 0) return <ArrowDownRight size={14} className="text-ramses-600" />;
        return <Minus size={14} className="text-ink-400" />;
    };

    return (
        <div className="bg-ink-50 min-h-screen">
            {/* En-tête */}
            <div className="bg-ramses-600 px-4 sm:px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="font-display text-xl font-bold text-white">Tableau de bord</h1>
                    <p className="text-ink-200 text-xs mt-0.5">Bienvenue, {moi?.nom?.split(' ')[0] || 'Commerçant'} ! 🎉</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs bg-ink-200/20 text-ink-50 px-3 py-1 rounded-full">Commerçant</span>
                    <div className="w-9 h-9 rounded-full bg-ink-200 flex items-center justify-center text-ramses-700 font-bold text-sm">
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
                            <div key={s.title} className="bg-white rounded-2xl p-4 border border-ink-200 shadow-sm hover:shadow-md transition">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] text-ink-400 uppercase tracking-wider">{s.title}</p>
                                        <p className="text-lg font-bold text-ink-900 mt-0.5">{s.value}</p>
                                    </div>
                                    <div className={`p-2 rounded-xl ${s.accent}`}>
                                        <Icon size={16} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-2">
                                    {s.croissance !== null && s.croissance !== undefined && getCroissanceIcon(s.croissance)}
                                    <span className={`text-xs font-medium ${s.croissance > 0 ? 'text-ok-500' : s.croissance < 0 ? 'text-ramses-600' : 'text-ink-400'}`}>
                                        {s.croissance === null || s.croissance === undefined
                                            ? ''
                                            : `${s.croissance > 0 ? '+' : ''}${s.croissance}% vs mois dernier`}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Actions rapides */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                    <Link to="/commercant/produits/ajouter" className="bg-ramses-600 text-white rounded-2xl p-4 text-center hover:bg-ramses-700 transition shadow-sm">
                        <PlusCircle className="mx-auto mb-1.5" size={22} />
                        <p className="text-xs font-medium">Ajouter un produit</p>
                    </Link>
                    <Link to="/commercant/commandes" className="bg-white border border-ink-200 rounded-2xl p-4 text-center hover:border-ramses-300 hover:shadow-sm transition">
                        <ShoppingBag className="mx-auto text-ramses-600 mb-1.5" size={22} />
                        <p className="text-xs font-medium text-ink-700">Voir les commandes</p>
                    </Link>
                    <Link to="/commercant/retraits" className="bg-white border border-ink-200 rounded-2xl p-4 text-center hover:border-ramses-300 hover:shadow-sm transition">
                        <Banknote className="mx-auto text-ramses-600 mb-1.5" size={22} />
                        <p className="text-xs font-medium text-ink-700">Demander un retrait</p>
                    </Link>
                    <Link to="/commercant/portefeuille" className="bg-white border border-ink-200 rounded-2xl p-4 text-center hover:border-ramses-300 hover:shadow-sm transition">
                        <Wallet className="mx-auto text-ramses-600 mb-1.5" size={22} />
                        <p className="text-xs font-medium text-ink-700">Voir le portefeuille</p>
                    </Link>
                    <Link to="/commercant/boutique" className="bg-white border border-ink-200 rounded-2xl p-4 text-center hover:border-ramses-300 hover:shadow-sm transition col-span-2 sm:col-span-1">
                        <Store className="mx-auto text-ramses-600 mb-1.5" size={22} />
                        <p className="text-xs font-medium text-ink-700">Ma boutique</p>
                    </Link>
                </div>

                {/* Aperçu des ventes + Top produits */}
                <div className="grid lg:grid-cols-3 gap-5 mb-6">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-ink-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-ink-900">Aperçu des ventes</h2>
                            <span className="text-xs text-ink-400">7 derniers jours</span>
                        </div>
                        <div className="flex items-center gap-6 mb-4">
                            <div>
                                <p className="text-xs text-ink-400">Total ventes</p>
                                <p className="text-xl font-bold text-ink-900">
                                    {revenueChartData.reduce((sum, d) => sum + d.ca, 0).toLocaleString()} FCFA
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-ink-400">Moyenne quotidienne</p>
                                <p className="text-xl font-bold text-ink-900">
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

                    <div className="bg-white rounded-2xl border border-ink-200 p-5 shadow-sm">
                        <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
                            <Trophy size={16} className="text-amber-500" /> Produits les plus vendus
                        </h2>
                        {topProduits.length === 0 ? (
                            <p className="text-sm text-ink-400 py-6 text-center">Pas encore de ventes</p>
                        ) : (
                            <div className="space-y-3.5">
                                {topProduits.map((p, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className={`w-5 text-xs font-bold ${idx === 0 ? 'text-amber-500' : 'text-ink-400'}`}>
                                            {idx + 1}
                                        </span>
                                        <div className="w-10 h-10 rounded-full bg-ink-50 overflow-hidden shrink-0 border border-ink-200">
                                            {p.image ? <img src={getPresetImageUrl(p.image, "thumbnail")} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : null}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-ink-800 truncate">{p.name}</p>
                                            <p className="text-xs text-ink-400">{p.quantite} vendu(s)</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Ventes récentes */}
                <div className="bg-white rounded-2xl border border-ink-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-ink-50 flex items-center justify-between">
                        <h2 className="font-semibold text-ink-900">Ventes récentes</h2>
                        <Link to="/commercant/commandes" className="text-xs text-ramses-600 hover:text-ramses-700 font-medium flex items-center gap-1">
                            Voir toutes <ChevronRight size={14} />
                        </Link>
                    </div>
                    {dernieresVentes.length === 0 ? (
                        <div className="p-10 text-center text-sm text-ink-400">Aucune vente pour l'instant.</div>
                    ) : (
                        <div className="divide-y divide-ink-50">
                            {dernieresVentes.map((order) => (
                                <div key={order._id} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-ink-50 transition">
                                    <div>
                                        {/* Référence de la commande, jamais l'identité du
                                            client : le commerçant prépare un colis, il n'a
                                            pas à savoir qui l'a acheté. */}
                                        <p className="text-sm font-medium text-ink-800">#{order.reference}</p>
                                        <p className="text-xs text-ink-400">
                                            {order.nombreArticles} article{order.nombreArticles > 1 ? 's' : ''}
                                            {' · '}
                                            {new Date(order.dateCommande).toLocaleDateString('fr-FR')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-semibold text-ink-800">
                                            {(order.montantBoutique || 0).toLocaleString('fr-FR')} FCFA
                                        </span>
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                                            order.statut?.ton === 'succes' ? 'bg-ok-50 text-ok-500'
                                                : order.statut?.ton === 'action' ? 'bg-ramses-100 text-ramses-700'
                                                : order.statut?.ton === 'attente' ? 'bg-warn-50 text-warn-500'
                                                : 'bg-ink-100 text-ink-500'
                                        }`}>
                                            {order.statut?.libelle || '—'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-6 text-center text-[11px] text-ink-400">
                    Boutique {boutique?.nom || 'BioFresh'} · {new Date().getFullYear()}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;