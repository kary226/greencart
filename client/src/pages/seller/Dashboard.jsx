import React, { useEffect, useState } from 'react'
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
                
                // Top 5 produits
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
                
                // Ventes 7 jours
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
                
                // Ventes par jour de semaine
                const weekdaySales = [0, 0, 0, 0, 0, 0, 0]
                orders.forEach(order => {
                    const day = new Date(order.createdAt).getDay()
                    weekdaySales[day] += order.amount
                })
                setWeeklySales(weekdaySales)
                
                // Ventes mensuelles (analyse mois par mois)
                const monthlyAnalysis = Array(12).fill(0)
                orders.forEach(order => {
                    const date = new Date(order.createdAt)
                    const month = date.getMonth()
                    monthlyAnalysis[month] += order.amount
                })
                setMonthlySalesData(monthlyAnalysis)
                
                // Répartition des paiements
                const paymentCount = {
                    COD: 0,
                    Online: 0,
                    GeniusPay: 0
                }
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
                    const category = product.category
                    const amount = (item.priceAtOrder || product.offerPrice) * item.quantity
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

    const selectedMonthRevenue = monthlySalesData[selectedMonth] || 0
    const selectedMonthOrders = allOrders.filter(o => new Date(o.createdAt).getMonth() === selectedMonth).length
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Chargement du tableau de bord...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll bg-gray-50">
            <div className="md:p-8 p-4 space-y-6">
                
                {/* En-tête */}
                <div className="flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Tableau de bord</h2>
                        <p className="text-gray-500 text-sm mt-1">Vue d'ensemble et analyses avancées</p>
                        <div className="w-16 h-0.5 bg-red-500 rounded-full mt-2"></div>
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

                {/* KPI Cards - Thème Noir/Rouge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Commandes totales</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
                            </div>
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="1.8">
                                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                    <line x1="2" y1="10" x2="22" y2="10"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Chiffre d'affaires</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRevenue.toLocaleString()} {currency}</p>
                            </div>
                            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8">
                                    <line x1="12" y1="1" x2="12" y2="23"/>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Panier moyen</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{Math.round(stats.avgOrderValue).toLocaleString()} {currency}</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 6v6l4 2"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Taux de livraison</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{Math.round(stats.conversionRate)}%</p>
                            </div>
                            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8">
                                    <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                                    <path d="M12 2a10 10 0 0 0 0 20"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analyse mensuelle */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4">Analyse mensuelle</h3>
                    <div className="flex flex-wrap gap-4 mb-4">
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="text-sm border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        >
                            {monthNames.map((month, idx) => (
                                <option key={idx} value={idx}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-xl p-5 text-center">
                            <p className="text-sm text-gray-500">Chiffre d'affaires</p>
                            <p className="text-2xl font-bold text-red-500">{selectedMonthRevenue.toLocaleString()} {currency}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-5 text-center">
                            <p className="text-sm text-gray-500">Nombre de commandes</p>
                            <p className="text-2xl font-bold text-gray-900">{selectedMonthOrders}</p>
                        </div>
                    </div>
                </div>

                {/* Graphiques */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* CA mensuel */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-gray-900">Évolution du CA</h3>
                            {availableYears.length > 0 && (
                                <select 
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-red-500"
                                >
                                    {availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        {chartData.datasets && <Line data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />}
                    </div>

                    {/* Répartition des statuts */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Répartition des commandes</h3>
                        <div className="w-64 mx-auto">
                            {statusChartData.datasets && <Doughnut data={statusChartData} options={{ responsive: true }} />}
                        </div>
                    </div>
                </div>

                {/* Deuxième ligne */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Ventes par catégorie */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Ventes par catégorie</h3>
                        {categoryChartData.datasets && <Bar data={categoryChartData} options={{ responsive: true }} />}
                    </div>

                    {/* Moyens de paiement */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Moyens de paiement</h3>
                        <div className="w-64 mx-auto">
                            {paymentChartData.datasets && <Doughnut data={paymentChartData} options={{ responsive: true }} />}
                        </div>
                    </div>
                </div>

                {/* Troisième ligne */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Ventes 7 jours */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
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

                    {/* Top 5 produits */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Top 5 produits</h3>
                        {topProducts.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">Aucune donnée</p>
                        ) : (
                            <div className="space-y-3">
                                {topProducts.map((product, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center font-bold text-white text-sm">{idx + 1}</div>
                                        {product.image && <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-lg" />}
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

                {/* Stock faible */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-semibold text-gray-900">⚠️ Produits en stock faible (≤5)</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {stats.lowStockProducts.length === 0 ? (
                            <p className="p-5 text-gray-400 text-center">Aucun produit en stock faible</p>
                        ) : (
                            stats.lowStockProducts.map((product, idx) => {
                                let minStock = null
                                if (product.variants?.length) minStock = Math.min(...product.variants.map(v => v.stock).filter(s => s > 0))
                                else if (product.stock !== null) minStock = product.stock
                                return (
                                    <div key={idx} className="p-4 hover:bg-gray-50 transition">
                                        <div className="flex items-center gap-3">
                                            <img src={product.image?.[0]} alt={product.name} className="w-12 h-12 object-cover rounded-lg border border-gray-200" />
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800">{product.name}</p>
                                                <p className="text-xs text-gray-500">{product.category}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-semibold ${minStock === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                                    {minStock === 0 ? 'Épuisé' : `${minStock} restant(s)`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Dernières commandes */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Dernières commandes</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {allOrders.slice(0, 5).map((order, idx) => (
                            <div key={idx} className="p-4 hover:bg-gray-50 transition">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-gray-800">#{order._id.slice(-8)}</p>
                                        <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-red-500">{order.amount.toLocaleString()} {currency}</p>
                                        <p className="text-xs text-gray-400">{order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne"}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Dashboard