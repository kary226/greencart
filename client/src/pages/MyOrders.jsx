import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { getPresetImageUrl } from '../utils/cloudinaryImage'
import {
    Package, Search,
    X, ChevronDown, ShoppingBag, ArrowUpDown, Check,
} from 'lucide-react'

const FILTERS = [
    { key: 'all', label: 'Toutes' },
    { key: 'delivered', label: 'Livrées' },
    { key: 'cancelled', label: 'Annulées' },
]

// Couleurs alignées sur la réf fournie : "En cours" en rouge plein
// (regroupe tous les statuts actifs), "Livrée" vert clair, "Annulée" gris clair.
const STATUS_MAP = {
    'Order Placed': { text: 'En cours', color: '#fff', bg: 'var(--color-ramses-600)' },
    'Confirmed': { text: 'En cours', color: '#fff', bg: 'var(--color-ramses-600)' },
    'Shipped': { text: 'En cours', color: '#fff', bg: 'var(--color-ramses-600)' },
    'Out for Delivery': { text: 'En cours', color: '#fff', bg: 'var(--color-ramses-600)' },
    'Delivered': { text: 'Livrée', color: '#16A34A', bg: '#DCFCE7' },
    'Returned': { text: 'Retournée', color: '#7C3AED', bg: '#EDE9FE' },
    'Cancelled': { text: 'Annulée', color: '#6B7280', bg: '#F3F4F6' },
}

const FILTER_MATCH = {
    all: () => true,
    delivered: (o) => o.status === 'Delivered',
    cancelled: (o) => o.status === 'Cancelled',
}

const SORTS = [
    { key: 'recent', label: 'Date : plus récente' },
    { key: 'oldest', label: 'Date : plus ancienne' },
    { key: 'amount_desc', label: 'Montant : décroissant' },
    { key: 'amount_asc', label: 'Montant : croissant' },
]

// Petite pastille de statut réutilisée sur la carte fermée.
const StatusPill = ({ status }) => {
    const st = STATUS_MAP[status] || { text: status, color: '#888', bg: '#f5f5f5' }
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
                o.items?.some((it) => (it.name || it.product?.name)?.toLowerCase().includes(q))
            )
        }
        const sorted = [...list]
        if (sort === 'recent') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        if (sort === 'oldest') sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        if (sort === 'amount_desc') sorted.sort((a, b) => b.amount - a.amount)
        if (sort === 'amount_asc') sorted.sort((a, b) => a.amount - b.amount)
        return sorted
    }, [myOrders, filter, search, sort])

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
                            className="rs-input rs-input--pill rs-input--icon-l rs-input--icon-r"
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
                                const itemCount = order.items?.length || 0

                                return (
                                    <li key={order._id} className="rs-card !p-0 overflow-hidden">
                                        {/* Anatomie proche de la réf : en-tête (n° commande
                                            + date à gauche, statut à droite), rangée de
                                            vignettes des articles, puis nombre d'articles
                                            et total sur une ligne dédiée. Clic → page
                                            détail dédiée (fini l'accordéon). */}
                                        <button
                                            onClick={() => navigate(`/my-orders/${order._id}`)}
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
                                                    <ChevronDown size={16} className="text-ink-300 shrink-0 -rotate-90" />
                                                </div>
                                            </div>

                                            <div className="flex gap-2 mb-2.5">
                                                {order.items?.slice(0, 3).map((it, i) => {
                                                    // Priorité à l'instantané pris à la commande (toujours fiable,
                                                    // même si le produit a été modifié/archivé/supprimé depuis) ;
                                                    // repli sur le produit lié pour les commandes créées avant ce
                                                    // champ (voir models/Order.js).
                                                    const img = it.image || it.product?.image?.[0]
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