import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { getPresetImageUrl } from '../utils/cloudinaryImage'
import ReceiptDownloadButton from '../components/ReceiptDownloadButton'
import toast from 'react-hot-toast'
import {
    Package, CreditCard, MapPin, Phone, FileText, Search, SlidersHorizontal,
    X, ChevronDown, Clock, Loader2, Truck, CheckCircle2, XCircle, RotateCcw,
    Headset, ShoppingBag, ArrowUpDown,
} from 'lucide-react'

const FILTERS = [
    { key: 'all', label: 'Toutes' },
    { key: 'pending', label: 'En attente' },
    { key: 'shipped', label: 'Expédiées' },
    { key: 'delivered', label: 'Livrées' },
    { key: 'returned', label: 'Retournées' },
    { key: 'cancelled', label: 'Annulées' },
]

const STATUS_MAP = {
    'Order Placed': { text: 'En attente', color: '#B45309', bg: '#FEF3C7', Icon: Clock },
    'Confirmed': { text: 'Confirmée', color: '#0369A1', bg: '#E0F2FE', Icon: CheckCircle2 },
    'Shipped': { text: 'Expédiée', color: '#7C3AED', bg: '#EDE9FE', Icon: Truck },
    'Out for Delivery': { text: 'En livraison', color: '#DC2626', bg: '#FEE2E2', Icon: Truck },
    'Delivered': { text: 'Livrée', color: '#16A34A', bg: '#DCFCE7', Icon: CheckCircle2 },
    'Returned': { text: 'Retournée', color: '#7C3AED', bg: '#EDE9FE', Icon: RotateCcw },
    'Cancelled': { text: 'Annulée', color: '#6B7280', bg: '#F3F4F6', Icon: XCircle },
}

const FILTER_MATCH = {
    all: () => true,
    pending: (o) => ['Order Placed', 'Confirmed'].includes(o.status),
    shipped: (o) => ['Shipped', 'Out for Delivery'].includes(o.status),
    delivered: (o) => o.status === 'Delivered',
    returned: (o) => o.status === 'Returned',
    cancelled: (o) => o.status === 'Cancelled',
}

const SORTS = [
    { key: 'recent', label: 'Date : plus récente' },
    { key: 'oldest', label: 'Date : plus ancienne' },
    { key: 'amount_desc', label: 'Montant : décroissant' },
    { key: 'amount_asc', label: 'Montant : croissant' },
]

const TRACKER_STEPS = [
    { label: 'Commandée', Icon: Clock },
    { label: 'Confirmée', Icon: CheckCircle2 },
    { label: 'Expédiée', Icon: Package },
    { label: 'En livraison', Icon: Truck },
    { label: 'Livrée', Icon: CheckCircle2 },
]
const STEP_ORDER = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered']

const getPaymentLabel = (order) => {
    if (order.paymentType === 'COD') return 'Paiement à la livraison'
    if (order.paymentType === 'GeniusPay')
        return order.isPaid ? 'Mobile Money — Payé' : 'Mobile Money — En attente'
    return order.paymentType || 'Paiement en ligne'
}

