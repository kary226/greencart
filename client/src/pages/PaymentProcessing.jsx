import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const PaymentProcessing = () => {
    const navigate = useNavigate();
    const { axios, setCartItems } = useAppContext();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId') || sessionStorage.getItem('pendingOrderId');
    const [status, setStatus] = useState('waiting');
    const [checkCount, setCheckCount] = useState(0);

    useEffect(() => {
        if (!orderId) {
            toast.error('Aucune référence de commande');
            navigate('/cart');
            return;
        }

        let interval;

        const checkStatus = async () => {
            try {
                const { data } = await axios.get(`/api/order/${orderId}`);
                if (data.success && data.order && data.order.isPaid) {
                    setStatus('success');
                    setCartItems({});
                    localStorage.removeItem('greencart_cart');
                    toast.success('Paiement confirmé !');
                    setTimeout(() => navigate('/my-orders'), 2000);
                    if (interval) clearInterval(interval);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Erreur vérification:', error);
                return false;
            }
        };

        // Vérifier immédiatement
        checkStatus().then(paid => {
            if (!paid) {
                // Vérifier toutes les 3 secondes
                interval = setInterval(async () => {
                    const paidNow = await checkStatus();
                    if (paidNow) clearInterval(interval);
                    setCheckCount(prev => prev + 1);
                }, 3000);
            }
        });

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [orderId]);

    const handlePayNow = () => {
        const geniusUrl = `https://geniuspay.ci/checkout/${orderId}`;
        window.open(geniusUrl, '_blank');
        toast('Onglet de paiement ouvert. Revenez ici après paiement.', { duration: 5000 });
    };

    return (
        <div className="text-center mt-32">
            {status === 'waiting' && (
                <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-lg">En attente de paiement</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Cliquez sur le bouton ci-dessous pour accéder à la page de paiement sécurisée.
                    </p>
                    <button
                        onClick={handlePayNow}
                        className="mt-6 px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition"
                    >
                        Payer maintenant
                    </button>
                    <p className="text-xs text-gray-400 mt-4">
                        Après avoir effectué le paiement, cette page se mettra automatiquement à jour.
                    </p>
                </>
            )}
            {status === 'success' && (
                <>
                    <div className="text-green-600 text-4xl">✓</div>
                    <p className="mt-4 text-lg">Paiement réussi ! Redirection...</p>
                </>
            )}
        </div>
    );
};

export default PaymentProcessing;