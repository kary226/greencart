import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { PDFDownloadLink } from '@react-pdf/renderer'
import OrderReceiptPDF from '../components/OrderReceiptPDF'
import {
    Package, Calendar, CreditCard, MapPin, Phone, FileText,
    CheckCircle, Truck, PackageCheck, Home, XCircle, Tag,
    Banknote, ChevronRight, ShoppingBag, Clock, RotateCw, CalendarDays,
    ChevronDown, ChevronUp, Bell, Eye
} from 'lucide-react'

const FILTERS = [
    { key: 'all',       label: 'Toutes' },
    { key: 'pending',   label: 'En attente' },
    { key: 'shipped',   label: 'Expédiées' },
    { key: 'delivered', label: 'Livrées' },
    { key: 'returned',  label: 'Retournées' },
    { key: 'cancelled', label: 'Annulées' },
]

const STATUS_MAP = {
    'Order Placed':     { text: 'En attente',   color: '#B45309', bg: '#FEF3C7', step: 1 },
    'Confirmed':        { text: 'Confirmée',    color: '#0369A1', bg: '#E0F2FE', step: 2 },
    'Shipped':          { text: 'Expédiée',     color: '#7C3AED', bg: '#EDE9FE', step: 3 },
    'Out for Delivery': { text: 'En livraison', color: '#DC2626', bg: '#FEE2E2', step: 4 },
    'Delivered':        { text: 'Livrée',       color: '#16A34A', bg: '#DCFCE7', step: 5 },
    'Returned':         { text: 'Retournée',    color: '#7C3AED', bg: '#EDE9FE', step: 6 },
    'Cancelled':        { text: 'Annulée',      color: '#6B7280', bg: '#F3F4F6', step: 0 },
}

const FILTER_MATCH = {
    all:       () => true,
    pending:   (o) => ['Order Placed', 'Confirmed'].includes(o.status),
    shipped:   (o) => ['Shipped', 'Out for Delivery'].includes(o.status),
    delivered: (o) => o.status === 'Delivered',
    returned:  (o) => o.status === 'Returned',
    cancelled: (o) => o.status === 'Cancelled',
}

// ✅ ÉTAPES DU SUIVI
const TRACKER_STEPS = [
    { key: 'Order Placed', label: 'Commandée', icon: ShoppingBag },
    { key: 'Confirmed',    label: 'Confirmée',  icon: CheckCircle },
    { key: 'Shipped',      label: 'Expédiée',   icon: Truck },
    { key: 'Out for Delivery', label: 'En livraison', icon: PackageCheck },
    { key: 'Delivered',    label: 'Livrée',     icon: Home },
    { key: 'Returned',     label: 'Retournée',  icon: RotateCw },
]

const STEP_ORDER = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Returned']

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
    'Order Placed':     'Votre commande a été enregistrée et est en cours de traitement.',
    'Confirmed':        'Votre commande a été confirmée. Nous la préparons.',
    'Shipped':          'Votre commande a été expédiée !',
    'Out for Delivery': 'Votre commande est en cours de livraison.',
    'Delivered':        'Votre commande a été livrée. Merci pour votre confiance !',
    'Returned':         'Votre commande a été retournée.',
    'Cancelled':        'Votre commande a été annulée.',
}[status] || '')

const formatDate = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    })
}

const formatDateShort = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    })
}

