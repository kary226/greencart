import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const PaymentSuccess = () => {
    const navigate = useNavigate();
    const { axios, setCartItems } = useAppContext();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId') || sessionStorage.getItem('pendingOrderId');
    const [status, setStatus] = useState('waiting');

    useEffect(() => {
        if (!orderId) {
            toast.error('Référence de commande manquante');
            navigate('/cart');
            return;
        }

        const checkPayment = async () => {
            try {
                const { data } = await axios.post(`/api/order/geniuspay/verify`, { orderId });
                if (data.success && data.isPaid) {
                    setStatus('success');
                    setCartItems({});
                    localStorage.removeItem('greencart_cart');
                    sessionStorage.removeItem('pendingOrderId');
                    toast.success('Commande confirmée !');
                    setTimeout(() => navigate('/my-orders'), 2000);
                } else {
                    setStatus('failed');
                    toast.error('Le paiement n\'a pas été finalisé.');
                    sessionStorage.removeItem('pendingOrderId');
                    setTimeout(() => navigate('/cart'), 2000);
                }
            } catch (error) {
                setStatus('failed');
                toast.error('Erreur de vérification.');
                sessionStorage.removeItem('pendingOrderId');
                setTimeout(() => navigate('/cart'), 2000);
            }
        };

        checkPayment();
    }, [orderId]);

    if (status === 'failed') {
        return (
            <div className="mt-32 text-center">
                <div className="bg-red-50 inline-block p-4 rounded-full mb-6">
                    <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-red-600 mb-2">Paiement annulé</h1>
                <p className="text-gray-500 mb-4">Le paiement n'a pas été finalisé.</p>
                <p className="text-gray-400">Redirection vers le panier...</p>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="mt-32 text-center">
                <div className="bg-green-50 inline-block p-4 rounded-full mb-6">
                    <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-green-600 mb-2">Paiement réussi !</h1>
                <p className="text-gray-400">Redirection vers vos commandes...</p>
            </div>
        );
    }

    return (
        <div className="mt-32 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4">Paiement effectué ! Vérification en cours...</p>
            <p className="text-sm text-gray-500 mt-2">Vous allez être redirigé automatiquement.</p>
        </div>
    );
};

export default PaymentSuccess;