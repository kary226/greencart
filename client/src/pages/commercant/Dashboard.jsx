import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    LayoutDashboard, Package, Wallet, TrendingUp,
    ShoppingBag, DollarSign, Clock, CheckCircle,
    XCircle, Loader2, PlusCircle
} from 'lucide-react';

const Dashboard = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalVentes: 0,
        totalCommandes: 0,
        commandesEnCours: 0,
        soldeWallet: 0,
        produitsEnStock: 0,
        produitsBasStock: 0,
    });
    const [dernieresCommandes, setDernieresCommandes] = useState([]);
    const [moi, setMoi] = useState(null);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const { data: authData } = await axios.get('/api/staff/is-auth');
                if (!authData.success || authData.staffUser?.role !== 'commercant') {
                    navigate('/staff/login');
                    return;
                }
                setMoi(authData.staffUser);

                const [walletRes, ordersRes, productsRes] = await Promise.all([
                    axios.get('/api/wallet/moi'),
                    axios.get('/api/order/seller'),
                    axios.get('/api/product/list?limit=100'),
                ]);

                const wallet = walletRes.data.wallet || { solde: 0 };
                const orders = ordersRes.data.orders || [];
                const totalCommandes = orders.length;
                const commandesEnCours = orders.filter(
                    o => !['Delivered', 'Cancelled', 'Returned'].includes(o.status)
                ).length;
                const totalVentes = orders
                    .filter(o => o.status === 'Delivered')
                    .reduce((sum, o) => sum + o.amount, 0);

                const products = productsRes.data.products || [];
                const produitsEnStock = products.filter(p => p.inStock).length;
                const produitsBasStock = products.filter(p => {
                    if (p.variants && p.variants.length > 0) {
                        return p.variants.some(v => v.stock > 0 && v.stock < 5);
                    }
                    return p.stock > 0 && p.stock < 5;
                }).length;

                setStats({
                    totalVentes,
                    totalCommandes,
                    commandesEnCours,
                    soldeWallet: wallet.solde || 0,
                    produitsEnStock,
                    produitsBasStock,
                });

                setDernieresCommandes(orders.slice(0, 5));

            } catch (error) {
                toast.error(error.response?.data?.message || error.message);
                if (error.response?.status === 401) {
                    navigate('/staff/login');
                }
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [axios, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center">
                <Loader2 className="animate-spin text-burgundy-600" size={40} />
            </div>
        );
    }

    const statCards = [
        {
            title: 'Chiffre d\'affaires',
            value: `${stats.totalVentes.toLocaleString()} FCFA`,
            icon: TrendingUp,
            color: 'bg-emerald-50 text-emerald-600',
        },
        {
            title: 'Commandes totales',
            value: stats.totalCommandes,
            icon: ShoppingBag,
            color: 'bg-blue-50 text-blue-600',
        },
        {
            title: 'Commandes en cours',
            value: stats.commandesEnCours,
            icon: Clock,
            color: 'bg-amber-50 text-amber-600',
        },
        {
            title: 'Portefeuille',
            value: `${stats.soldeWallet.toLocaleString()} FCFA`,
            icon: Wallet,
            color: 'bg-burgundy-50 text-burgundy-600',
        },
        {
            title: 'Produits en stock',
            value: stats.produitsEnStock,
            icon: Package,
            color: 'bg-indigo-50 text-indigo-600',
        },
        {
            title: 'Stock bas (<5)',
            value: stats.produitsBasStock,
            icon: Package,
            color: 'bg-red-50 text-red-600',
        },
    ];

    return (
        <div className="min-h-screen bg-ivory-200">
            <div className="bg-burgundy-600 text-ivory-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <LayoutDashboard size={24} />
                            <div>
                                <h1 className="text-lg font-bold">Tableau de bord</h1>
                                <p className="text-sm text-blush-300">Bienvenue, {moi?.nom} 👋</p>
                            </div>
                        </div>
                        <span className="text-xs bg-blush-200/20 px-3 py-1 rounded-full">Commerçant</span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    {statCards.map((stat, index) => {
                        const Icon = stat.icon;
                        return (
                            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-blush-300 hover:shadow-md transition">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${stat.color}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">{stat.title}</p>
                                        <p className="text-sm font-bold text-gray-800 truncate">{stat.value}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <button onClick={() => navigate('/commercant/boutique')} className="bg-white border border-blush-300 rounded-xl p-4 text-center hover:shadow-md transition hover:border-burgundy-400">
                        <Package className="mx-auto text-burgundy-600 mb-1" size={24} />
                        <p className="text-sm font-medium text-gray-700">Ma boutique</p>
                    </button>
                    <button onClick={() => navigate('/commercant/produits')} className="bg-white border border-blush-300 rounded-xl p-4 text-center hover:shadow-md transition hover:border-burgundy-400">
                        <PlusCircle className="mx-auto text-emerald-600 mb-1" size={24} />
                        <p className="text-sm font-medium text-gray-700">Ajouter un produit</p>
                    </button>
                    <button onClick={() => navigate('/commercant/portefeuille')} className="bg-white border border-blush-300 rounded-xl p-4 text-center hover:shadow-md transition hover:border-burgundy-400">
                        <Wallet className="mx-auto text-blue-600 mb-1" size={24} />
                        <p className="text-sm font-medium text-gray-700">Portefeuille</p>
                    </button>
                    <button onClick={() => navigate('/commercant/retraits')} className="bg-white border border-blush-300 rounded-xl p-4 text-center hover:shadow-md transition hover:border-burgundy-400">
                        <DollarSign className="mx-auto text-amber-600 mb-1" size={24} />
                        <p className="text-sm font-medium text-gray-700">Demander un retrait</p>
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-blush-300 overflow-hidden">
                    <div className="px-6 py-4 border-b border-blush-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-800">📦 Dernières commandes</h2>
                    </div>
                    {dernieresCommandes.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Aucune commande pour le moment</div>
                    ) : (
                        <div className="divide-y divide-blush-200">
                            {dernieresCommandes.map((order) => (
                                <div key={order._id} className="px-6 py-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">Commande #{order._id.slice(-8)}</p>
                                        <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('fr-FR')} · {order.items.length} article(s)</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-semibold text-gray-800">{order.amount.toLocaleString()} FCFA</span>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                            order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                            order.status === 'Cancelled' || order.status === 'Returned' ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>{order.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;