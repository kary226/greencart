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
        const confirm = async () => {
            if (!orderId) {
                navigate('/cart');
                return;
            }
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
                toast.error('Erreur');
                setTimeout(() => navigate('/cart'), 2000);
            }
        };
        confirm();
    }, []);

    return (
        <div className="text-center mt-32">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4">Confirmation en cours...</p>
        </div>
    );
};

export default PaymentSuccess;