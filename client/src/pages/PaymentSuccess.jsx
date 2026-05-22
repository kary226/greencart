import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const PaymentSuccess = () => {
    const navigate = useNavigate();
    const { axios } = useAppContext();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');

    useEffect(() => {
        const confirmOrder = async () => {
            try {
                const { data } = await axios.post('/api/order/geniuspay/confirm', { orderId });
                if (data.success) {
                    toast.success('Commande confirmée !');
                    setTimeout(() => {
                        navigate('/my-orders');
                    }, 2000);
                } else {
                    toast.error(data.message);
                    setTimeout(() => {
                        navigate('/cart');
                    }, 2000);
                }
            } catch (error) {
                toast.error('Erreur lors de la confirmation');
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
        <div className="mt-16 text-center py-20">
            <div className="text-green-600 text-6xl mb-4 animate-spin">⏳</div>
            <h1 className="text-2xl font-bold mb-2">Confirmation en cours...</h1>
            <p className="text-gray-500">Veuillez patienter</p>
        </div>
    );
};

export default PaymentSuccess;