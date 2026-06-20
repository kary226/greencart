import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { PDFDownloadLink } from '@react-pdf/renderer'
import OrderReceiptPDF from '../components/OrderReceiptPDF'
import { Package, Calendar, CreditCard, MapPin, Phone, FileText, CheckCircle, Truck, PackageCheck, Home, XCircle, Tag, Banknote } from 'lucide-react'

const MyOrders = () => {

    const [myOrders, setMyOrders] = useState([])
    const { currency, axios, user } = useAppContext()
    const location = useLocation()

    const fetchMyOrders = async () => {
        try {
            const { data } = await axios.get('/api/order/user')
            if (data.success) {
                setMyOrders(data.orders)
            }
        } catch (error) {
            console.log(error);
        }
    }

    const getStatusBadge = (status) => {
        const statusMap = {
            'Order Placed': { text: 'Commandée', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Package, step: 1 },
            'Confirmed': { text: 'Confirmée', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle, step: 2 },
            'Shipped': { text: 'Expédiée', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: PackageCheck, step: 3 },
            'Out for Delivery': { text: 'En livraison', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: Truck, step: 4 },
            'Delivered': { text: 'Livrée', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Home, step: 5 },
            'Cancelled': { text: 'Annulée', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle, step: 0 }
        };
        return statusMap[status] || { text: status, color: 'bg-gray-50 text-gray-700 border-gray-200', icon: Package, step: 0 };
    };

    const getStatusMessage = (status) => {
        const messages = {
            'Order Placed': 'Votre commande a été enregistrée et est en cours de traitement.',
            'Confirmed': 'Votre commande a été confirmée. Nous la préparons.',
            'Shipped': 'Votre commande a été expédiée !',
            'Out for Delivery': 'Votre commande est en cours de livraison.',
            'Delivered': 'Votre commande a été livrée. Merci pour votre confiance !',
            'Cancelled': 'Votre commande a été annulée.'
        };
        return messages[status] || '';
    };

    // [FIX] Libellé clair du moyen de paiement. L'ancien code n'affichait
    // que deux cas ("Paiement à la livraison" / "Paiement en ligne"), ce
    // qui ne distinguait pas GeniusPay (mobile money) — pourtant le seul
    // moyen de paiement en ligne utilisé sur la plateforme.
    const getPaymentLabel = (order) => {
        if (order.paymentType === 'COD') return 'Paiement à la livraison';
        if (order.paymentType === 'GeniusPay') {
            return order.isPaid ? 'Mobile Money — Payé' : 'Mobile Money — En attente';
        }
        return order.paymentType || 'Paiement en ligne';
    };

    // [FIX] Sous-total des articles, pour pouvoir afficher le détail
    // (sous-total / livraison / remise / total) au lieu du seul montant
    // final qui mélangeait tout sans explication.
    const getItemsSubtotal = (order) => {
        return order.items.reduce((sum, item) =>
            sum + ((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity), 0);
    };

    useEffect(() => {
        if (user) {
            fetchMyOrders()
        }
    }, [user, location.pathname])

    if (myOrders.length === 0) {
        return (
            <div className="min-h-screen bg-white pt-20 pb-16 px-4">
                <div className="max-w-md mx-auto text-center">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package size={40} className="text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Aucune commande</h2>
                    <p className="text-gray-500 mb-6">Vous n'avez pas encore passé de commande</p>
                    <button 
                        onClick={() => window.location.href = '/products'} 
                        className="bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition shadow-lg"
                    >
                        Découvrir nos produits
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white pt-20 pb-16 px-4">
            <div className="max-w-5xl mx-auto">
                {/* En-tête */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Mes commandes</h1>
                    <div className="w-20 h-1 bg-red-500 rounded-full mt-2"></div>
                    <p className="text-gray-500 mt-2">Suivez l'état de vos commandes</p>
                </div>

                {/* Liste des commandes */}
                <div className="space-y-6">
                    {myOrders.map((order, index) => {
                        const statusBadge = getStatusBadge(order.status);
                        const StatusIcon = statusBadge.icon;
                        const statusMessage = getStatusMessage(order.status);
                        const itemsSubtotal = getItemsSubtotal(order);
                        const deliveryPrice = order.deliveryPrice || 0;
                        const discountAmount = order.discountAmount || 0;
                        const couponApplied = order.couponApplied || null;
                        
                        return (
                            <div key={index} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* En-tête de la commande */}
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                                    <div className="flex flex-wrap justify-between items-center gap-3">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Package size={16} />
                                                <span className="text-sm font-mono">#{order._id.slice(-8)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Calendar size={16} />
                                                <span className="text-sm">{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {/* [FIX] Moyen de paiement visible directement dans l'en-tête,
                                                plus seulement dans une ligne de texte discrète */}
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Banknote size={16} />
                                                <span className="text-sm">{getPaymentLabel(order)}</span>
                                            </div>
                                            <div className="text-lg font-bold text-gray-900">
                                                {order.amount} {currency}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Corps de la commande */}
                                <div className="px-6 py-5">
                                    {/* Statut */}
                                    <div className="mb-6">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`p-1.5 rounded-full ${statusBadge.color.split(' ')[0]} bg-opacity-100`}>
                                                <StatusIcon size={18} className={statusBadge.color.split(' ')[2]?.replace('text-', '')} />
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                                                {statusBadge.text}
                                            </span>
                                            {/* [FIX] Badge coupon visible directement à côté du statut */}
                                            {couponApplied && (
                                                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <Tag size={12} />
                                                    {couponApplied}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {order.status !== 'Cancelled' && (
                                            <div className="mb-3">
                                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                    <div 
                                                        className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                                                        style={{ width: `${(statusBadge.step / 5) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        
                                        {statusMessage && (
                                            <p className="text-sm text-gray-600">{statusMessage}</p>
                                        )}
                                    </div>

                                    {/* Liste des produits */}
                                    <div className="space-y-3 mb-6">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex gap-4 py-3 border-b border-gray-100 last:border-0">
                                                <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                                                    {item.product && item.product.image && item.product.image[0] ? (
                                                        <img src={item.product.image[0]} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                            <Package size={24} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-gray-900">{item.product?.name || 'Produit indisponible'}</h3>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {item.color && item.color !== 'null' && (
                                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                {item.color}
                                                            </span>
                                                        )}
                                                        {item.size && item.size !== 'null' && (
                                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                {item.size}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                                                        <span>Qté : {item.quantity || 1}</span>
                                                        <span>{item.priceAtOrder || item.product?.offerPrice || 0} {currency}/u</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">
                                                        {(item.priceAtOrder || item.product?.offerPrice || 0) * (item.quantity || 1)} {currency}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* [FIX] Récapitulatif du montant : sous-total / remise / livraison / total,
                                        au lieu du seul montant final affiché sans détail dans l'en-tête */}
                                    <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-1.5">
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Sous-total articles</span>
                                            <span>{itemsSubtotal} {currency}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div className="flex justify-between text-sm text-emerald-600">
                                                <span>Réduction{couponApplied ? ` (${couponApplied})` : ''}</span>
                                                <span>− {discountAmount} {currency}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Livraison</span>
                                            <span className={deliveryPrice === 0 ? 'text-green-600' : ''}>
                                                {deliveryPrice === 0 ? 'Gratuit' : `${deliveryPrice} ${currency}`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200 mt-1">
                                            <span>Total payé</span>
                                            <span>{order.amount} {currency}</span>
                                        </div>
                                    </div>

                                    {/* Adresse de livraison */}
                                    {order.address && (
                                        <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <MapPin size={16} className="text-red-500" />
                                                <span className="text-sm font-medium text-gray-700">Adresse de livraison</span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                {order.address.firstName} {order.address.lastName}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                {order.address.street}, {order.address.city}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Phone size={14} className="text-gray-400" />
                                                <span className="text-sm text-gray-600">{order.address.phone}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Bouton PDF */}
                                    <div className="flex justify-end">
                                        <PDFDownloadLink
                                            document={<OrderReceiptPDF order={order} currency={currency} />}
                                            fileName={`facture_${order._id.slice(-8)}.pdf`}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition shadow-sm"
                                        >
                                            {({ loading }) => loading ? (
                                                <span className="text-white">Chargement...</span>
                                            ) : (
                                                <>
                                                    <FileText size={16} className="text-white" />
                                                    <span className="text-white">Télécharger le reçu</span>
                                                </>
                                            )}
                                        </PDFDownloadLink>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    )
}

export default MyOrders