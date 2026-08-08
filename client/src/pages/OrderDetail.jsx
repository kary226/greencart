import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { getPresetImageUrl } from '../utils/cloudinaryImage'
import ReceiptDownloadButton from '../components/ReceiptDownloadButton'
import toast from 'react-hot-toast'
import { ArrowLeft, Package, CreditCard, MapPin, Phone, Headset } from 'lucide-react'

// Mêmes libellés/couleurs que la liste (MyOrders.jsx) — dupliqués ici
// volontairement pour ne pas toucher à ce fichier qui fonctionne déjà.
const STATUS_MAP = {
    'Order Placed': { text: 'En cours', color: '#fff', bg: 'var(--color-ramses-600)' },
    'Confirmed': { text: 'En cours', color: '#fff', bg: 'var(--color-ramses-600)' },
    'Shipped': { text: 'En cours', color: '#fff', bg: 'var(--color-ramses-600)' },
    'Out for Delivery': { text: 'En cours', color: '#fff', bg: 'var(--color-ramses-600)' },
    'Delivered': { text: 'Livrée', color: '#16A34A', bg: '#DCFCE7' },
    'Returned': { text: 'Retournée', color: '#7C3AED', bg: '#EDE9FE' },
    'Cancelled': { text: 'Annulée', color: '#6B7280', bg: '#F3F4F6' },
}

const getPaymentLabel = (order) => {
    if (order.paymentType === 'COD') return 'Paiement à la livraison'
    if (order.paymentType === 'GeniusPay')
        return order.isPaid ? 'Mobile Money — Payé' : 'Mobile Money — En attente'
    return order.paymentType || 'Paiement en ligne'
}

const getItemsSubtotal = (order) =>
    order.items.reduce((sum, item) =>
        sum + ((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity), 0)

const formatDateTime = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
}