const formatTime = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function MyOrders() {
    const [myOrders, setMyOrders]   = useState([])
    const [filter, setFilter]       = useState('all')
    const [expanded, setExpanded]   = useState(null)
    const { currency, axios, user } = useAppContext()
    const location = useLocation()

    const fetchMyOrders = async () => {
        try {
            const { data } = await axios.get('/api/order/user')
            if (data.success) setMyOrders(data.orders)
        } catch (err) { console.log(err) }
    }

    useEffect(() => {
        if (user) fetchMyOrders()
    }, [user, location.pathname])

    const filtered = myOrders.filter(FILTER_MATCH[filter])

    if (myOrders.length === 0) {
        return (
            <div style={{ minHeight: '100vh', background: '#F9F9F9', paddingTop: 80, paddingBottom: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '0 24px' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Package size={36} color="#DC2626" />
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>Aucune commande</h2>
                    <p style={{ color: '#888', marginBottom: 24 }}>Vous n'avez pas encore passé de commande</p>
                    <button onClick={() => window.location.href = '/products'}
                        style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 24, padding: '12px 28px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                        Découvrir nos produits
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#F2F2F2', paddingBottom: 90 }}>

            {/* ── Header ──────────────────────────────────────── */}
            <div style={{ background: '#fff', padding: '56px 20px 0' }}>
                <div style={{ marginBottom: 4 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111', margin: 0, lineHeight: 1.2 }}>Mes commandes</h1>
                    <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>Suivez et gérez toutes vos commandes</p>
                </div>

                <div style={{ display: 'flex', gap: 0, marginTop: 20, overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {FILTERS.map(f => {
                        const active = filter === f.key
                        return (
                            <button key={f.key} onClick={() => setFilter(f.key)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: '8px 14px 12px', fontSize: 14, fontWeight: active ? 700 : 500,
                                    color: active ? '#111' : '#999', whiteSpace: 'nowrap',
                                    borderBottom: active ? '2.5px solid #DC2626' : '2.5px solid transparent',
                                    transition: 'all .15s',
                                }}>
                                {f.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── Liste ───────────────────────────────────────── */}
            <div style={{ padding: '12px 12px 0' }}>
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: '#aaa', fontSize: 15 }}>
                        Aucune commande dans cette catégorie
                    </div>
                )}

                {filtered.map((order) => {
                    const st            = STATUS_MAP[order.status] || { text: order.status, color: '#888', bg: '#f5f5f5', step: 0 }
                    const isOpen        = expanded === order._id
                    const firstImg      = order.items?.[0]?.product?.image?.[0]
                    const itemCount     = order.items?.length || 0
                    const itemsSubtotal  = getItemsSubtotal(order)
                    const deliveryPrice  = order.deliveryPrice || 0
                    const discountAmount = order.discountAmount || 0
                    const couponApplied  = order.couponApplied || null

                    const currentStepIndex = STEP_ORDER.indexOf(order.status)

                    const deliveryStart = order.estimatedDeliveryStart ? formatDate(order.estimatedDeliveryStart) : null
                    const deliveryEnd = order.estimatedDeliveryEnd ? formatDate(order.estimatedDeliveryEnd) : null

                    return (
                        <div key={order._id}
                            style={{ background: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                            {/* ── Ligne compacte ───────────────────────── */}
                            <div 
                                onClick={() => setExpanded(isOpen ? null : order._id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', cursor: 'pointer', padding: '14px 16px' }}>

                                <div style={{ width: 68, height: 68, borderRadius: 10, overflow: 'hidden', background: '#F8F8F8', flexShrink: 0 }}>
                                    {firstImg
                                        ? <img src={firstImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={28} color="#ccc" /></div>
                                    }
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                        <div>
                                            <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>
                                                Commande #{order._id.slice(-8).toUpperCase()}
                                            </span>
                                            {/* ✅ Badge statut */}
                                            <span style={{
                                                display: 'inline-block',
                                                fontSize: 11,
                                                fontWeight: 600,
                                                padding: '2px 10px',
                                                borderRadius: 20,
                                                marginLeft: 8,
                                                color: st.color,
                                                background: st.bg,
                                            }}>{st.text}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>
                                                {order.amount} {currency}
                                            </span>
                                            <ChevronRight size={18} color="#ccc" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                                        </div>
                                    </div>

                                    <p style={{ color: '#888', fontSize: 12, margin: '2px 0' }}>
                                        {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {' à '}
                                        {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        {' • '}{itemCount} article{itemCount > 1 ? 's' : ''}
                                    </p>

                                    {/* ✅ Livraison estimée */}
                                    {deliveryStart && deliveryEnd && (
                                        <p style={{ 
                                            display: 'inline-flex',
                                            alignItems: 'center', 
                                            gap: 4, 
                                            fontSize: 12, 
                                            color: '#2563eb', 
                                            fontWeight: 500,
                                            margin: '2px 0 0',
                                            background: '#EFF6FF',
                                            padding: '2px 10px',
                                            borderRadius: 20,
                                        }}>
                                            <CalendarDays size={13} />
                                            Livraison prévue du {deliveryStart} au {deliveryEnd}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* ── Détails expandés ───────────────────────── */}
                            {isOpen && (
                                <div style={{ borderTop: '1px solid #F3F3F3', padding: '16px' }}>

                                    {/* ── Tracker de suivi modernisé ── */}
                                    {order.status !== 'Cancelled' && (
                                        <div style={{ marginBottom: 16, padding: '0 4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                                                {TRACKER_STEPS.map((step, i) => {
                                                    const stepIndex = STEP_ORDER.indexOf(step.key)
                                                    const done      = stepIndex <= currentStepIndex
                                                    const active    = step.key === order.status
                                                    const isLast    = i === TRACKER_STEPS.length - 1

                                                    return (
                                                        <React.Fragment key={step.key}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                                                                <div style={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    borderRadius: '50%',
                                                                    background: done ? '#DC2626' : '#E5E7EB',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    border: active ? '2px solid #DC2626' : 'none',
                                                                    boxShadow: active ? '0 0 0 3px #FEE2E2' : 'none',
                                                                    transition: 'all 0.3s ease'
                                                                }}>
                                                                    {done ? (
                                                                        <CheckCircle size={16} color="#fff" />
                                                                    ) : (
                                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D1D5DB' }} />
                                                                    )}
                                                                </div>
                                                                <span style={{
                                                                    fontSize: 9,
                                                                    color: done ? '#111' : '#9CA3AF',
                                                                    fontWeight: active ? 700 : 400,
                                                                    textAlign: 'center'
                                                                }}>
                                                                    {step.label}
                                                                </span>
                                                                {!isLast && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: 14,
                                                                        left: `calc(${i * 20}% + 16px)`,
                                                                        width: `calc(${100 / TRACKER_STEPS.length}% - 32px)`,
                                                                        height: 2,
                                                                        background: STEP_ORDER.indexOf(TRACKER_STEPS[i + 1].key) <= currentStepIndex ? '#DC2626' : '#E5E7EB',
                                                                    }} />
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Message statut ── */}
                                    {getStatusMessage(order.status) && (
                                        <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.5, background: '#F8F9FA', padding: '10px 14px', borderRadius: 8 }}>
                                            {getStatusMessage(order.status)}
                                        </p>
                                    )}

                                    {/* ── Détails produit ── */}
                                    <div style={{ marginBottom: 16 }}>
                                        {order.items.map((item, idx2) => (
                                            <div key={idx2} style={{ display: 'flex', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: idx2 < order.items.length - 1 ? '1px solid #F3F3F3' : 'none' }}>
                                                <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: '#F8F8F8', flexShrink: 0 }}>
                                                    {item.product?.image?.[0]
                                                        ? <img src={item.product.image[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={20} color="#ccc" /></div>
                                                    }
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontWeight: 600, fontSize: 14, color: '#111', margin: '0 0 4px' }}>{item.product?.name || 'Produit indisponible'}</p>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                        {item.color && item.color !== 'null' && (
                                                            <span style={{ fontSize: 11, background: '#F3F4F6', color: '#555', padding: '2px 8px', borderRadius: 12 }}>{item.color}</span>
                                                        )}
                                                        {item.size && item.size !== 'null' && (
                                                            <span style={{ fontSize: 11, background: '#F3F4F6', color: '#555', padding: '2px 8px', borderRadius: 12 }}>{item.size}</span>
                                                        )}
                                                    </div>
                                                    <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
                                                        Qté : {item.quantity || 1} · {item.priceAtOrder || item.product?.offerPrice || 0} {currency}/u
                                                    </p>
                                                </div>
                                                <p style={{ fontWeight: 700, fontSize: 14, color: '#111', margin: 0, flexShrink: 0 }}>
                                                    {(item.priceAtOrder || item.product?.offerPrice || 0) * (item.quantity || 1)} {currency}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ── Récapitulatif ── */}
                                    <div style={{ background: '#F9F9F9', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', marginBottom: 4 }}>
                                            <span>Sous-total</span><span>{itemsSubtotal} {currency}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16A34A', marginBottom: 4 }}>
                                                <span>Réduction{couponApplied ? ` (${couponApplied})` : ''}</span>
                                                <span>− {discountAmount} {currency}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', marginBottom: 4 }}>
                                            <span>Livraison</span>
                                            <span style={{ color: deliveryPrice === 0 ? '#16A34A' : '#666' }}>
                                                {deliveryPrice === 0 ? 'Gratuit' : `${deliveryPrice} ${currency}`}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#111', borderTop: '1px solid #E5E7EB', paddingTop: 8 }}>
                                            <span>Total</span><span>{order.amount} {currency}</span>
                                        </div>
                                    </div>

                                    {/* ── Paiement ── */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#666', fontSize: 13 }}>
                                        <Banknote size={16} color="#9CA3AF" />
                                        <span>{getPaymentLabel(order)}</span>
                                    </div>

                                    {/* ── Adresse ── */}
                                    {order.address && (
                                        <div style={{ background: '#F9F9F9', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <MapPin size={15} color="#DC2626" />
                                                <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Adresse de livraison</span>
                                            </div>
                                            <p style={{ fontSize: 13, color: '#555', margin: '0 0 2px' }}>
                                                {order.address.firstName} {order.address.lastName}
                                            </p>
                                            <p style={{ fontSize: 13, color: '#555', margin: '0 0 4px' }}>
                                                {order.address.street}, {order.address.city}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Phone size={13} color="#9CA3AF" />
                                                <span style={{ fontSize: 13, color: '#555' }}>{order.address.phone}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Actions ── */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => window.location.href = '/products'}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F3F4F6', color: '#555', border: 'none', borderRadius: 20, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                                            >
                                                <ShoppingBag size={14} /> Commander à nouveau
                                            </button>
                                        </div>
                                        <PDFDownloadLink
                                            document={<OrderReceiptPDF order={order} currency={currency} />}
                                            fileName={`facture_${order._id.slice(-8)}.pdf`}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', borderRadius: 20, padding: '8px 16px', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
                                        >
                                            {({ loading }) => loading ? 'Chargement...' : (
                                                <><FileText size={14} /> Télécharger</>
                                            )}
                                        </PDFDownloadLink>
                                    </div>

                                    {/* ── Bouton notification ── */}
                                    <div style={{ marginTop: 12, padding: '8px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Bell size={14} color="#64748B" />
                                            <span style={{ fontSize: 12, color: '#64748B' }}>Restez informé de l'avancement</span>
                                        </div>
                                        <button style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                            Activer
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}