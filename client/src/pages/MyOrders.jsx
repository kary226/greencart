import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { PDFDownloadLink } from '@react-pdf/renderer'
import OrderReceiptPDF from '../components/OrderReceiptPDF'

const MyOrders = () => {

    const [myOrders, setMyOrders] = useState([])
    const {currency, axios, user} = useAppContext()
    const location = useLocation()

    const fetchMyOrders = async ()=>{
        try {
            const { data } = await axios.get('/api/order/user')
            if(data.success){
                setMyOrders(data.orders)
            }
        } catch (error) {
            console.log(error);
        }
    }

    // Fonction pour traduire le statut en français
    const getStatusBadge = (status) => {
        const statusMap = {
            'Order Placed': { text: 'Commandée', color: 'bg-blue-100 text-blue-700', step: 1 },
            'Confirmed': { text: 'Confirmée', color: 'bg-green-100 text-green-700', step: 2 },
            'Shipped': { text: 'Expédiée', color: 'bg-purple-100 text-purple-700', step: 3 },
            'Out for Delivery': { text: 'En livraison', color: 'bg-orange-100 text-orange-700', step: 4 },
            'Delivered': { text: 'Livrée', color: 'bg-emerald-100 text-emerald-700', step: 5 },
            'Cancelled': { text: 'Annulée', color: 'bg-red-100 text-red-700', step: 0 }
        };
        return statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-700', step: 0 };
    };

    // Fonction pour obtenir le message de statut
    const getStatusMessage = (status) => {
        const messages = {
            'Order Placed': 'Votre commande a été enregistrée et est en cours de traitement.',
            'Confirmed': 'Votre commande a été confirmée. Nous la préparons.',
            'Shipped': 'Votre commande a été expédiée !',
            'Out for Delivery': 'Votre commande est en cours de livraison.',
            'Delivered': 'Votre commande a été livrée. Merci !',
            'Cancelled': 'Votre commande a été annulée.'
        };
        return messages[status] || '';
    };

    useEffect(()=>{
        if(user){
            fetchMyOrders()
        }
    },[user, location.pathname]) // ← AJOUT DE location.pathname

    return (
        <div className='mt-16 pb-16'>
            <div className='flex flex-col items-end w-max mb-8'>
                <p className='text-2xl font-medium uppercase'>Mes commandes</p>
                <div className='w-16 h-0.5 bg-primary rounded-full'></div>
            </div>
            {myOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-10">Aucune commande pour le moment</p>
            ) : (
                myOrders.map((order, index)=> {
                    const statusBadge = getStatusBadge(order.status);
                    const statusMessage = getStatusMessage(order.status);
                    
                    return (
                        <div key={index} className='border border-gray-300 rounded-lg mb-10 p-4 py-5 max-w-4xl'>
                            {/* En-tête */}
                            <p className='flex justify-between md:items-center text-gray-400 md:font-medium max-md:flex-col gap-2'>
                                <span className="text-xs">📦 Commande : {order._id.slice(-8)}</span>
                                <span>💳 {order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne"}</span>
                                <span>💰 Total : {order.amount} {currency}</span>
                            </p>
                            
                            {/* Statut avec barre de progression */}
                            <div className="mt-4 mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-xs px-3 py-1 rounded-full ${statusBadge.color}`}>
                                        {statusBadge.text}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                {order.status !== 'Cancelled' && (
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                        <div 
                                            className="bg-primary h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${(statusBadge.step / 5) * 100}%` }}
                                        />
                                    </div>
                                )}
                                {statusMessage && (
                                    <p className="text-sm text-gray-600 mt-2">{statusMessage}</p>
                                )}
                            </div>

                            {/* Liste des produits */}
                            {order.items.map((item, idx)=>(
                                <div key={idx}
                                    className={`relative bg-white text-gray-500/70 ${
                                        order.items.length !== idx + 1 && "border-b"
                                    } border-gray-300 flex flex-col md:flex-row md:items-center justify-between p-4 py-5 md:gap-16 w-full max-w-4xl`}>

                                    <div className='flex items-center mb-4 md:mb-0'>
                                        <div className='bg-primary/10 p-4 rounded-lg'>
                                            {item.product && item.product.image && item.product.image[0] ? (
                                                <img src={item.product.image[0]} alt="" className='w-16 h-16 object-cover' />
                                            ) : (
                                                <div className='w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xl'>📦</div>
                                            )}
                                        </div>
                                        <div className='ml-4'>
                                            <h2 className='text-xl font-medium text-gray-800'>{item.product?.name || 'Produit indisponible'}</h2>
                                            <p className="text-sm text-gray-500">Catégorie : {item.product?.category || '-'}</p>
                                            <div className="flex gap-2 mt-1 flex-wrap">
                                                {item.color && item.color !== 'null' && (
                                                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                                        🎨 {item.color}
                                                    </span>
                                                )}
                                                {item.size && item.size !== 'null' && (
                                                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                                        📐 {item.size}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className='flex flex-col justify-center md:ml-8 mb-4 md:mb-0'>
                                        <p>Quantité : {item.quantity || "1"}</p>
                                        <p>Prix unitaire : {(item.priceAtOrder || item.product?.offerPrice || 0)} {currency}</p>
                                    </div>
                                    <p className='text-primary text-lg font-medium'>
                                        {(item.priceAtOrder || item.product?.offerPrice || 0) * (item.quantity || 1)} {currency}
                                    </p>
                                </div>
                            ))}

                            {/* Adresse de livraison */}
                            {order.address && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                    <p className="font-medium text-gray-700 mb-2">📍 Adresse de livraison</p>
                                    <p className="text-sm text-gray-600">
                                        {order.address.firstName} {order.address.lastName}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {order.address.street}, {order.address.city}
                                    </p>
                                    <p className="text-sm text-gray-600">📞 {order.address.phone}</p>
                                </div>
                            )}

                            {/* Bouton PDF */}
                            <div className="mt-4 flex justify-end">
                                <PDFDownloadLink
                                    document={<OrderReceiptPDF order={order} currency={currency} />}
                                    fileName={`facture_${order._id.slice(-8)}.pdf`}
                                    className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition text-sm flex items-center gap-2"
                                >
                                    {({ loading }) => loading ? '⏳ Préparation...' : '📄 Télécharger le reçu'}
                                </PDFDownloadLink>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    )
}

export default MyOrders