import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const PaymentSuccess = () => {
    const navigate = useNavigate();
    const { axios, setCartItems } = useAppContext();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');
    const [status, setStatus] = useState('waiting'); // waiting, success, failed

    useEffect(() => {
        if (!orderId) {
            toast.error('Référence de commande manquante');
            navigate('/cart');
            return;
        }

        let timeoutId;
        let intervalId;

        const checkPayment = async () => {
            try {
                const { data } = await axios.get(`/api/order/${orderId}`);
                if (data.success && data.order) {
                    if (data.order.isPaid) {
                        setStatus('success');
                        setCartItems({});
                        localStorage.removeItem('greencart_cart');
                        toast.success('Commande confirmée !');
                        clearTimeout(timeoutId);
                        clearInterval(intervalId);
                        setTimeout(() => navigate('/my-orders'), 2000);
                        return true;
                    }
                }
                return false;
            } catch (error) {
                console.error('Erreur vérification:', error);
                return false;
            }
        };

        // Vérification immédiate
        checkPayment().then(paid => {
            if (!paid) {
                // Polling toutes les 3 secondes
                intervalId = setInterval(async () => {
                    const paidNow = await checkPayment();
                    if (paidNow) {
                        clearInterval(intervalId);
                        clearTimeout(timeoutId);
                    }
                }, 3000);

                // Timeout après 30 secondes : échec
                timeoutId = setTimeout(() => {
                    clearInterval(intervalId);
                    setStatus('failed');
                    toast.error('Le paiement a été annulé ou a expiré');
                    setTimeout(() => navigate(`/payment/error?orderId=${orderId}&message=Paiement+annulé+ou+expiré`), 2000);
                }, 30000);
            }
        });

        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };
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
                <p className="text-gray-500 mb-4">Le paiement n'a pas été finalisé ou a été annulé.</p>
                <p className="text-gray-400">Redirection vers le panier...</p>
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