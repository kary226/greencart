import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const PaymentSuccess = () => {
    const navigate = useNavigate();
    const { axios, setCartItems } = useAppContext();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');

    useEffect(() => {
        const confirmOrder = async () => {
            console.log("PaymentSuccess - orderId reçu:", orderId);
            
            if (!orderId) {
                toast.error('Aucune référence de commande trouvée');
                setTimeout(() => navigate('/cart'), 2000);
                return;
            }

            try {
                // Vider le panier localement
                setCartItems({});
                localStorage.removeItem('greencart_cart');
                
                // Confirmer la commande auprès du backend
                const { data } = await axios.post('/api/order/geniuspay/confirm', { 
                    orderId: orderId 
                });
                
                console.log("Réponse confirmation:", data);
                
                if (data.success) {
                    toast.success('Commande confirmée !');
                    setTimeout(() => {
                        navigate('/my-orders');
                    }, 2000);
                } else {
                    toast.error(data.message || 'Erreur lors de la confirmation');
                    setTimeout(() => {
                        navigate('/cart');
                    }, 2000);
                }
            } catch (error) {
                console.error('Erreur confirmation:', error);
                toast.error(error.response?.data?.message || 'Erreur lors de la confirmation');
                setTimeout(() => {
                    navigate('/cart');
                }, 2000);
            }
        };
        
        if (orderId) {
            confirmOrder();
        } else {
            navigate('/cart');
        }
    }, [orderId]);

    return (
        <div className="mt-32 text-center">
            <div className="bg-green-50 inline-block p-4 rounded-full mb-6">
                <svg className="w-16 h-16 text-green-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-600 mb-2">Confirmation en cours...</h1>
            <p className="text-gray-500">Veuillez patienter, nous validons votre commande.</p>
        </div>
    );
};

export default PaymentSuccess;