const getItemsSubtotal = (order) =>
    order.items.reduce((sum, item) =>
        sum + ((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity), 0)

const getStatusMessage = (status) => ({
    'Order Placed': 'Votre commande a été enregistrée et est en cours de traitement.',
    'Confirmed': 'Votre commande a été confirmée. Nous la préparons.',
    'Shipped': 'Votre commande a été expédiée.',
    'Out for Delivery': 'Votre commande est en cours de livraison.',
    'Delivered': 'Votre commande a été livrée.',
    'Returned': 'Votre commande a été retournée.',
    'Cancelled': 'Votre commande a été annulée.',
}[status] || '')

const formatDate = (dateString) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
const formatDateShort = (dateString) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Petite pastille de statut réutilisée sur la carte fermée et dans le détail.
const StatusPill = ({ status }) => {
    const st = STATUS_MAP[status] || { text: status, color: '#888', bg: '#f5f5f5', Icon: Clock }
    return (
        <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
            style={{ color: st.color, background: st.bg }}
        >
            {st.text}
        </span>
    )
}

export default function MyOrders() {
    const [myOrders, setMyOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [sort, setSort] = useState('recent')
    const [search, setSearch] = useState('')
    const [expanded, setExpanded] = useState(null)
    const [showFilterSheet, setShowFilterSheet] = useState(false)
    // État brouillon du panneau de filtre — appliqué seulement au clic sur
    // "Voir les résultats", pour ne pas re-filtrer la liste à chaque frappe.
    const [draftFilter, setDraftFilter] = useState('all')
    const [draftSort, setDraftSort] = useState('recent')
    const { currency, axios, user } = useAppContext()
    const location = useLocation()
    const navigate = useNavigate()

    const fetchMyOrders = async () => {
        try {
            const { data } = await axios.get('/api/order/user')
            if (data.success) setMyOrders(data.orders)
        } catch (err) {
            console.log(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user) fetchMyOrders()
    }, [user, location.pathname])

    const openFilterSheet = () => {
        setDraftFilter(filter)
        setDraftSort(sort)
        setShowFilterSheet(true)
    }

    const applyFilterSheet = () => {
        setFilter(draftFilter)
        setSort(draftSort)
        setShowFilterSheet(false)
    }

    const resetFilterSheet = () => {
        setDraftFilter('all')
        setDraftSort('recent')
    }

    const draftCount = useMemo(() => {
        return myOrders.filter(FILTER_MATCH[draftFilter]).filter((o) =>
            !search.trim() || o._id.toLowerCase().includes(search.trim().toLowerCase())
        ).length
    }, [myOrders, draftFilter, search])

    const filtered = useMemo(() => {
        let list = myOrders.filter(FILTER_MATCH[filter])
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            list = list.filter((o) =>
                o._id.toLowerCase().includes(q) ||
                o.items?.some((it) => it.product?.name?.toLowerCase().includes(q))
            )
        }
        const sorted = [...list]
        if (sort === 'recent') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        if (sort === 'oldest') sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        if (sort === 'amount_desc') sorted.sort((a, b) => b.amount - a.amount)
        if (sort === 'amount_asc') sorted.sort((a, b) => a.amount - b.amount)
        return sorted
    }, [myOrders, filter, search, sort])

    const requestCancel = (order) => {
        // [LIMITE] Pas d'endpoint self-service d'annulation côté client pour
        // l'instant — on ne simule pas une action qui n'existe pas réellement,
        // on redirige vers le contact plutôt que d'afficher un faux succès.
        toast('Pour annuler cette commande, contactez notre service client.', { icon: '💬' })
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-burgundy-500" />
            </div>
        )
    }

    if (myOrders.length === 0) {
        return (
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-blush-100 flex items-center justify-center mx-auto mb-5">
                        <ShoppingBag size={40} className="text-burgundy-400" />
                    </div>
                    <h2 className="font-display text-xl font-semibold text-gray-900 mb-1.5">Aucune commande</h2>
                    <p className="text-gray-400 text-sm mb-7">Vous n'avez pas encore passé de commande.</p>
                    <button
                        onClick={() => navigate('/products')}
                        className="bg-burgundy-600 text-white px-7 py-3 rounded-full text-sm font-semibold hover:bg-burgundy-700 transition shadow-md shadow-burgundy-900/10"
                    >
                        Découvrir nos produits
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-ivory-200 pb-24">
            {/* En-tête + recherche + filtre */}
            <div className="bg-white pt-14 pb-3 px-4 border-b border-blush-100">
                <h1 className="font-display text-2xl font-bold text-gray-900 leading-tight">Mes commandes</h1>
                <p className="text-gray-400 text-sm mt-0.5">Suivez toutes vos commandes au même endroit</p>

                <div className="flex items-center gap-2 mt-4">
                    <div className="flex-1 flex items-center gap-2 bg-blush-50 border border-blush-100 rounded-full px-3.5 py-2.5">
                        <Search size={16} className="text-gray-400 shrink-0" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            type="text"
                            placeholder="Rechercher une commande"
                            className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={openFilterSheet}
                        className="relative w-11 h-11 rounded-full bg-blush-50 border border-blush-100 flex items-center justify-center text-burgundy-600 hover:bg-blush-100 transition shrink-0"
                    >
                        <SlidersHorizontal size={17} />
                        {(filter !== 'all' || sort !== 'recent') && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-burgundy-600" />
                        )}
                    </button>
                </div>

                {/* Onglets statut — restent visibles, raccourci pratique en plus du filtre */}
                <div className="flex gap-1 mt-3.5 overflow-x-auto no-scrollbar">
                    {FILTERS.map((f) => {
                        const active = filter === f.key
                        return (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-medium transition mr-1.5 ${
                                    active ? 'bg-burgundy-600 text-white' : 'bg-blush-50 text-gray-500 hover:bg-blush-100'
                                }`}
                            >
                                {f.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Liste des commandes */}
            <div className="px-3 pt-3">
                {filtered.length === 0 && (
                    <div className="text-center py-14 text-gray-400 text-sm">
                        Aucune commande ne correspond à votre recherche.
                    </div>
                )}

                {filtered.map((order) => {
                    const isOpen = expanded === order._id
                    const firstImg = order.items?.[0]?.product?.image?.[0]
                    const itemCount = order.items?.length || 0
                    const itemsSubtotal = getItemsSubtotal(order)
                    const deliveryPrice = order.deliveryPrice || 0
                    const discountAmount = order.discountAmount || 0
                    const couponApplied = order.couponApplied || null

                    const currentStepIndex = STEP_ORDER.indexOf(order.status)
                    const isDelivered = order.status === 'Delivered'
                    const isCancellable = ['Order Placed', 'Confirmed'].includes(order.status)
                    const isClosed = order.status === 'Cancelled' || order.status === 'Returned'

                    const deliveryStart = order.estimatedDeliveryStart ? formatDate(order.estimatedDeliveryStart) : null
                    const deliveryEnd = order.estimatedDeliveryEnd ? formatDate(order.estimatedDeliveryEnd) : null
                    const deliveredAt = order.deliveredAt ? formatDateShort(order.deliveredAt) : null

                    return (
                        <div key={order._id} className="bg-white rounded-2xl mb-3 overflow-hidden shadow-sm shadow-black/[0.03] border border-blush-100/70">
                            <button
                                onClick={() => setExpanded(isOpen ? null : order._id)}
                                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left"
                            >
                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-blush-50 shrink-0">
                                    {firstImg ? (
                                        <img src={firstImg} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center"><Package size={22} className="text-blush-300" /></div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-[13.5px] text-gray-900">#{order._id.slice(-8).toUpperCase()}</span>
                                        <StatusPill status={order.status} />
                                    </div>
                                    <p className="text-gray-400 text-[12px] mt-0.5">
                                        {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {' · '}{itemCount} article{itemCount > 1 ? 's' : ''}
                                    </p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="font-bold text-[15px] text-gray-900">{order.amount.toLocaleString()} {currency}</span>
                                        {isDelivered && deliveredAt ? (
                                            <span className="text-[10.5px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">Livrée le {deliveredAt}</span>
                                        ) : (
                                            deliveryStart && deliveryEnd && (
                                                <span className="text-[10.5px] font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">{deliveryStart} — {deliveryEnd}</span>
                                            )
                                        )}
                                    </div>
                                </div>

                                <ChevronDown size={16} className={`text-gray-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isOpen && (
                                <div className="border-t border-blush-100 px-4 py-4">
                                    {/* Suivi horizontal, façon maquette : icônes + libellés + ligne de progression */}
                                    {!isClosed && (
                                        <div className="mb-5 px-1">
                                            <div className="flex items-start justify-between relative">
                                                {TRACKER_STEPS.map((step, i) => {
                                                    const done = i <= currentStepIndex
                                                    const isLast = i === TRACKER_STEPS.length - 1
                                                    const StepIcon = step.Icon
                                                    return (
                                                        <div key={step.label} className="flex flex-col items-center flex-1 relative">
                                                            {!isLast && (
                                                                <div
                                                                    className="absolute top-3.5 left-1/2 w-full h-[2px] -z-0"
                                                                    style={{ background: i < currentStepIndex ? '#7F1D1D' : '#F3D5D8' }}
                                                                />
                                                            )}
                                                            <div
                                                                className="w-7 h-7 rounded-full flex items-center justify-center relative z-10 shrink-0"
                                                                style={{ background: done ? '#7F1D1D' : '#FCF1F2', color: done ? '#fff' : '#C96E7A' }}
                                                            >
                                                                <StepIcon size={13} />
                                                            </div>
                                                            <span className={`text-[9.5px] mt-1.5 text-center leading-tight max-w-[54px] ${done ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {getStatusMessage(order.status) && (
                                        <p className="text-[13px] text-gray-600 leading-relaxed bg-blush-50 rounded-lg px-3.5 py-2.5 mb-3.5">
                                            {getStatusMessage(order.status)}
                                        </p>
                                    )}

                                    <div className="mb-3.5">
                                        {order.items.map((item, idx2) => (
                                            <div key={idx2} className={`flex gap-2.5 py-2.5 ${idx2 < order.items.length - 1 ? 'border-b border-blush-50' : ''}`}>
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-blush-50 shrink-0">
                                                    {item.product?.image?.[0] ? (
                                                        <img src={getPresetImageUrl(item.product.image[0], "thumbnail")} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-blush-300" /></div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-gray-900 truncate">{item.product?.name || 'Produit indisponible'}</p>
                                                    <div className="flex gap-1 flex-wrap mt-0.5">
                                                        {item.color && item.color !== 'null' && (
                                                            <span className="text-[10px] bg-blush-50 text-gray-500 px-1.5 py-0.5 rounded-full">{item.color}</span>
                                                        )}
                                                        {item.size && item.size !== 'null' && (
                                                            <span className="text-[10px] bg-blush-50 text-gray-500 px-1.5 py-0.5 rounded-full">{item.size}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11.5px] text-gray-400 mt-0.5">
                                                        Qté {item.quantity || 1} × {(item.priceAtOrder || item.product?.offerPrice || 0).toLocaleString()} {currency}
                                                    </p>
                                                </div>
                                                <p className="font-semibold text-[13px] text-gray-900 shrink-0">
                                                    {((item.priceAtOrder || item.product?.offerPrice || 0) * (item.quantity || 1)).toLocaleString()} {currency}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2 text-gray-600 text-[12.5px] bg-blush-50 rounded-lg px-3 py-2 mb-2.5">
                                        <CreditCard size={13} className="text-burgundy-500 shrink-0" />
                                        <span><strong className="text-gray-800">Paiement :</strong> {getPaymentLabel(order)}</span>
                                    </div>

                                    {order.address && (
                                        <div className="bg-blush-50 rounded-lg px-3.5 py-2.5 mb-2.5">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <MapPin size={13} className="text-burgundy-500" />
                                                <span className="text-[12px] font-semibold text-gray-800">Adresse de livraison</span>
                                            </div>
                                            <p className="text-[12px] text-gray-500">{order.address.firstName} {order.address.lastName}</p>
                                            <p className="text-[12px] text-gray-500">{order.address.street}, {order.address.city}</p>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Phone size={11} className="text-gray-400" />
                                                <span className="text-[12px] text-gray-500">{order.address.phone}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-blush-50 rounded-lg px-3.5 py-2.5 mb-3.5">
                                        <div className="flex justify-between text-[12px] text-gray-500 mb-1">
                                            <span>Sous-total</span><span>{itemsSubtotal.toLocaleString()} {currency}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div className="flex justify-between text-[12px] text-emerald-600 mb-1">
                                                <span>Réduction{couponApplied ? ` (${couponApplied})` : ''}</span>
                                                <span>− {discountAmount.toLocaleString()} {currency}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-[12px] text-gray-500 mb-1">
                                            <span>Livraison</span>
                                            <span>{deliveryPrice === 0 ? 'Gratuite' : `${deliveryPrice.toLocaleString()} ${currency}`}</span>
                                        </div>
                                        <div className="flex justify-between text-[14.5px] font-bold text-gray-900 border-t border-blush-200 pt-1.5 mt-0.5">
                                            <span>Total</span><span className="text-burgundy-700">{order.amount.toLocaleString()} {currency}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 flex-wrap">
                                        {isCancellable && (
                                            <button
                                                onClick={() => requestCancel(order)}
                                                className="text-[12.5px] font-medium text-burgundy-600 border border-burgundy-200 rounded-full px-4 py-2 hover:bg-burgundy-50 transition"
                                            >
                                                Annuler la commande
                                            </button>
                                        )}
                                        {isDelivered && (
                                            <ReceiptDownloadButton order={order} currency={currency} />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Panneau de filtres — feuille glissée depuis le bas, façon maquette */}
            {showFilterSheet && (
                <div className="fixed inset-0 z-[200] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilterSheet(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-white border-b border-blush-100">
                            <h3 className="font-semibold text-[15px] text-gray-900">Filtres</h3>
                            <button onClick={() => setShowFilterSheet(false)} className="w-8 h-8 rounded-full bg-blush-50 flex items-center justify-center text-gray-500">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="px-5 py-4">
                            <p className="text-[12.5px] font-semibold text-gray-700 mb-2">Statut</p>
                            <div className="flex flex-wrap gap-2 mb-5">
                                {FILTERS.map((f) => (
                                    <button
                                        key={f.key}
                                        onClick={() => setDraftFilter(f.key)}
                                        className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition ${
                                            draftFilter === f.key ? 'bg-burgundy-600 text-white' : 'bg-blush-50 text-gray-500'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            <p className="text-[12.5px] font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                <ArrowUpDown size={13} /> Trier par
                            </p>
                            <div className="flex flex-col gap-1.5 mb-2">
                                {SORTS.map((s) => (
                                    <button
                                        key={s.key}
                                        onClick={() => setDraftSort(s.key)}
                                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] transition ${
                                            draftSort === s.key ? 'bg-burgundy-600 text-white font-medium' : 'bg-blush-50 text-gray-600'
                                        }`}
                                    >
                                        {s.label}
                                        {draftSort === s.key && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="px-5 pb-6 pt-2 sticky bottom-0 bg-white border-t border-blush-100">
                            <button
                                onClick={applyFilterSheet}
                                className="w-full bg-burgundy-600 text-white rounded-full py-3 text-sm font-semibold hover:bg-burgundy-700 transition mb-2"
                            >
                                Voir les résultats ({draftCount})
                            </button>
                            <button onClick={resetFilterSheet} className="w-full text-center text-[13px] font-medium text-burgundy-600 py-1">
                                Réinitialiser
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}