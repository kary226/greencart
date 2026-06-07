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

    useEffect(() => {
        if (!orderId) {
            toast.error('Aucune référence de commande');
            navigate('/cart');
            return;
        }

        const checkStatus = async () => {
            try {
                const { data } = await axios.get(`/api/order/${orderId}`);
                if (data.success && data.order && data.order.isPaid) {
                    setStatus('success');
                    setCartItems({});
                    localStorage.removeItem('greencart_cart');
                    toast.success('Paiement confirmé !');
                    setTimeout(() => navigate('/my-orders'), 2000);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Erreur vérification:', error);
                return false;
            }
        };

        // Vérification immédiate
        checkStatus().then(paid => {
            if (!paid) {
                // Puis toutes les 3 secondes
                const interval = setInterval(async () => {
                    const paidNow = await checkStatus();
                    if (paidNow) clearInterval(interval);
                }, 3000);
                return () => clearInterval(interval);
            }
        });
    }, [orderId]);

    return (
        <div className="text-center mt-32">
            {status === 'waiting' && (
                <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-lg">En attente de confirmation du paiement...</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Veuillez finaliser le paiement dans l'autre onglet.
                    </p>
                    <button
                        onClick={() => {
                            const savedId = orderId || sessionStorage.getItem('pendingOrderId');
                            if (savedId) {
                                window.open(`https://geniuspay.ci/checkout/${savedId}`, '_blank');
                            }
                        }}
                        className="mt-6 px-4 py-2 bg-primary text-white rounded-lg"
                    >
                        Rouvrir la page de paiement
                    </button>
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