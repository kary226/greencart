import React, { useEffect, useState, useMemo } from 'react'
import { useAppContext } from '../../context/AppContext'
import toast from 'react-hot-toast'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
)

const Dashboard = () => {
    const { currency, axios } = useAppContext()
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
    const [weeklySales, setWeeklySales] = useState([])
    const [monthlySalesData, setMonthlySalesData] = useState([])
    const [allOrders, setAllOrders] = useState([])
    const [allProducts, setAllProducts] = useState([])
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [availableYears, setAvailableYears] = useState([])
    const [loading, setLoading] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(new Date())
    const [chartData, setChartData] = useState({})
    const [categoryChartData, setCategoryChartData] = useState({})
    const [statusChartData, setStatusChartData] = useState({})
    const [paymentChartData, setPaymentChartData] = useState({})

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
                
                const years = [...new Set(orders.map(order => new Date(order.createdAt).getFullYear()))].sort((a, b) => b - a)
                setAvailableYears(years)
                if (years.length > 0 && !years.includes(selectedYear)) {
                    setSelectedYear(years[0])
                }
                
                const totalOrders = orders.length
                const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0)
                const pendingOrders = orders.filter(o => o.status === 'Order Placed' || o.status === 'Confirmed').length
                const deliveredOrders = orders.filter(o => o.status === 'Delivered').length
                const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length
                const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
                const conversionRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0
                
                const productSales = {}
                orders.forEach(order => {
                    order.items.forEach(item => {
                        const productId = item.product
                        const quantity = item.quantity
                        productSales[productId] = (productSales[productId] || 0) + quantity
                    })
                })
                const topProductsList = Object.entries(productSales)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([productId, qty]) => {
                        const product = productsData.products.find(p => p._id === productId)
                        return { name: product?.name || 'Produit', quantity: qty, image: product?.image?.[0] }
                    })
                setTopProducts(topProductsList)
                
                const last7Days = [...Array(7)].map((_, i) => {
                    const d = new Date()
                    d.setDate(d.getDate() - i)
                    return d.toISOString().split('T')[0]
                }).reverse()
                
                const dailySalesData = last7Days.map(day => {
                    const dayOrders = orders.filter(order => order.createdAt?.split('T')[0] === day)
                    return dayOrders.reduce((sum, order) => sum + order.amount, 0)
                })
                setDailySales(dailySalesData)
                
                const weeklySalesData = [0, 0, 0, 0, 0, 0, 0]
                orders.forEach(order => {
                    const day = new Date(order.createdAt).getDay()
                    weeklySalesData[day] += order.amount
                })
                setWeeklySales(weeklySalesData)
                
                const monthlyAnalysis = Array(12).fill(0)
                orders.forEach(order => {
                    const date = new Date(order.createdAt)
                    const month = date.getMonth()
                    monthlyAnalysis[month] += order.amount
                })
                setMonthlySalesData(monthlyAnalysis)
                
                const paymentCount = { COD: 0, Online: 0, GeniusPay: 0 }
                orders.forEach(order => {
                    if (order.paymentType === 'COD') paymentCount.COD++
                    else if (order.paymentType === 'Online') paymentCount.Online++
                    else if (order.paymentType === 'GeniusPay') paymentCount.GeniusPay++
                })
                setPaymentChartData({
                    labels: ['Paiement à la livraison', 'Carte bancaire', 'Mobile Money'],
                    datasets: [{
                        data: [paymentCount.COD, paymentCount.Online, paymentCount.GeniusPay],
                        backgroundColor: ['#111111', '#e53935', '#333333'],
                        borderWidth: 0,
                    }]
                })
                
                const lowStockProducts = productsData.products.filter(p => {
                    if (p.variants?.length) {
                        return p.variants.some(v => v.stock > 0 && v.stock <= 5)
                    }
                    return p.stock !== null && p.stock <= 5 && p.stock > 0
                }).slice(0, 5)
                
                setStats({
                    totalOrders,
                    totalRevenue,
                    pendingOrders,
                    deliveredOrders,
                    cancelledOrders,
                    avgOrderValue,
                    conversionRate,
                    lowStockProducts
                })
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (allOrders.length > 0) {
            prepareChartData()
            prepareCategoryChartData()
            prepareStatusChartData()
        }
    }, [allOrders, allProducts, selectedYear])

    const prepareChartData = () => {
        const monthlyData = Array(12).fill(0)
        
        allOrders.forEach(order => {
            const date = new Date(order.createdAt)
            const year = date.getFullYear()
            const month = date.getMonth()
            if (year === selectedYear) {
                monthlyData[month] += order.amount
            }
        })

        setChartData({
            labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
            datasets: [{
                label: `Chiffre d'affaires (${currency})`,
                data: monthlyData,
                borderColor: '#e53935',
                backgroundColor: 'rgba(229, 57, 53, 0.05)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#e53935',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            }]
        })
    }

    const prepareCategoryChartData = () => {
        const categorySales = {}
        
        allOrders.forEach(order => {
            order.items.forEach(item => {
                const product = allProducts.find(p => p._id === item.product)
                if (product) {
                    const category = product.category || product.categories?.[0] || 'Non catégorisé'
                    const amount = (item.priceAtOrder || product.offerPrice || product.price) * item.quantity
                    categorySales[category] = (categorySales[category] || 0) + amount
                }
            })
        })

        const sortedCategories = Object.entries(categorySales).sort((a, b) => b[1] - a[1]).slice(0, 6)
        
        setCategoryChartData({
            labels: sortedCategories.map(c => c[0]),
            datasets: [{
                label: 'Ventes par catégorie',
                data: sortedCategories.map(c => c[1]),
                backgroundColor: ['#111111', '#e53935', '#333333', '#e53935', '#111111', '#e53935'],
                borderRadius: 8,
            }]
        })
    }

    const prepareStatusChartData = () => {
        const statusCount = {
            'Order Placed': 0,
            'Confirmed': 0,
            'Shipped': 0,
            'Out for Delivery': 0,
            'Delivered': 0,
            'Cancelled': 0
        }
        
        allOrders.forEach(order => {
            if (statusCount[order.status] !== undefined) {
                statusCount[order.status]++
            }
        })

        setStatusChartData({
            labels: ['Commandée', 'Confirmée', 'Expédiée', 'En livraison', 'Livrée', 'Annulée'],
            datasets: [{
                data: Object.values(statusCount),
                backgroundColor: ['#111111', '#333333', '#e53935', '#e53935', '#10b981', '#e53935'],
                borderWidth: 0,
            }]
        })
    }

    useEffect(() => {
        fetchDashboardData()
    }, [])

    // 📊 Statistiques calculées
    const selectedMonthRevenue = monthlySalesData[selectedMonth] || 0
    const selectedMonthOrders = allOrders.filter(o => new Date(o.createdAt).getMonth() === selectedMonth).length
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    
    // Tendances
    const weeklyTrend = dailySales.length > 0 ? 
        ((dailySales[dailySales.length - 1] - dailySales[0]) / (dailySales[0] || 1)) * 100 : 0
    
    const avgOrderTrend = stats.avgOrderValue > 0 ? 
        ((stats.totalRevenue / stats.totalOrders) - stats.avgOrderValue) / stats.avgOrderValue * 100 : 0

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-500">Chargement du tableau de bord...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6 space-y-6">
                
                {/* Header avec dernière mise à jour */}
                <div className="flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
                        <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de votre activité</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Dernière mise à jour : {lastUpdate.toLocaleTimeString()}
                        </p>
                    </div>
                    <button 
                        onClick={fetchDashboardData} 
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        Actualiser
                    </button>
                </div>

                {/* Stats Grid avec tendances */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Commandes totales</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
                                <p className="text-xs text-green-600 mt-1">+{stats.deliveredOrders} livrées</p>
                            </div>
                            <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.8">
                                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                    <line x1="2" y1="10" x2="22" y2="10"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Chiffre d'affaires</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRevenue.toLocaleString()} {currency}</p>
                                <p className={`text-xs ${weeklyTrend >= 0 ? 'text-green-600' : 'text-red-500'} mt-1`}>
                                    {weeklyTrend >= 0 ? '↑' : '↓'} {Math.abs(Math.round(weeklyTrend))}% cette semaine
                                </p>
                            </div>
                            <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8">
                                    <line x1="12" y1="1" x2="12" y2="23"/>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Panier moyen</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{Math.round(stats.avgOrderValue).toLocaleString()} {currency}</p>
                                <p className={`text-xs ${avgOrderTrend >= 0 ? 'text-green-600' : 'text-red-500'} mt-1`}>
                                    vs moyenne générale
                                </p>
                            </div>
                            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 6v6l4 2"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Taux de livraison</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{Math.round(stats.conversionRate)}%</p>
                                <p className="text-xs text-gray-500 mt-1">{stats.deliveredOrders} / {stats.totalOrders} commandes</p>
                            </div>
                            <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8">
                                    <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                                    <path d="M12 2a10 10 0 0 0 0 20"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Monthly Analysis amélioré */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                        <h3 className="font-semibold text-gray-900">Analyse mensuelle</h3>
                        <div className="flex gap-2">
                            <select 
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-red-500"
                            >
                                {monthNames.map((month, idx) => (
                                    <option key={idx} value={idx}>{month}</option>
                                ))}
                            </select>
                            {availableYears.length > 0 && (
                                <select 
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-red-500"
                                >
                                    {availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4 text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Chiffre d'affaires</p>
                            <p className="text-xl font-bold text-red-500 mt-1">{selectedMonthRevenue.toLocaleString()} {currency}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Nombre de commandes</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{selectedMonthOrders}</p>
                        </div>
                    </div>
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Évolution du chiffre d'affaires</h3>
                        {chartData.datasets && <Line data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Statut des commandes</h3>
                        <div className="w-64 mx-auto">
                            {statusChartData.datasets && <Doughnut data={statusChartData} options={{ responsive: true }} />}
                        </div>
                    </div>
                </div>

                {/* Charts Row 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Ventes par catégorie</h3>
                        {categoryChartData.datasets && <Bar data={categoryChartData} options={{ responsive: true }} />}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Moyens de paiement</h3>
                        <div className="w-64 mx-auto">
                            {paymentChartData.datasets && <Doughnut data={paymentChartData} options={{ responsive: true }} />}
                        </div>
                    </div>
                </div>

                {/* Charts Row 3 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Ventes (7 derniers jours)</h3>
                        {dailySales.length > 0 && (
                            <Bar 
                                data={{
                                    labels: [...Array(7)].map((_, i) => {
                                        const d = new Date()
                                        d.setDate(d.getDate() - (6 - i))
                                        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                                    }),
                                    datasets: [{
                                        label: `Ventes (${currency})`,
                                        data: dailySales,
                                        backgroundColor: '#e53935',
                                        borderRadius: 8,
                                    }]
                                }}
                                options={{ responsive: true }}
                            />
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Meilleures ventes</h3>
                        {topProducts.length === 0 ? (
                            <p className="text-gray-400 text-center py-8 text-sm">Aucune donnée disponible</p>
                        ) : (
                            <div className="space-y-3">
                                {topProducts.map((product, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-white text-xs ${
                                            idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-gray-700' : 'bg-gray-500'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        {product.image && (
                                            <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded-md" />
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800 text-sm">{product.name}</p>
                                            <p className="text-xs text-gray-400">{product.quantity} vendus</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Low Stock avec statistiques */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">⚠️ Produits en stock faible</h3>
                        <span className="text-xs text-gray-500">{stats.lowStockProducts.length} produit(s)</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {stats.lowStockProducts.length === 0 ? (
                            <p className="p-5 text-gray-400 text-center text-sm">✅ Aucun produit en stock faible</p>
                        ) : (
                            stats.lowStockProducts.map((product, idx) => {
                                let minStock = null
                                if (product.variants?.length) minStock = Math.min(...product.variants.map(v => v.stock).filter(s => s > 0))
                                else if (product.stock !== null) minStock = product.stock
                                return (
                                    <div key={idx} className="p-4 hover:bg-gray-50 transition">
                                        <div className="flex items-center gap-3">
                                            <img src={product.image?.[0]} alt={product.name} className="w-10 h-10 object-cover rounded-md border border-gray-200" />
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800 text-sm">{product.name}</p>
                                                <p className="text-xs text-gray-400">{product.category || product.categories?.[0] || '-'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-semibold text-sm ${minStock === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                                    {minStock === 0 ? 'Épuisé' : `${minStock} restant(s)`}
                                                </p>
                                                <p className="text-xs text-gray-400">⚠️ Réapprovisionner</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Recent Orders */}
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
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(order.createdAt).toLocaleDateString()} à {new Date(order.createdAt).toLocaleTimeString()}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">{order.address.firstName} {order.address.lastName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-red-500">{order.amount.toLocaleString()} {currency}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{order.paymentType === "COD" ? "💰 Paiement à la livraison" : "💳 Paiement en ligne"}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                            order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {order.status === 'Delivered' ? 'Livrée' :
                                             order.status === 'Cancelled' ? 'Annulée' :
                                             order.status === 'Shipped' ? 'Expédiée' :
                                             order.status === 'Out for Delivery' ? 'En livraison' :
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