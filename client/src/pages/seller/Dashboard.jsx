import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import toast from 'react-hot-toast'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const COLORS = {
    red: '#e53935',
    black: '#111111',
    gray: '#333333',
    green: '#10b981',
    blue: '#3b82f6',
    orange: '#f59e0b',
}

// ── Tooltip custom ──
const CustomTooltip = ({ active, payload, label, currency }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
                {label && <p className="text-gray-500 mb-1 text-xs">{label}</p>}
                {payload.map((entry, i) => (
                    <p key={i} className="font-semibold" style={{ color: entry.color }}>
                        {entry.name} : {entry.value.toLocaleString()} {currency || ''}
                    </p>
                ))}
            </div>
        )
    }
    return null
}

// ── Label custom pour Pie ──
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    )
}

const Dashboard = () => {
    const { currency, axios } = useAppContext()

    // ── États existants ──
    const [stats, setStats] = useState({
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        avgOrderValue: 0,
        conversionRate: 0,
        lowStockProducts: []
    })
    const [topProducts, setTopProducts] = useState([])
    const [dailySales, setDailySales] = useState([])
    const [monthlySalesData, setMonthlySalesData] = useState([])
    const [allOrders, setAllOrders] = useState([])
    const [allProducts, setAllProducts] = useState([])
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [availableYears, setAvailableYears] = useState([])
    const [loading, setLoading] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(new Date())

    // ── États Recharts ──
    const [revenueChartData, setRevenueChartData] = useState([])
    const [categoryChartData, setCategoryChartData] = useState([])
    const [statusChartData, setStatusChartData] = useState([])
    const [paymentChartData, setPaymentChartData] = useState([])
    const [dailyChartData, setDailyChartData] = useState([])

    // ── État clients ──
    const [clientStats, setClientStats] = useState({
        totalClients: 0,
        newClientsThisMonth: 0,
        recurringClients: 0,
        retentionRate: 0
    })

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            const { data } = await axios.get('/api/order/seller')
            const { data: productsData } = await axios.get('/api/product/list')

            if (data.success) {
                const orders = data.orders
                setAllOrders(orders)
                setAllProducts(productsData.products)
                setLastUpdate(new Date())

                const years = [...new Set(orders.map(o => new Date(o.createdAt).getFullYear()))].sort((a, b) => b - a)
                setAvailableYears(years)
                if (years.length > 0 && !years.includes(selectedYear)) setSelectedYear(years[0])

                const totalOrders = orders.length
                const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0)
                const pendingOrders = orders.filter(o => o.status === 'Order Placed' || o.status === 'Confirmed').length
                const deliveredOrders = orders.filter(o => o.status === 'Delivered').length
                const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length
                const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
                const conversionRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0

                // Top produits
                const productSales = {}
                orders.forEach(order => {
                    order.items.forEach(item => {
                        productSales[item.product] = (productSales[item.product] || 0) + item.quantity
                    })
                })
                const topProductsList = Object.entries(productSales)
                    .sort((a, b) => b[1] - a[1]).slice(0, 5)
                    .map(([productId, qty]) => {
                        const product = productsData.products.find(p => p._id === productId)
                        return { name: product?.name || 'Produit', quantity: qty, image: product?.image?.[0] }
                    })
                setTopProducts(topProductsList)

                // Daily sales
                const last7Days = [...Array(7)].map((_, i) => {
                    const d = new Date()
                    d.setDate(d.getDate() - i)
                    return d.toISOString().split('T')[0]
                }).reverse()
                const dailySalesData = last7Days.map(day => ({
                    label: new Date(day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                    ventes: orders.filter(o => o.createdAt?.split('T')[0] === day).reduce((sum, o) => sum + o.amount, 0)
                }))
                setDailySales(dailySalesData.map(d => d.ventes))
                setDailyChartData(dailySalesData)

                // Monthly
                const monthlyAnalysis = Array(12).fill(0)
                orders.forEach(o => {
                    monthlyAnalysis[new Date(o.createdAt).getMonth()] += o.amount
                })
                setMonthlySalesData(monthlyAnalysis)

                // Payment
                const paymentCount = { COD: 0, Online: 0, GeniusPay: 0 }
                orders.forEach(o => {
                    if (o.paymentType === 'COD') paymentCount.COD++
                    else if (o.paymentType === 'Online') paymentCount.Online++
                    else if (o.paymentType === 'GeniusPay') paymentCount.GeniusPay++
                })
                setPaymentChartData([
                    { name: 'Livraison', value: paymentCount.COD, color: COLORS.black },
                    { name: 'Carte', value: paymentCount.Online, color: COLORS.red },
                    { name: 'Mobile Money', value: paymentCount.GeniusPay, color: COLORS.gray },
                ])

                // Status
                const statusCount = {
                    'Order Placed': 0, 'Confirmed': 0, 'Shipped': 0,
                    'Out for Delivery': 0, 'Delivered': 0, 'Cancelled': 0
                }
                orders.forEach(o => { if (statusCount[o.status] !== undefined) statusCount[o.status]++ })
                setStatusChartData([
                    { name: 'Commandée', value: statusCount['Order Placed'], color: COLORS.black },
                    { name: 'Confirmée', value: statusCount['Confirmed'], color: COLORS.gray },
                    { name: 'Expédiée', value: statusCount['Shipped'], color: COLORS.blue },
                    { name: 'En livraison', value: statusCount['Out for Delivery'], color: COLORS.orange },
                    { name: 'Livrée', value: statusCount['Delivered'], color: COLORS.green },
                    { name: 'Annulée', value: statusCount['Cancelled'], color: COLORS.red },
                ])

                // Low stock
                const lowStockProducts = productsData.products.filter(p => {
                    if (p.variants?.length) return p.variants.some(v => v.stock > 0 && v.stock <= 5)
                    return p.stock !== null && p.stock <= 5 && p.stock > 0
                }).slice(0, 5)

                setStats({ totalOrders, totalRevenue, pendingOrders, deliveredOrders, cancelledOrders, avgOrderValue, conversionRate, lowStockProducts })

                // Clients
                const uniqueUserIds = [...new Set(orders.map(o => o.userId))]
                const totalClients = uniqueUserIds.length
                const thisMonth = new Date().getMonth()
                const thisYear = new Date().getFullYear()
                const firstOrderByUser = {}
                orders.forEach(o => {
                    const d = new Date(o.createdAt)
                    if (!firstOrderByUser[o.userId] || d < new Date(firstOrderByUser[o.userId].createdAt))
                        firstOrderByUser[o.userId] = o
                })
                const newClientsThisMonth = Object.values(firstOrderByUser).filter(o => {
                    const d = new Date(o.createdAt)
                    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
                }).length
                const recurringClients = uniqueUserIds.filter(uid => orders.filter(o => o.userId === uid).length > 1).length
                const retentionRate = totalClients > 0 ? Math.round((recurringClients / totalClients) * 100) : 0
                setClientStats({ totalClients, newClientsThisMonth, recurringClients, retentionRate })

                // Categories
                const categorySales = {}
                orders.forEach(o => {
                    o.items.forEach(item => {
                        const product = productsData.products.find(p => p._id === item.product)
                        if (product) {
                            const cat = product.category || product.categories?.[0] || 'Autre'
                            const amount = (item.priceAtOrder || product.offerPrice || product.price) * item.quantity
                            categorySales[cat] = (categorySales[cat] || 0) + amount
                        }
                    })
                })
                const sortedCats = Object.entries(categorySales).sort((a, b) => b[1] - a[1]).slice(0, 6)
                setCategoryChartData(sortedCats.map(([name, value]) => ({ name, value })))
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (allOrders.length > 0) prepareRevenueChart()
    }, [allOrders, selectedYear])

    const prepareRevenueChart = () => {
        const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
        const monthlyData = Array(12).fill(0)
        allOrders.forEach(o => {
            const d = new Date(o.createdAt)
            if (d.getFullYear() === selectedYear) monthlyData[d.getMonth()] += o.amount
        })
        setRevenueChartData(labels.map((label, i) => ({ label, ca: monthlyData[i] })))
    }

    useEffect(() => { fetchDashboardData() }, [])

    const selectedMonthRevenue = monthlySalesData[selectedMonth] || 0
    const selectedMonthOrders = allOrders.filter(o => new Date(o.createdAt).getMonth() === selectedMonth).length
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    const weeklyTrend = dailySales.length > 0 ? ((dailySales[dailySales.length - 1] - dailySales[0]) / (dailySales[0] || 1)) * 100 : 0

    if (loading) return (
        <div className="flex items-center justify-center h-[80vh]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-500">Chargement du tableau de bord...</p>
            </div>
        </div>
    )

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6 space-y-6">

                {/* ── HEADER ── */}
                <div className="flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
                        <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de votre activité</p>
                        <p className="text-xs text-gray-400 mt-1">Dernière mise à jour : {lastUpdate.toLocaleTimeString()}</p>
                    </div>
                    <button onClick={fetchDashboardData} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                        Actualiser
                    </button>
                </div>

                {/* ── KPIs PRINCIPAUX ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {[
                        {
                            label: 'Commandes totales', value: stats.totalOrders,
                            sub: `+${stats.deliveredOrders} livrées`, subColor: 'text-green-600',
                            icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>,
                            iconBg: 'bg-gray-100', iconColor: '#111'
                        },
                        {
                            label: "Chiffre d'affaires", value: `${stats.totalRevenue.toLocaleString()} ${currency}`,
                            sub: `${weeklyTrend >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(weeklyTrend))}% cette semaine`,
                            subColor: weeklyTrend >= 0 ? 'text-green-600' : 'text-red-500',
                            icon: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
                            iconBg: 'bg-green-50', iconColor: '#10b981'
                        },
                        {
                            label: 'Panier moyen', value: `${Math.round(stats.avgOrderValue).toLocaleString()} ${currency}`,
                            sub: 'vs moyenne générale', subColor: 'text-gray-400',
                            icon: <><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></>,
                            iconBg: 'bg-blue-50', iconColor: '#3b82f6'
                        },
                        {
                            label: 'Taux de livraison', value: `${Math.round(stats.conversionRate)}%`,
                            sub: `${stats.deliveredOrders} / ${stats.totalOrders} commandes`, subColor: 'text-gray-400',
                            icon: <><path d="M22 12A10 10 0 0012 2v10z"/><path d="M12 2a10 10 0 000 20"/></>,
                            iconBg: 'bg-orange-50', iconColor: '#f59e0b'
                        },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">{kpi.label}</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                                    <p className={`text-xs mt-1 ${kpi.subColor}`}>{kpi.sub}</p>
                                </div>
                                <div className={`w-11 h-11 ${kpi.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={kpi.iconColor} strokeWidth="1.8">{kpi.icon}</svg>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── BLOC CLIENTS ── */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-sm text-gray-500">Total clients actifs</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">{clientStats.totalClients}</p>
                        </div>
                        <span className="flex items-center gap-2 text-xs text-gray-600 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                            Rétention : <span className="font-bold text-green-700">{clientStats.retentionRate}%</span>
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-red-500">
                            <p className="text-xs text-gray-500 mb-1">Nouveaux ce mois</p>
                            <p className="text-2xl font-bold text-gray-900">{clientStats.newClientsThisMonth}</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {clientStats.totalClients > 0 ? `${Math.round((clientStats.newClientsThisMonth / clientStats.totalClients) * 100)}% de la base` : '—'}
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-green-500">
                            <p className="text-xs text-gray-500 mb-1">Clients récurrents</p>
                            <p className="text-2xl font-bold text-gray-900">{clientStats.recurringClients}</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {clientStats.totalClients > 0 ? `${Math.round((clientStats.recurringClients / clientStats.totalClients) * 100)}% de la base` : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── ANALYSE MENSUELLE ── */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                        <h3 className="font-semibold text-gray-900">Analyse mensuelle</h3>
                        <div className="flex gap-2">
                            <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-red-500">
                                {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            {availableYears.length > 0 && (
                                <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-red-500">
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Chiffre d'affaires</p>
                            <p className="text-xl font-bold text-red-500 mt-1">{selectedMonthRevenue.toLocaleString()} {currency}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Commandes</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{selectedMonthOrders}</p>
                        </div>
                    </div>
                </div>

                {/* ── GRAPHIQUE CA ANNUEL (Area) ── */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-5">Évolution du chiffre d'affaires — {selectedYear}</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={revenueChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor={COLORS.red} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
                            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                            <Tooltip content={<CustomTooltip currency={currency}/>}/>
                            <Area type="monotone" dataKey="ca" name="CA" stroke={COLORS.red} strokeWidth={2.5} fill="url(#caGradient)" dot={{ r: 4, fill: COLORS.red, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }}/>
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* ── VENTES 7 JOURS + STATUT ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-5">Ventes — 7 derniers jours</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={dailyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
                                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                                <Tooltip content={<CustomTooltip currency={currency}/>}/>
                                <Bar dataKey="ventes" name="Ventes" fill={COLORS.red} radius={[6, 6, 0, 0]}/>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-5">Statut des commandes</h3>
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width="50%" height={180}>
                                <PieChart>
                                    <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" labelLine={false} label={renderCustomLabel}>
                                        {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip/>}/>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-2">
                                {statusChartData.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }}></span>
                                            <span className="text-gray-600">{item.name}</span>
                                        </div>
                                        <span className="font-semibold text-gray-800">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── CATÉGORIES + PAIEMENTS ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-5">Ventes par catégorie</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={categoryChartData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={80}/>
                                <Tooltip content={<CustomTooltip currency={currency}/>}/>
                                <Bar dataKey="value" name="Ventes" fill={COLORS.red} radius={[0, 6, 6, 0]}>
                                    {categoryChartData.map((_, i) => (
                                        <Cell key={i} fill={i % 2 === 0 ? COLORS.red : COLORS.black}/>
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-5">Moyens de paiement</h3>
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width="50%" height={180}>
                                <PieChart>
                                    <Pie data={paymentChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" labelLine={false} label={renderCustomLabel}>
                                        {paymentChartData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip/>}/>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-3">
                                {paymentChartData.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }}></span>
                                            <span className="text-gray-600">{item.name}</span>
                                        </div>
                                        <span className="font-semibold text-gray-800">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── TOP PRODUITS ── */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4">🏆 Meilleures ventes</h3>
                    {topProducts.length === 0 ? (
                        <p className="text-gray-400 text-center py-8 text-sm">Aucune donnée disponible</p>
                    ) : (
                        <div className="space-y-3">
                            {topProducts.map((product, idx) => {
                                const maxQty = topProducts[0]?.quantity || 1
                                const pct = Math.round((product.quantity / maxQty) * 100)
                                return (
                                    <div key={idx} className="flex items-center gap-4">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0 ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-gray-700' : 'bg-gray-400'}`}>
                                            {idx + 1}
                                        </div>
                                        {product.image && <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded-lg border border-gray-100 flex-shrink-0"/>}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                                                <p className="text-xs text-gray-500 ml-2 flex-shrink-0">{product.quantity} vendus</p>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: idx === 0 ? COLORS.red : COLORS.black }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* ── STOCK FAIBLE ── */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">⚠️ Produits en stock faible</h3>
                        <span className="text-xs text-gray-500">{stats.lowStockProducts.length} produit(s)</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {stats.lowStockProducts.length === 0 ? (
                            <p className="p-5 text-gray-400 text-center text-sm">✅ Aucun produit en stock faible</p>
                        ) : stats.lowStockProducts.map((product, idx) => {
                            let minStock = null
                            if (product.variants?.length) minStock = Math.min(...product.variants.map(v => v.stock).filter(s => s > 0))
                            else if (product.stock !== null) minStock = product.stock
                            return (
                                <div key={idx} className="p-4 hover:bg-gray-50 transition flex items-center gap-3">
                                    <img src={product.image?.[0]} alt={product.name} className="w-10 h-10 object-cover rounded-lg border border-gray-200"/>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800 text-sm">{product.name}</p>
                                        <p className="text-xs text-gray-400">{product.category || product.categories?.[0] || '-'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold text-sm ${minStock === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                            {minStock === 0 ? 'Épuisé' : `${minStock} restant(s)`}
                                        </p>
                                        <p className="text-xs text-gray-400">Réapprovisionner</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ── DERNIÈRES COMMANDES ── */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">📦 Dernières commandes</h3>
                        <span className="text-xs text-gray-500">{allOrders.length} commandes</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {allOrders.slice(0, 5).map((order, idx) => (
                            <div key={idx} className="p-4 hover:bg-gray-50 transition">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-mono text-sm font-medium text-gray-800">#{order._id.slice(-8)}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{new Date(order.createdAt).toLocaleDateString()} à {new Date(order.createdAt).toLocaleTimeString()}</p>
                                        <p className="text-xs text-gray-500 mt-1">{order.address?.firstName} {order.address?.lastName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-red-500">{order.amount.toLocaleString()} {currency}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{order.paymentType === 'COD' ? '💰 Livraison' : '💳 En ligne'}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                                            order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                            order.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {order.status === 'Delivered' ? 'Livrée' : order.status === 'Cancelled' ? 'Annulée' :
                                             order.status === 'Shipped' ? 'Expédiée' : order.status === 'Out for Delivery' ? 'En livraison' :
                                             order.status === 'Confirmed' ? 'Confirmée' : 'Commandée'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {allOrders.length > 5 && (
                            <div className="p-3 text-center bg-gray-50">
                                <p className="text-xs text-gray-400">+ {allOrders.length - 5} autres commandes</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}

export default Dashboard