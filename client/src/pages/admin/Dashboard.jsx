import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import {
    ShoppingBag, Package, Users, Truck, Wallet, Coins, AlertTriangle,
    TrendingUp, TrendingDown, CheckCircle, XCircle, Clock, Eye, DollarSign
} from 'lucide-react';

const Dashboard = () => {
    const { axios } = useAppContext();
    const [stats, setStats] = useState({
        orders: { total: 0, today: 0, pending: 0, delivered: 0 },
        products: { total: 0, outOfStock: 0, lowStock: 0 },
        users: { total: 0, newToday: 0 },
        deliveries: { pending: 0, inProgress: 0 },
        finance: { revenue: 0, pendingWithdrawals: 0, totalWithdrawals: 0 },
        rcoins: { totalBalance: 0, transactions: 0 },
        approvals: { pending: 0 },
        refunds: { pending: 0, totalAmount: 0, completed: 0 },
        alerts: [],
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [dashboardRes, approvalsRes, refundsRes] = await Promise.all([
                    axios.get('/api/admin/dashboard/stats'),
                    axios.get('/api/admin/approvals?statut=en_attente'),
                    axios.get('/api/admin/refunds?statut=requested'),
                    axios.get('/api/admin/refunds?statut=completed'),
                ]);

                const s = dashboardRes.data.stats || {};
                const pendingRefunds = refundsRes.data.refunds || [];
                const completedRefunds = refundsRes.data.refunds || [];
                const totalRefundAmount = [...pendingRefunds, ...completedRefunds].reduce((sum, r) => sum + (r.montantApprouve || 0), 0);

                setStats({
                    orders: s.orders || { total: 0, today: 0, pending: 0, delivered: 0 },
                    products: s.products || { total: 0, outOfStock: 0, lowStock: 0 },
                    users: s.users || { total: 0, newToday: 0 },
                    deliveries: s.deliveries || { pending: 0, inProgress: 0 },
                    finance: s.finance || { revenue: 0, pendingWithdrawals: 0, totalWithdrawals: 0 },
                    rcoins: s.rcoins || { totalBalance: 0, transactions: 0 },
                    approvals: { pending: approvalsRes.data.approvals?.length || 0 },
                    refunds: {
                        pending: pendingRefunds.length,
                        completed: completedRefunds.length,
                        totalAmount: totalRefundAmount,
                    },
                    alerts: buildAlerts(s, approvalsRes.data, pendingRefunds),
                });
            } catch (error) {
                console.error('Erreur chargement stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const buildAlerts = (dashboardStats, approvalsData, pendingRefunds) => {
        const alerts = [];

        if (dashboardStats.orders?.pending > 0) {
            alerts.push({
                type: 'warn',
                message: `${dashboardStats.orders.pending} commande(s) en attente de traitement`,
                link: '/admin/orders',
                icon: Clock,
            });
        }

        if (dashboardStats.products?.outOfStock > 0) {
            alerts.push({
                type: 'error',
                message: `${dashboardStats.products.outOfStock} produit(s) en rupture de stock`,
                link: '/admin/products?filter=outOfStock',
                icon: XCircle,
            });
        }

        if (approvalsData.approvals?.length > 0) {
            alerts.push({
                type: 'warn',
                message: `${approvalsData.approvals.length} demande(s) d'approbation en attente`,
                link: '/admin/approvals',
                icon: Clock,
            });
        }

        if (pendingRefunds?.length > 0) {
            alerts.push({
                type: 'warn',
                message: `${pendingRefunds.length} remboursement(s) en attente d'approbation`,
                link: '/admin/refunds',
                icon: DollarSign,
            });
        }

        return alerts;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-500">Chargement du tableau de bord...</p>
                </div>
            </div>
        );
    }

    const StatCard = ({ icon: Icon, label, value, sub, link, color = 'gray' }) => (
        <Link to={link || '#'} className="block">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition group">
                <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-xl bg-${color}-50 flex items-center justify-center group-hover:scale-105 transition`}>
                        <Icon size={20} className={`text-${color}-500`} />
                    </div>
                    {sub && <span className="text-xs font-medium text-gray-400">{sub}</span>}
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-3">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
            </div>
        </Link>
    );

    return (
        <div className="p-4 sm:p-6 space-y-6">
            {/* En-tête */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
                <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de l'activité de la plateforme</p>
            </div>

            {/* Alertes */}
            {stats.alerts.length > 0 && (
                <div className="grid gap-3">
                    {stats.alerts.map((alert, i) => {
                        const Icon = alert.icon;
                        return (
                            <Link
                                key={i}
                                to={alert.link}
                                className={`flex items-center gap-3 p-3 rounded-xl border ${
                                    alert.type === 'error'
                                        ? 'bg-red-50 border-red-200 text-red-700'
                                        : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                } hover:shadow-sm transition`}
                            >
                                <Icon size={18} className="shrink-0" />
                                <span className="text-sm font-medium">{alert.message}</span>
                                <span className="ml-auto text-xs">Voir →</span>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* KPI - Première ligne */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={ShoppingBag}
                    label="Commandes totales"
                    value={stats.orders.total}
                    sub={`${stats.orders.today} aujourd'hui`}
                    link="/admin/orders"
                    color="blue"
                />
                <StatCard
                    icon={Package}
                    label="Produits en ligne"
                    value={stats.products.total}
                    sub={`${stats.products.outOfStock} en rupture`}
                    link="/admin/products"
                    color="green"
                />
                <StatCard
                    icon={Users}
                    label="Clients"
                    value={stats.users.total}
                    sub={`${stats.users.newToday} nouveau(x) aujourd'hui`}
                    link="/admin/clients"
                    color="purple"
                />
                <StatCard
                    icon={Wallet}
                    label="Chiffre d'affaires"
                    value={`${stats.finance.revenue.toLocaleString('fr-FR')} FCFA`}
                    link="/admin/finance"
                    color="red"
                />
            </div>

            {/* KPI - Deuxième ligne */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={Truck}
                    label="Livraisons en cours"
                    value={stats.deliveries.inProgress}
                    sub={`${stats.deliveries.pending} en attente`}
                    link="/admin/deliveries"
                    color="orange"
                />
                <StatCard
                    icon={Clock}
                    label="Demandes d'approbation"
                    value={stats.approvals.pending}
                    link="/admin/approvals"
                    color="yellow"
                />
                <StatCard
                    icon={Coins}
                    label="RCOINS en circulation"
                    value={`${stats.rcoins.totalBalance.toLocaleString('fr-FR')} FCFA`}
                    link="/admin/rcoins"
                    color="indigo"
                />
                <StatCard
                    icon={DollarSign}
                    label="Remboursements en attente"
                    value={stats.refunds.pending}
                    sub={`${stats.refunds.totalAmount.toLocaleString('fr-FR')} FCFA`}
                    link="/admin/refunds"
                    color="red"
                />
            </div>

            {/* Liens rapides */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Link to="/admin/orders" className="bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-gray-300 transition">
                    <span className="text-sm font-medium text-gray-700">Commandes</span>
                </Link>
                <Link to="/admin/products" className="bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-gray-300 transition">
                    <span className="text-sm font-medium text-gray-700">Catalogue</span>
                </Link>
                <Link to="/admin/staff" className="bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-gray-300 transition">
                    <span className="text-sm font-medium text-gray-700">Équipe</span>
                </Link>
                <Link to="/admin/settings/thresholds" className="bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-gray-300 transition">
                    <span className="text-sm font-medium text-gray-700">Seuils d'approbation</span>
                </Link>
                <Link to="/admin/refunds" className="bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-gray-300 transition">
                    <span className="text-sm font-medium text-gray-700">Remboursements</span>
                </Link>
            </div>
        </div>
    );
};

export default Dashboard;