export default function OrderDetail() {
    const { orderId } = useParams()
    const { currency, axios, user } = useAppContext()
    const navigate = useNavigate()
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                // On repasse par /api/order/user (qui peuple items.product et
                // address) plutôt que par /api/order/:id, qui ne peuple rien
                // côté serveur — éviter d'afficher une commande cassée.
                const { data } = await axios.get('/api/order/user')
                if (data.success) {
                    const found = data.orders.find((o) => o._id === orderId)
                    setOrder(found || null)
                }
            } catch (err) {
                console.log(err)
            } finally {
                setLoading(false)
            }
        }
        if (user) fetchOrder()
        else setLoading(false)
    }, [user, orderId])

    const requestCancel = () => {
        // [LIMITE] Pas d'endpoint self-service d'annulation côté client pour
        // l'instant — identique à MyOrders.jsx.
        toast('Pour annuler cette commande, contactez notre service client.', { icon: '💬' })
    }

    const requestHelp = () => {
        // [LIMITE] Pas de page/numéro de contact réel branché pour l'instant
        // dans le projet — même logique que requestCancel plutôt que
        // d'inventer un lien qui ne mènerait nulle part.
        toast('Contactez notre service client pour toute question sur cette commande.', { icon: '💬' })
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center gap-3">
                <div className="rs-typing"><span /><span /><span /></div>
                <p className="text-[13px] text-ink-400">Chargement de la commande…</p>
            </div>
        )
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-5">
                        <Package size={32} className="text-ink-400" />
                    </div>
                    <h2 className="rs-h1 mb-2">Commande introuvable</h2>
                    <button onClick={() => navigate('/my-orders')} className="rs-btn rs-btn--primary">
                        Retour à mes commandes
                    </button>
                </div>
            </div>
        )
    }

    const st = STATUS_MAP[order.status] || { text: order.status, color: '#888', bg: '#f5f5f5' }
    const itemsSubtotal = getItemsSubtotal(order)
    const deliveryPrice = order.deliveryPrice || 0
    const isCancellable = ['Order Placed', 'Confirmed'].includes(order.status)
    const isDelivered = order.status === 'Delivered'

    return (
        <div className="min-h-screen bg-ink-50 pb-10">
            {/* ── En-tête ────────────────────────────────────────────────── */}
            <div className="rs-surface flex items-center gap-3 px-4 py-4 border-b border-ink-100">
                <button onClick={() => navigate('/my-orders')} aria-label="Retour" className="rs-icon-btn">
                    <ArrowLeft size={18} />
                </button>
                <h1 className="rs-h1 !mb-0">Détail de la commande</h1>
            </div>

            <div className="p-4 grid gap-4">
                {/* ── En-tête commande ───────────────────────────────────── */}
                <div className="rs-card">
                    <div className="flex items-center justify-between">
                        <p className="font-bold text-[15px] text-ink-900">
                            Commande #{order._id.slice(-8).toUpperCase()}
                        </p>
                        <span
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                            style={{ color: st.color, background: st.bg }}
                        >
                            {st.text}
                        </span>
                    </div>
                    <p className="text-ink-400 text-[12.5px] mt-1">{formatDateTime(order.createdAt)}</p>
                </div>

                {/* ── Articles commandés ─────────────────────────────────── */}
                <div className="rs-card">
                    <p className="font-bold text-[14px] text-ink-900 mb-3">Articles commandés</p>
                    {order.items.map((item, idx) => (
                        <div key={idx} className={`flex gap-3 py-2.5 ${idx < order.items.length - 1 ? 'border-b border-ink-100' : ''}`}>
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-ink-50 shrink-0">
                                {item.product?.image?.[0] ? (
                                    <img src={getPresetImageUrl(item.product.image[0], "thumbnail")} alt="" className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center"><Package size={18} className="text-ink-300" /></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-[13.5px] text-ink-900 leading-snug">
                                    {item.product?.name || 'Produit indisponible'}
                                </p>
                                <p className="text-[12px] text-ink-400 mt-0.5">
                                    {[item.color, item.size].filter((v) => v && v !== 'null').join(' | ')}
                                </p>
                                <p className="text-[13px] font-bold text-ink-900 mt-1 tabular-nums">
                                    {(item.priceAtOrder || item.product?.offerPrice || 0).toLocaleString()} {currency}
                                </p>
                            </div>
                            <p className="text-[12.5px] text-ink-400 shrink-0">x{item.quantity || 1}</p>
                        </div>
                    ))}
                </div>

                {/* ── Résumé de la commande ─────────────────────────────── */}
                <div className="rs-card">
                    <p className="font-bold text-[14px] text-ink-900 mb-3">Résumé de la commande</p>
                    <div className="grid gap-2">
                        <div className="flex justify-between text-[13px] text-ink-600">
                            <span>Sous-total ({order.items.length} article{order.items.length > 1 ? 's' : ''})</span>
                            <span className="tabular-nums">{itemsSubtotal.toLocaleString()} {currency}</span>
                        </div>
                        {order.discountAmount > 0 && (
                            <div className="flex justify-between text-[13px] text-ok-500 font-semibold">
                                <span>Réduction{order.couponApplied ? ` (${order.couponApplied})` : ''}</span>
                                <span className="tabular-nums">− {order.discountAmount.toLocaleString()} {currency}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-[13px] text-ink-600">
                            <span>Frais de livraison</span>
                            <span className="tabular-nums">
                                {deliveryPrice === 0 ? 'Gratuite' : `${deliveryPrice.toLocaleString()} ${currency}`}
                            </span>
                        </div>
                        <div className="flex justify-between items-baseline border-t border-ink-100 pt-2.5 mt-1">
                            <span className="text-[15px] font-bold text-ink-900">Total</span>
                            <span className="text-[18px] font-bold" style={{ color: 'var(--color-ramses-600)' }}>
                                {order.amount.toLocaleString()} {currency}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Détails de livraison ──────────────────────────────── */}
                <div className="rs-card">
                    <p className="font-bold text-[14px] text-ink-900 mb-3">Détails de livraison</p>
                    <div className="grid gap-3">
                        <div className="flex items-start gap-2.5">
                            <CreditCard size={15} className="text-ink-400 shrink-0 mt-0.5" />
                            <span className="text-[13px] text-ink-600">{getPaymentLabel(order)}</span>
                        </div>
                        {order.address && (
                            <div className="flex items-start gap-2.5">
                                <MapPin size={15} className="text-ink-400 shrink-0 mt-0.5" />
                                <div className="text-[13px] text-ink-600 leading-relaxed">
                                    <span className="font-semibold text-ink-900">
                                        {order.address.firstName} {order.address.lastName}
                                    </span>
                                    <br />{order.address.street}
                                    {order.address.communeName ? `, ${order.address.communeName}` : ''}
                                    {order.address.cityName ? `, ${order.address.cityName}` : ''}
                                    <br />{order.address.country}
                                    <br /><span className="inline-flex items-center gap-1 text-ink-400">
                                        <Phone size={11} /> {order.address.phone}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Actions ─────────────────────────────────────────────
                    Le bouton Annuler reste disponible tant que la commande
                    est encore modifiable, exactement comme dans la liste. */}
                <div className="flex items-center gap-2 flex-wrap">
                    {isCancellable && (
                        <button onClick={requestCancel} className="rs-btn rs-btn--secondary flex-1 !min-h-[46px]">
                            Annuler la commande
                        </button>
                    )}
                    {isDelivered && (
                        <div className="flex-1">
                            <ReceiptDownloadButton order={order} currency={currency} />
                        </div>
                    )}
                    <button
                        onClick={requestHelp}
                        className="rs-btn rs-btn--primary flex-1 !min-h-[46px] inline-flex items-center justify-center gap-1.5"
                    >
                        <Headset size={15} /> Besoin d'aide ?
                    </button>
                </div>
            </div>
        </div>
    )
}