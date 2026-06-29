import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { PDFDownloadLink } from '@react-pdf/renderer'
import OrderReceiptPDF from '../components/OrderReceiptPDF'
import {
    Package, Calendar, CreditCard, MapPin, Phone, FileText,
    CheckCircle, Truck, PackageCheck, Home, XCircle, Tag,
    Banknote, ChevronRight, ShoppingBag, Clock, Bell
} from 'lucide-react'

const FILTERS = [
    { key: 'all',       label: 'Toutes' },
    { key: 'pending',   label: 'En attente' },
    { key: 'shipped',   label: 'Expédiées' },
    { key: 'delivered', label: 'Livrées' },
    { key: 'cancelled', label: 'Annulées' },
]

const STATUS_MAP = {
    'Order Placed':     { text: 'En attente',   color: '#F97316', bg: '#FFF7ED', step: 1 },
    'Confirmed':        { text: 'Confirmée',    color: '#16A34A', bg: '#F0FDF4', step: 2 },
    'Shipped':          { text: 'Expédiée',     color: '#6366F1', bg: '#EEF2FF', step: 3 },
    'Out for Delivery': { text: 'En livraison', color: '#EA580C', bg: '#FFF7ED', step: 4 },
    'Delivered':        { text: 'Livrée',       color: '#16A34A', bg: '#F0FDF4', step: 5 },
    'Cancelled':        { text: 'Annulée',      color: '#EF4444', bg: '#FEF2F2', step: 0 },
}

const FILTER_MATCH = {
    all:       () => true,
    pending:   (o) => ['Order Placed', 'Confirmed'].includes(o.status),
    shipped:   (o) => ['Shipped', 'Out for Delivery'].includes(o.status),
    delivered: (o) => o.status === 'Delivered',
    cancelled: (o) => o.status === 'Cancelled',
}

