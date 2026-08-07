import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { getPresetImageUrl } from '../utils/cloudinaryImage'
import ReceiptDownloadButton from '../components/ReceiptDownloadButton'
import toast from 'react-hot-toast'
import {
    Package, CreditCard, MapPin, Phone, FileText, Search, SlidersHorizontal,
    X, ChevronDown, Clock, Loader2, Truck, CheckCircle2, XCircle, RotateCcw,
    Headset, ShoppingBag, ArrowUpDown, Check,
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
        // Sans cette branche, un visiteur non connecté laissait `loading` à
        // true indéfiniment : la page restait bloquée sur le indicateur de
        // chargement, sans jamais lui dire qu'il devait se connecter.
        else setLoading(false)
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
            <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center gap-3">
                <div className="rs-typing"><span /><span /><span /></div>
                <p className="text-[13px] text-ink-400">Chargement de vos commandes…</p>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-5">
                        <Package size={32} className="text-ink-400" />
                    </div>
                    <h2 className="rs-h1 mb-2">Connectez-vous</h2>
                    <p className="text-ink-400 text-[14px] mb-7 max-w-[280px] mx-auto">
                        Vos commandes et leur suivi vous attendent dans votre compte.
                    </p>
                    <button onClick={() => navigate('/account')} className="rs-btn rs-btn--primary">
                        Accéder à mon compte
                    </button>
                </div>
            </div>
        )
    }

    if (myOrders.length === 0) {
        return (
            <div className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-ramses-50 flex items-center justify-center mx-auto mb-5">
                        <ShoppingBag size={32} className="text-ramses-600" />
                    </div>
                    <h2 className="rs-h1 mb-2">Aucune commande</h2>
                    <p className="text-ink-400 text-[14px] mb-7 max-w-[280px] mx-auto">
                        Vos commandes et leur suivi apparaîtront ici.
                    </p>
                    <button onClick={() => navigate('/products')} className="rs-btn rs-btn--primary">
                        Découvrir nos produits
                    </button>
                </div>
            </div>
        )
    }

    // [Revolut — awesome-design-md] Les listes de transactions se lisent par
    // périodes, pas comme un flux continu : sans en-tête de mois, l'œil n'a
    // aucun point d'ancrage pour se repérer dans un historique long.
    const maintenant = new Date()
    const groupes = []
    for (const order of filtered) {
        const d = new Date(order.createdAt)
        const memeMois = d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear()
        const cle = memeMois
            ? 'Ce mois-ci'
            : d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        const dernier = groupes[groupes.length - 1]
        if (dernier && dernier.cle === cle) dernier.commandes.push(order)
        else groupes.push({ cle, commandes: [order] })
    }

    return (
        <div className="min-h-screen bg-ink-50 pb-24">

            {/* ── En-tête ────────────────────────────────────────────────── */}
            {/* Le sous-titre « Suivez toutes vos commandes au même endroit »
                a été retiré : il n'apprenait rien et poussait la première
                commande hors de l'écran. */}
            <div className="rs-surface pt-6 pb-3 px-4 border-b border-ink-100">
                <h1 className="rs-display">Mes commandes</h1>

                <div className="flex items-center gap-2 mt-4">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            type="text"
                            placeholder="Numéro ou article…"
                            aria-label="Rechercher une commande"
                            className="rs-input rs-input--pill pl-11 pr-10"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                aria-label="Effacer la recherche"
                                className="absolute right-1 top-1/2 -translate-y-1/2 rs-icon-btn !w-9 !h-9"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    {/* Les onglets ci-dessous filtrent déjà par statut : cette
                        feuille ne sert plus qu'au tri, elle ne duplique donc
                        plus le même contrôle à deux endroits. */}
                    <button
                        onClick={openFilterSheet}
                        aria-label="Trier les commandes"
                        className="relative w-11 h-11 rounded-full bg-ink-50 flex items-center justify-center text-ink-600 hover:bg-ink-100 transition shrink-0"
                    >
                        <ArrowUpDown size={17} />
                        {sort !== 'recent' && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-ramses-600" />
                        )}
                    </button>
                </div>

                <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar" role="tablist">
                    {FILTERS.map((f) => {
                        const active = filter === f.key
                        return (
                            <button
                                key={f.key}
                                role="tab"
                                aria-selected={active}
                                onClick={() => setFilter(f.key)}
                                className={`whitespace-nowrap px-4 min-h-[36px] rounded-full text-[13px] font-semibold transition shrink-0 ${
                                    active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                                }`}
                            >
                                {f.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── Liste ──────────────────────────────────────────────────── */}
            <div className="px-3 pt-2">
                {filtered.length === 0 && (
                    <div className="text-center py-16 px-6">
                        <p className="rs-h2 mb-1.5">Aucun résultat</p>
                        <p className="text-[13px] text-ink-400 mb-5">
                            {search ? <>Rien ne correspond à « {search} ».</> : 'Aucune commande dans cette catégorie.'}
                        </p>
                        {(search || filter !== 'all') && (
                            <button
                                onClick={() => { setSearch(''); setFilter('all') }}
                                className="rs-btn rs-btn--secondary"
                            >
                                Tout afficher
                            </button>
                        )}
                    </div>
                )}

                {groupes.map((groupe) => (
                    <section key={groupe.cle}>
                        <h2 className="rs-label text-ink-400 px-2 pt-5 pb-2 first-letter:uppercase">
                            {groupe.cle}
                        </h2>

                        <ul className="grid gap-2.5 list-none p-0 m-0">
                            {groupe.commandes.map((order) => {
                    const isOpen = expanded === order._id
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
                        <li key={order._id} className="rs-card !p-0 overflow-hidden">
                            {/* Ligne repliée — anatomie proche de la réf : en-tête
                                (n° commande + date à gauche, statut à droite),
                                rangée de vignettes des articles, puis nombre
                                d'articles et total sur une ligne dédiée. */}
                            <button
                                onClick={() => setExpanded(isOpen ? null : order._id)}
                                aria-expanded={isOpen}
                                className="w-full text-left hover:bg-ink-50 transition px-3.5 py-3"
                            >
                                <div className="flex items-center justify-between gap-2 mb-2.5">
                                    <div className="min-w-0">
                                        <p className="font-bold text-[14px] text-ink-900 tracking-tight truncate">
                                            Commande #{order._id.slice(-8).toUpperCase()}
                                        </p>
                                        <p className="text-ink-400 text-[12px] mt-0.5">
                                            {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <StatusPill status={order.status} />
                                        <ChevronDown
                                            size={16}
                                            className={`text-ink-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 mb-2.5">
                                    {order.items?.slice(0, 3).map((it, i) => {
                                        const img = it.product?.image?.[0]
                                        return (
                                            <div key={i} className="w-14 h-14 rounded-lg overflow-hidden bg-ink-50 shrink-0">
                                                {img ? (
                                                    <img src={getPresetImageUrl(img, "thumbnail")} alt="" loading="lazy" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package size={16} className="text-ink-300" />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    {itemCount > 3 && (
                                        <div className="w-14 h-14 rounded-lg bg-ink-50 flex items-center justify-center shrink-0">
                                            <span className="text-[13px] font-semibold text-ink-400">+{itemCount - 3}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-ink-400 text-[12.5px]">
                                        {itemCount} article{itemCount > 1 ? 's' : ''}
                                    </span>
                                    <span className="rs-money text-[15px]">
                                        {order.amount.toLocaleString()} {currency}
                                    </span>
                                </div>
                            </button>

                            {isOpen && (
                                <div className="border-t border-ink-100 px-4 py-4">

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
                                                                    style={{ background: i < currentStepIndex ? 'var(--color-ramses-600)' : 'var(--color-ink-100)' }}
                                                                />
                                                            )}
                                                            <div
                                                                className="w-7 h-7 rounded-full flex items-center justify-center relative z-10 shrink-0"
                                                                style={{
                                                                    background: done ? 'var(--color-ramses-600)' : 'var(--color-ink-50)',
                                                                    color: done ? '#fff' : 'var(--color-ink-400)',
                                                                }}
                                                            >
                                                                <StepIcon size={13} />
                                                            </div>
                                                            <span className={`text-[9.5px] mt-1.5 text-center leading-tight max-w-[54px] ${done ? 'text-ink-900 font-semibold' : 'text-ink-400'}`}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Statut en clair + fenêtre de livraison, réunis :
                                        ils disaient la même chose à deux endroits. */}
                                    {(getStatusMessage(order.status) || deliveredAt || (deliveryStart && deliveryEnd)) && (
                                        <div className="mb-4">
                                            {getStatusMessage(order.status) && (
                                                <p className="text-[13px] text-ink-600 leading-relaxed">
                                                    {getStatusMessage(order.status)}
                                                </p>
                                            )}
                                            {isDelivered && deliveredAt ? (
                                                <span className="rs-badge rs-badge--ok mt-2">Livrée le {deliveredAt}</span>
                                            ) : (
                                                deliveryStart && deliveryEnd && (
                                                    <span className="rs-badge rs-badge--info mt-2">
                                                        Livraison estimée {deliveryStart} — {deliveryEnd}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    )}

                                    {/* Articles — séparés par un filet, sans encadré :
                                        le panneau empilait cinq blocs gris les uns sur
                                        les autres, ce qui noyait la hiérarchie. */}
                                    <p className="rs-label text-ink-400 mb-2">Articles</p>
                                    <div className="mb-4">
                                        {order.items.map((item, idx2) => (
                                            <div key={idx2} className={`flex gap-3 py-2.5 ${idx2 < order.items.length - 1 ? 'border-b border-ink-100' : ''}`}>
                                                <div className="w-11 h-11 rounded-lg overflow-hidden bg-ink-50 shrink-0">
                                                    {item.product?.image?.[0] ? (
                                                        <img src={getPresetImageUrl(item.product.image[0], "thumbnail")} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-ink-300" /></div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-[13px] text-ink-900 leading-snug line-clamp-2">
                                                        {item.product?.name || 'Produit indisponible'}
                                                    </p>
                                                    <div className="flex gap-1 flex-wrap mt-1">
                                                        {item.color && item.color !== 'null' && (
                                                            <span className="text-[10px] font-semibold bg-ink-50 text-ink-600 px-2 py-0.5 rounded-full">{item.color}</span>
                                                        )}
                                                        {item.size && item.size !== 'null' && (
                                                            <span className="text-[10px] font-semibold bg-ink-50 text-ink-600 px-2 py-0.5 rounded-full">{item.size}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11.5px] text-ink-400 mt-1 tabular-nums">
                                                        Qté {item.quantity || 1} × {(item.priceAtOrder || item.product?.offerPrice || 0).toLocaleString()} {currency}
                                                    </p>
                                                </div>
                                                <p className="font-bold text-[13px] text-ink-900 shrink-0 tabular-nums">
                                                    {((item.priceAtOrder || item.product?.offerPrice || 0) * (item.quantity || 1)).toLocaleString()} {currency}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Totaux */}
                                    <div className="border-t border-ink-100 pt-3 grid gap-1.5 mb-4">
                                        <div className="flex justify-between text-[12.5px] text-ink-500">
                                            <span>Sous-total</span>
                                            <span className="tabular-nums">{itemsSubtotal.toLocaleString()} {currency}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div className="flex justify-between text-[12.5px] text-ok-500 font-semibold">
                                                <span>Réduction{couponApplied ? ` (${couponApplied})` : ''}</span>
                                                <span className="tabular-nums">− {discountAmount.toLocaleString()} {currency}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-[12.5px] text-ink-500">
                                            <span>Livraison</span>
                                            <span className="tabular-nums">
                                                {deliveryPrice === 0 ? 'Gratuite' : `${deliveryPrice.toLocaleString()} ${currency}`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-baseline border-t border-ink-100 pt-2.5 mt-1">
                                            <span className="text-[14px] font-bold text-ink-900">Total</span>
                                            <span className="rs-money text-[18px]">{order.amount.toLocaleString()} {currency}</span>
                                        </div>
                                    </div>

                                    {/* Paiement et adresse — deux lignes discrètes, plus
                                        deux encadrés gris supplémentaires. */}
                                    <div className="grid gap-2.5 text-[12.5px] mb-4">
                                        <div className="flex items-start gap-2.5">
                                            <CreditCard size={14} className="text-ink-400 shrink-0 mt-0.5" />
                                            <span className="text-ink-600">{getPaymentLabel(order)}</span>
                                        </div>
                                        {order.address && (
                                            <div className="flex items-start gap-2.5">
                                                <MapPin size={14} className="text-ink-400 shrink-0 mt-0.5" />
                                                <div className="text-ink-600 leading-relaxed">
                                                    <span className="font-semibold text-ink-800">
                                                        {order.address.firstName} {order.address.lastName}
                                                    </span>
                                                    <br />{order.address.street}, {order.address.city}
                                                    <br /><span className="inline-flex items-center gap-1 text-ink-400">
                                                        <Phone size={11} /> {order.address.phone}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {(isCancellable || isDelivered) && (
                                        <div className="flex items-center justify-end gap-2 flex-wrap border-t border-ink-100 pt-3.5">
                                            {isCancellable && (
                                                <button onClick={() => requestCancel(order)} className="rs-btn rs-btn--danger !min-h-[40px] text-[13px]">
                                                    Annuler la commande
                                                </button>
                                            )}
                                            {isDelivered && (
                                                <ReceiptDownloadButton order={order} currency={currency} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    )
                            })}
                        </ul>
                    </section>
                ))}
            </div>

            {/* ── Feuille de tri ─────────────────────────────────────────── */}
            {showFilterSheet && (
                <div className="fixed inset-0 z-[200] flex items-end justify-center">
                    <div className="absolute inset-0 bg-ink-900/50" onClick={() => setShowFilterSheet(false)} />
                    <div
                        className="relative w-full max-w-md bg-ink-0 rounded-t-3xl max-h-[85vh] overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Trier les commandes"
                    >
                        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-ink-0 border-b border-ink-100">
                            <h3 className="rs-h1">Trier</h3>
                            <button
                                onClick={() => setShowFilterSheet(false)}
                                aria-label="Fermer"
                                className="rs-icon-btn"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-5 py-4">
                            <div className="grid gap-1.5" role="radiogroup" aria-label="Critère de tri">
                                {SORTS.map((s) => {
                                    const actif = draftSort === s.key
                                    return (
                                        <button
                                            key={s.key}
                                            role="radio"
                                            aria-checked={actif}
                                            onClick={() => setDraftSort(s.key)}
                                            className={`flex items-center justify-between px-4 min-h-[48px] rounded-xl text-[14px] transition ${
                                                actif ? 'bg-ramses-50 text-ramses-700 font-semibold' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
                                            }`}
                                        >
                                            {s.label}
                                            {actif && <Check size={17} />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div
                            className="px-5 pt-2 sticky bottom-0 bg-ink-0 border-t border-ink-100"
                            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
                        >
                            <button onClick={applyFilterSheet} className="rs-btn rs-btn--primary rs-btn--block mb-2">
                                Voir les résultats ({draftCount})
                            </button>
                            <button onClick={resetFilterSheet} className="rs-btn rs-btn--ghost rs-btn--block">
                                Réinitialiser
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}