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
                        backgroundColor: ['#F59E0B', '#3B82F6', '#10B981'],
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
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#10B981',
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
                backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'],
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
                backgroundColor: ['#F59E0B', '#3B82F6', '#8B5CF6', '#F97316', '#10B981', '#EF4444'],
                borderWidth: 0,
            }]
        })
    }

    useEffect(() => {
        fetchDashboardData()
    }, [])

    // Analyse mensuelle (mois sélectionné)
    const selectedMonthRevenue = monthlySalesData[selectedMonth] || 0
    const selectedMonthOrders = allOrders.filter(o => new Date(o.createdAt).getMonth() === selectedMonth).length
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-500">Chargement du tableau de bord...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll">
            <div className="md:p-10 p-4 space-y-6">
                
                {/* En-tête */}
                <div className="flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Tableau de bord</h2>
                        <p className="text-gray-500 text-sm">Vue d'ensemble et analyses avancées</p>
                    </div>
                    <button onClick={fetchDashboardData} className="text-primary hover:bg-primary/10 p-2 rounded-full transition">🔄 Actualiser</button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
                        <p className="text-sm opacity-90">Commandes totales</p>
                        <p className="text-3xl font-bold">{stats.totalOrders}</p>
                    </div>
                    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
                        <p className="text-sm opacity-90">Chiffre d'affaires</p>
                        <p className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} {currency}</p>
                    </div>
                    <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl p-5 text-white shadow-lg">
                        <p className="text-sm opacity-90">Panier moyen</p>
                        <p className="text-2xl font-bold">{Math.round(stats.avgOrderValue).toLocaleString()} {currency}</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
                        <p className="text-sm opacity-90">Taux de livraison</p>
                        <p className="text-2xl font-bold">{Math.round(stats.conversionRate)}%</p>
                    </div>
                </div>

                {/* Analyse mensuelle personnalisée */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">📆 Analyse mensuelle</h3>
                    <div className="flex flex-wrap gap-4 mb-4">
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none"
                        >
                            {monthNames.map((month, idx) => (
                                <option key={idx} value={idx}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4 text-center">
                            <p className="text-sm text-gray-500">Chiffre d'affaires</p>
                            <p className="text-2xl font-bold text-primary">{selectedMonthRevenue.toLocaleString()} {currency}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 text-center">
                            <p className="text-sm text-gray-500">Nombre de commandes</p>
                            <p className="text-2xl font-bold text-primary">{selectedMonthOrders}</p>
                        </div>
                    </div>
                </div>

                {/* Graphiques principaux */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* CA mensuel */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-gray-800">📈 Évolution du CA</h3>
                            {availableYears.length > 0 && (
                                <select 
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="text-sm border border-gray-300 rounded-md px-3 py-1 outline-none"
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
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-4">🥧 Répartition des commandes</h3>
                        <div className="w-64 mx-auto">
                            {statusChartData.datasets && <Doughnut data={statusChartData} options={{ responsive: true }} />}
                        </div>
                    </div>
                </div>

                {/* Deuxième ligne */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Ventes par catégorie */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-4">📊 Ventes par catégorie</h3>
                        {categoryChartData.datasets && <Bar data={categoryChartData} options={{ responsive: true }} />}
                    </div>

                    {/* Moyens de paiement */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-4">💳 Moyens de paiement</h3>
                        <div className="w-64 mx-auto">
                            {paymentChartData.datasets && <Doughnut data={paymentChartData} options={{ responsive: true }} />}
                        </div>
                    </div>
                </div>

                {/* Troisième ligne */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Ventes 7 jours */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-4">📅 Ventes (7 derniers jours)</h3>
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
                                        backgroundColor: '#10B981',
                                        borderRadius: 8,
                                    }]
                                }}
                                options={{ responsive: true }}
                            />
                        )}
                    </div>

                    {/* Top 5 produits */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-4">🏆 Top 5 produits</h3>
                        {topProducts.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">Aucune donnée</p>
                        ) : (
                            <div className="space-y-3">
                                {topProducts.map((product, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">{idx + 1}</div>
                                        {product.image && <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded" />}
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
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="font-semibold text-gray-800">⚠️ Produits en stock faible (≤5)</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {stats.lowStockProducts.length === 0 ? (
                            <p className="p-4 text-gray-400 text-center">✅ Aucun produit en stock faible</p>
                        ) : (
                            stats.lowStockProducts.map((product, idx) => {
                                let minStock = null
                                if (product.variants?.length) minStock = Math.min(...product.variants.map(v => v.stock).filter(s => s > 0))
                                else if (product.stock !== null) minStock = product.stock
                                return (
                                    <div key={idx} className="p-4 hover:bg-gray-50 transition">
                                        <div className="flex items-center gap-3">
                                            <img src={product.image?.[0]} alt={product.name} className="w-12 h-12 object-cover rounded border" />
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
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="font-semibold text-gray-800">📋 Dernières commandes</h3>
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
                                        <p className="font-bold text-primary">{order.amount.toLocaleString()} {currency}</p>
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