const TRACKER_STEPS = [
    { key: 'Order Placed',     label: 'En attente', Icon: ShoppingBag },
    { key: 'Shipped',          label: 'Expédiée',   Icon: Truck },
    { key: 'Out for Delivery', label: 'En cours',   Icon: PackageCheck },
    { key: 'Delivered',        label: 'Livrée',     Icon: CheckCircle },
]

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
    'Cancelled':        'Votre commande a été annulée.',
}[status] || '')

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

    /* ── Empty state ─────────────────────────────────────── */
    if (myOrders.length === 0) {
        return (
            <div style={{ minHeight: '100vh', background: '#F9F9F9', paddingTop: 80, paddingBottom: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '0 24px' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FFF1F1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Package size={36} color="#EF4444" />
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111', margin: 0, lineHeight: 1.2 }}>Mes commandes</h1>
                        <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>Suivez et gérez toutes vos commandes</p>
                    </div>
                    <div style={{ position: 'relative', marginTop: 4 }}>
                        <Bell size={24} color="#222" />
                        <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: '#EF4444', borderRadius: '50%', border: '2px solid #fff' }} />
                    </div>
                </div>

                {/* ── Filtre ─────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 0, marginTop: 20, overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {FILTERS.map(f => {
                        const active = filter === f.key
                        return (
                            <button key={f.key} onClick={() => setFilter(f.key)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: '8px 14px 12px', fontSize: 14, fontWeight: active ? 700 : 500,
                                    color: active ? '#111' : '#999', whiteSpace: 'nowrap',
                                    borderBottom: active ? '2.5px solid #D97706' : '2.5px solid transparent',
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

                {filtered.map((order, idx) => {
                    const st       = STATUS_MAP[order.status] || { text: order.status, color: '#888', bg: '#f5f5f5', step: 0 }
                    const isOpen   = expanded === order._id
                    const firstImg = order.items?.[0]?.product?.image?.[0]
                    const itemCount = order.items?.length || 0
                    const itemsSubtotal  = getItemsSubtotal(order)
                    const deliveryPrice  = order.deliveryPrice || 0
                    const discountAmount = order.discountAmount || 0
                    const couponApplied  = order.couponApplied || null
                    const currentStep    = TRACKER_STEPS.findIndex(s => s.key === order.status)

                    return (
                        <div key={order._id}
                            style={{ background: '#fff', borderRadius: 16, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                            {/* ── Ligne compacte (toujours visible) ───── */}
                            <button onClick={() => setExpanded(isOpen ? null : order._id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px', textAlign: 'left' }}>

                                {/* Miniature */}
                                <div style={{ width: 68, height: 68, borderRadius: 10, overflow: 'hidden', background: '#F8F8F8', flexShrink: 0 }}>
                                    {firstImg
                                        ? <img src={firstImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={28} color="#ccc" /></div>
                                    }
                                </div>

                                {/* Infos */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                        <span style={{ fontWeight: 700, fontSize: 15, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            Commande #{order._id.slice(-8).toUpperCase()}
                                        </span>
                                        {/* Badge statut */}
                                        <span style={{
                                            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                                            color: st.color, background: st.bg,
                                        }}>{st.text}</span>
                                    </div>
                                    <p style={{ color: '#888', fontSize: 13, margin: '3px 0 2px' }}>
                                        {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {' à '}
                                        {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <p style={{ color: '#888', fontSize: 13, margin: '0 0 4px' }}>
                                        {itemCount} article{itemCount > 1 ? 's' : ''}
                                    </p>
                                    <p style={{ fontWeight: 700, fontSize: 15, color: '#111', margin: 0 }}>
                                        {order.amount} {currency}
                                    </p>
                                </div>

                                <ChevronRight size={18} color="#ccc" style={{ flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                            </button>

                            {/* ── Tracker d'étapes ─────────────────────── */}
                            {order.status !== 'Cancelled' && (
                                <div style={{ padding: '4px 16px 16px', borderTop: '1px solid #F3F3F3' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        {TRACKER_STEPS.map((step, i) => {
                                            const done   = st.step >= TRACKER_STEPS.indexOf(step) + 1 || (i === 0 && st.step >= 1)
                                            const active = step.key === order.status ||
                                                (i === 0 && ['Order Placed', 'Confirmed'].includes(order.status))
                                            const color  = done ? '#D97706' : '#D1D5DB'
                                            return (
                                                <React.Fragment key={step.key}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                                        <div style={{
                                                            width: 40, height: 40, borderRadius: '50%',
                                                            background: active ? '#FEF3C7' : done ? '#FEF9EE' : '#F3F4F6',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            border: active ? `2px solid #D97706` : 'none',
                                                        }}>
                                                            <step.Icon size={18} color={done || active ? '#D97706' : '#9CA3AF'} />
                                                        </div>
                                                        <span style={{ fontSize: 11, color: done || active ? '#D97706' : '#9CA3AF', fontWeight: active ? 700 : 500 }}>
                                                            {step.label}
                                                        </span>
                                                    </div>
                                                    {i < TRACKER_STEPS.length - 1 && (
                                                        <div style={{ flex: 1, height: 1.5, background: done ? '#D97706' : '#E5E7EB', marginBottom: 20 }} />
                                                    )}
                                                </React.Fragment>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── Détail expandé ───────────────────────── */}
                            {isOpen && (
                                <div style={{ borderTop: '1px solid #F3F3F3', padding: '16px' }}>

                                    {/* Message statut */}
                                    {getStatusMessage(order.status) && (
                                        <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>
                                            {getStatusMessage(order.status)}
                                        </p>
                                    )}

                                    {/* Coupon */}
                                    {couponApplied && (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ECFDF5', color: '#059669', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, marginBottom: 14 }}>
                                            <Tag size={12} /> {couponApplied}
                                        </div>
                                    )}

                                    {/* Articles */}
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

                                    {/* Récapitulatif montant */}
                                    <div style={{ background: '#F9F9F9', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', marginBottom: 6 }}>
                                            <span>Sous-total articles</span><span>{itemsSubtotal} {currency}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#059669', marginBottom: 6 }}>
                                                <span>Réduction{couponApplied ? ` (${couponApplied})` : ''}</span>
                                                <span>− {discountAmount} {currency}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', marginBottom: 8 }}>
                                            <span>Livraison</span>
                                            <span style={{ color: deliveryPrice === 0 ? '#059669' : '#666' }}>
                                                {deliveryPrice === 0 ? 'Gratuit' : `${deliveryPrice} ${currency}`}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#111', borderTop: '1px solid #E5E7EB', paddingTop: 8 }}>
                                            <span>Total payé</span><span>{order.amount} {currency}</span>
                                        </div>
                                    </div>

                                    {/* Moyen de paiement */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: '#666', fontSize: 13 }}>
                                        <Banknote size={16} color="#9CA3AF" />
                                        <span>{getPaymentLabel(order)}</span>
                                    </div>

                                    {/* Adresse */}
                                    {order.address && (
                                        <div style={{ background: '#F9F9F9', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <MapPin size={15} color="#EF4444" />
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

                                    {/* Bouton PDF */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <PDFDownloadLink
                                            document={<OrderReceiptPDF order={order} currency={currency} />}
                                            fileName={`facture_${order._id.slice(-8)}.pdf`}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#111', color: '#fff', borderRadius: 24, padding: '10px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                                        >
                                            {({ loading }) => loading ? 'Chargement...' : (
                                                <><FileText size={15} /> Télécharger le reçu</>
                                            )}
                                        </PDFDownloadLink>
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