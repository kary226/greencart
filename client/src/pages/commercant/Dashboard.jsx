import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Package, Wallet, TrendingUp,
    ShoppingBag, Clock, Loader2, PlusCircle, Store, Banknote
} from 'lucide-react';

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
                const ventes = ventesRes.data.orders || [];
                const totalCommandes = ventes.length;
                const commandesEnCours = ventes.filter(
                    (o) => !['Delivered', 'Cancelled', 'Returned'].includes(o.status)
                ).length;
                const totalVentes = ventes
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
                setDernieresVentes(ventes.slice(0, 6));
            } catch (error) {
                toast.error(error.response?.data?.message || error.message);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [axios, boutique]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-burgundy-600" size={32} />
            </div>
        );
    }

    const statCards = [
        { title: "Chiffre d'affaires", value: `${stats.totalVentes.toLocaleString()} FCFA`, icon: TrendingUp, accent: 'text-emerald-600 bg-emerald-50' },
        { title: 'Commandes', value: stats.totalCommandes, icon: ShoppingBag, accent: 'text-blue-600 bg-blue-50' },
        { title: 'En cours', value: stats.commandesEnCours, icon: Clock, accent: 'text-amber-600 bg-amber-50' },
        { title: 'Portefeuille', value: `${stats.soldeWallet.toLocaleString()} FCFA`, icon: Wallet, accent: 'text-burgundy-700 bg-burgundy-50' },
        { title: 'Produits', value: stats.nombreProduits, icon: Package, accent: 'text-indigo-600 bg-indigo-50' },
        { title: 'Stock bas (<5)', value: stats.produitsBasStock, icon: Package, accent: 'text-red-600 bg-red-50' },
    ];

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-7">
                <p className="text-sm text-gray-400">Bonjour {moi?.nom?.split(' ')[0]}</p>
                <h1 className="font-display text-2xl font-semibold text-gray-900">Vue d'ensemble</h1>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                {statCards.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.title} className="bg-white rounded-2xl p-4 border border-blush-200 hover:border-blush-400 hover:shadow-sm transition">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.accent}`}>
                                <Icon size={17} />
                            </div>
                            <p className="text-[11px] text-gray-400 leading-tight">{s.title}</p>
                            <p className="text-[15px] font-bold text-gray-900 mt-0.5 truncate">{s.value}</p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <Link to="/commercant/produits/ajouter" className="bg-burgundy-600 text-white rounded-2xl p-4 text-center hover:bg-burgundy-700 transition">
                    <PlusCircle className="mx-auto mb-1.5" size={22} />
                    <p className="text-sm font-medium">Ajouter un produit</p>
                </Link>
                <Link to="/commercant/boutique" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                    <Store className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                    <p className="text-sm font-medium text-gray-700">Ma boutique</p>
                </Link>
                <Link to="/commercant/portefeuille" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                    <Wallet className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                    <p className="text-sm font-medium text-gray-700">Portefeuille</p>
                </Link>
                <Link to="/commercant/retraits" className="bg-white border border-blush-200 rounded-2xl p-4 text-center hover:border-burgundy-300 hover:shadow-sm transition">
                    <Banknote className="mx-auto text-burgundy-600 mb-1.5" size={22} />
                    <p className="text-sm font-medium text-gray-700">Demander un retrait</p>
                </Link>
            </div>

            <div className="bg-white rounded-2xl border border-blush-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-blush-100">
                    <h2 className="font-semibold text-gray-900">Ventes récentes</h2>
                </div>
                {dernieresVentes.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-400">Aucune vente pour l'instant.</div>
                ) : (
                    <div className="divide-y divide-blush-100">
                        {dernieresVentes.map((order) => (
                            <div key={order._id} className="px-6 py-3.5 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-800">Commande #{order._id.slice(-8)}</p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(order.createdAt).toLocaleDateString('fr-FR')} · {order.items.length} article(s) de votre boutique
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-semibold text-gray-800">{order.montantBoutique.toLocaleString()} FCFA</span>
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                        order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                        (order.status === 'Cancelled' || order.status === 'Returned') ? 'bg-red-100 text-red-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>{order.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;