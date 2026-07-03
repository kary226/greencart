import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { PDFDownloadLink } from '@react-pdf/renderer'
import OrderReceiptPDF from '../components/OrderReceiptPDF'
import {
    Package, Calendar, CreditCard, MapPin, Phone, FileText,
    CheckCircle, Truck, PackageCheck, Home, XCircle, Tag,
    Banknote, ChevronRight, ShoppingBag, Clock, RotateCw, CalendarDays
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

const TRACKER_STEPS = ['Commandée', 'Confirmée', 'Expédiée', 'En livraison', 'Livrée', 'Retournée']
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
    'Shipped':          'Votre commande a été expédiée.',
    'Out for Delivery': 'Votre commande est en cours de livraison.',
    'Delivered':        'Votre commande a été livrée.',
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
                            style={{ 
                                background: '#fff', 
                                borderRadius: 12, 
                                marginBottom: 12, 
                                overflow: 'hidden', 
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            }}>

                            <div 
                                onClick={() => setExpanded(isOpen ? null : order._id)}
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 14, 
                                    width: '100%', 
                                    cursor: 'pointer', 
                                    padding: '14px 16px',
                                }}>

                                <div style={{ 
                                    width: 56, 
                                    height: 56, 
                                    borderRadius: 8, 
                                    overflow: 'hidden', 
                                    background: '#F8F8F8', 
                                    flexShrink: 0 
                                }}>
                                    {firstImg
                                        ? <img src={firstImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={24} color="#ccc" /></div>
                                    }
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
                                            #{order._id.slice(-8).toUpperCase()}
                                        </span>
                                        <span style={{
                                            fontSize: 11,
                                            fontWeight: 500,
                                            padding: '2px 10px',
                                            borderRadius: 20,
                                            color: st.color,
                                            background: st.bg,
                                            flexShrink: 0,
                                            marginLeft: 8,
                                        }}>{st.text}</span>
                                    </div>

                                    <p style={{ color: '#888', fontSize: 12, margin: '2px 0' }}>
                                        {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {' • '}{itemCount} article{itemCount > 1 ? 's' : ''}
                                    </p>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                                        <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>
                                            {order.amount} {currency}
                                        </span>
                                        {deliveryStart && deliveryEnd && (
                                            <span style={{ 
                                                fontSize: 11, 
                                                color: '#2563eb', 
                                                fontWeight: 500,
                                                background: '#EFF6FF',
                                                padding: '2px 10px',
                                                borderRadius: 20,
                                            }}>
                                                Livraison {deliveryStart}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <ChevronRight 
                                    size={18} 
                                    color="#ccc" 
                                    style={{ 
                                        flexShrink: 0, 
                                        transform: isOpen ? 'rotate(90deg)' : 'none', 
                                        transition: 'transform .2s' 
                                    }} 
                                />
                            </div>

                            {isOpen && (
                                <div style={{ borderTop: '1px solid #F3F3F3', padding: '16px' }}>

                                    {/* ── Tracker ── */}
                                    {order.status !== 'Cancelled' && (
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                {TRACKER_STEPS.map((label, i) => {
                                                    const done = i <= currentStepIndex
                                                    const isLast = i === TRACKER_STEPS.length - 1

                                                    return (
                                                        <div key={i} style={{ 
                                                            display: 'flex', 
                                                            flexDirection: 'column', 
                                                            alignItems: 'center', 
                                                            flex: 1,
                                                            position: 'relative',
                                                        }}>
                                                            {!isLast && (
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: 10,
                                                                    left: '50%',
                                                                    width: '100%',
                                                                    height: 1.5,
                                                                    background: i < currentStepIndex ? '#DC2626' : '#E5E7EB',
                                                                    zIndex: 0,
                                                                }} />
                                                            )}
                                                            
                                                            <div style={{
                                                                width: 18,
                                                                height: 18,
                                                                borderRadius: '50%',
                                                                background: done ? '#DC2626' : '#F3F4F6',
                                                                border: done ? 'none' : '1.5px solid #E5E7EB',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                zIndex: 1,
                                                                transition: 'all 0.3s ease',
                                                            }}>
                                                                {done && i === currentStepIndex && (
                                                                    <div style={{
                                                                        width: 6,
                                                                        height: 6,
                                                                        borderRadius: '50%',
                                                                        background: '#fff',
                                                                    }} />
                                                                )}
                                                                {done && i < currentStepIndex && (
                                                                    <div style={{
                                                                        width: 10,
                                                                        height: 10,
                                                                        borderRadius: '50%',
                                                                        background: '#fff',
                                                                    }} />
                                                                )}
                                                            </div>
                                                            
                                                            <span style={{
                                                                fontSize: 9,
                                                                color: done ? '#111' : '#9CA3AF',
                                                                fontWeight: done && i === currentStepIndex ? 700 : 400,
                                                                marginTop: 4,
                                                                textAlign: 'center',
                                                                maxWidth: 50,
                                                            }}>
                                                                {label}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Message statut ── */}
                                    {getStatusMessage(order.status) && (
                                        <p style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 1.5, background: '#F8F9FA', padding: '10px 14px', borderRadius: 8 }}>
                                            {getStatusMessage(order.status)}
                                        </p>
                                    )}

                                    {/* ── Articles ── */}
                                    <div style={{ marginBottom: 14 }}>
                                        {order.items.map((item, idx2) => (
                                            <div key={idx2} style={{ display: 'flex', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: idx2 < order.items.length - 1 ? '1px solid #F3F3F3' : 'none' }}>
                                                <div style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', background: '#F8F8F8', flexShrink: 0 }}>
                                                    {item.product?.image?.[0]
                                                        ? <img src={item.product.image[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} color="#ccc" /></div>
                                                    }
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontWeight: 500, fontSize: 13, color: '#111', margin: '0 0 2px' }}>{item.product?.name || 'Produit indisponible'}</p>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        {item.color && item.color !== 'null' && (
                                                            <span style={{ fontSize: 10, background: '#F3F4F6', color: '#555', padding: '1px 6px', borderRadius: 10 }}>{item.color}</span>
                                                        )}
                                                        {item.size && item.size !== 'null' && (
                                                            <span style={{ fontSize: 10, background: '#F3F4F6', color: '#555', padding: '1px 6px', borderRadius: 10 }}>{item.size}</span>
                                                        )}
                                                    </div>
                                                    <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>
                                                        Qté: {item.quantity || 1} × {item.priceAtOrder || item.product?.offerPrice || 0} {currency}
                                                    </p>
                                                </div>
                                                <p style={{ fontWeight: 600, fontSize: 13, color: '#111', margin: 0, flexShrink: 0 }}>
                                                    {(item.priceAtOrder || item.product?.offerPrice || 0) * (item.quantity || 1)} {currency}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ── Moyen de paiement ── */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#666', fontSize: 13, background: '#F8F9FA', padding: '8px 12px', borderRadius: 8 }}>
                                        <CreditCard size={14} color="#6B7280" />
                                        <span><strong>Moyen de paiement :</strong> {getPaymentLabel(order)}</span>
                                    </div>

                                    {/* ── Adresse ── */}
                                    {order.address && (
                                        <div style={{ background: '#F9F9F9', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <MapPin size={14} color="#DC2626" />
                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>Adresse de livraison</span>
                                            </div>
                                            <p style={{ fontSize: 12, color: '#555', margin: '0 0 2px' }}>
                                                {order.address.firstName} {order.address.lastName}
                                            </p>
                                            <p style={{ fontSize: 12, color: '#555', margin: '0 0 2px' }}>
                                                {order.address.street}, {order.address.city}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Phone size={12} color="#9CA3AF" />
                                                <span style={{ fontSize: 12, color: '#555' }}>{order.address.phone}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Total ── */}
                                    <div style={{ background: '#F9F9F9', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 3 }}>
                                            <span>Sous-total</span><span>{itemsSubtotal} {currency}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#16A34A', marginBottom: 3 }}>
                                                <span>Réduction{couponApplied ? ` (${couponApplied})` : ''}</span>
                                                <span>− {discountAmount} {currency}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 3 }}>
                                            <span>Livraison</span>
                                            <span>{deliveryPrice === 0 ? 'Gratuit' : `${deliveryPrice} ${currency}`}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#111', borderTop: '1px solid #E5E7EB', paddingTop: 6 }}>
                                            <span>Total</span><span>{order.amount} {currency}</span>
                                        </div>
                                    </div>

                                    {/* ── PDF ── */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <PDFDownloadLink
                                            document={<OrderReceiptPDF order={order} currency={currency} />}
                                            fileName={`facture_${order._id.slice(-8)}.pdf`}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
                                        >
                                            {({ loading }) => loading ? 'Chargement...' : (
                                                <><FileText size={14} /> Télécharger</>
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