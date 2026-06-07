import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const PaymentStatus = () => {
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

        const checkPayment = async () => {
            try {
                const { data } = await axios.get(`/api/order/${orderId}`);
                if (data.success && data.order) {
                    if (data.order.isPaid) {
                        setStatus('success');
                        setCartItems({});
                        localStorage.removeItem('greencart_cart');
                        toast.success('Paiement réussi !');
                        setTimeout(() => navigate('/my-orders'), 2000);
                        return;
                    }
                }
                // Pas encore payé, revérifier dans 3 secondes
                setTimeout(checkPayment, 3000);
            } catch (error) {
                console.error(error);
                setTimeout(checkPayment, 3000);
            }
        };

        checkPayment();
    }, [orderId]);

    return (
        <div className="text-center mt-32">
            {status === 'waiting' && (
                <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-lg">En attente du paiement...</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Si vous n'avez pas encore payé, veuillez finaliser le paiement dans l'autre onglet.
                    </p>
                    <button
                        onClick={() => {
                            const savedOrderId = sessionStorage.getItem('pendingOrderId') || orderId;
                            if (savedOrderId) {
                                window.open(`https://geniuspay.ci/checkout/${savedOrderId}`, '_blank');
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
            {status === 'failed' && (
                <>
                    <div className="text-red-600 text-4xl">✗</div>
                    <p className="mt-4 text-lg">Paiement échoué. Redirection vers le panier...</p>
                </>
            )}
        </div>
    );
};

export default PaymentStatus;