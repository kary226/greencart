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
            try {
                const { data } = await axios.post('/api/order/geniuspay/confirm', { orderId });
                if (data.success) {
                    setCartItems({});
                    localStorage.removeItem('greencart_cart');
                    toast.success('Commande confirmée !');
                    setTimeout(() => navigate('/my-orders'), 2000);
                } else {
                    toast.error(data.message);
                    setTimeout(() => navigate('/cart'), 2000);
                }
            } catch (error) {
                toast.error('Erreur lors de la confirmation');
                setTimeout(() => navigate('/cart'), 2000);
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-600 mb-2">Confirmation en cours...</h1>
            <p className="text-gray-500">Veuillez patienter, nous validons votre paiement.</p>
        </div>
    );
};

export default PaymentSuccess;