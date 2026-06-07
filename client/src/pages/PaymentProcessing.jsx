import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const PaymentProcessing = () => {
    const navigate = useNavigate();
    const { axios, setCartItems } = useAppContext();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');
    const [status, setStatus] = useState('waiting'); // waiting, success, failed
    const [attempts, setAttempts] = useState(0);
    const maxAttempts = 15; // 15 * 3 secondes = 45 secondes max

    useEffect(() => {
        if (!orderId) {
            toast.error('Aucune référence de commande');
            navigate('/cart');
            return;
        }

        const checkPaymentStatus = async () => {
            try {
                const { data } = await axios.get(`/api/order/${orderId}`);
                
                if (data.success && data.order) {
                    if (data.order.isPaid) {
                        // Paiement réussi !
                        setStatus('success');
                        setCartItems({});
                        localStorage.removeItem('greencart_cart');
                        toast.success('Paiement effectué avec succès !');
                        setTimeout(() => navigate('/my-orders'), 2000);
                        return;
                    }
                }
                
                // Pas encore payé, continuer à vérifier
                setAttempts(prev => prev + 1);
                
                if (attempts + 1 >= maxAttempts) {
                    // Trop de tentatives, échec
                    setStatus('failed');
                    toast.error('Le paiement semble avoir échoué');
                    setTimeout(() => navigate('/cart'), 2000);
                }
            } catch (error) {
                console.error('Erreur vérification:', error);
                setAttempts(prev => prev + 1);
                
                if (attempts + 1 >= maxAttempts) {
                    setStatus('failed');
                    toast.error('Erreur lors de la vérification du paiement');
                    setTimeout(() => navigate('/cart'), 2000);
                }
            }
        };

        // Vérifier toutes les 3 secondes
        const interval = setInterval(() => {
            if (status === 'waiting') {
                checkPaymentStatus();
            }
        }, 3000);

        // Première vérification immédiate
        checkPaymentStatus();

        return () => clearInterval(interval);
    }, [orderId, attempts, status]);

    return (
        <div className="mt-32 text-center">
            <div className="bg-blue-50 inline-block p-4 rounded-full mb-6">
                {status === 'waiting' && (
                    <svg className="w-16 h-16 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                {status === 'success' && (
                    <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                )}
                {status === 'failed' && (
                    <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                )}
            </div>
            
            {status === 'waiting' && (
                <>
                    <h1 className="text-2xl font-bold text-blue-600 mb-2">Paiement en cours...</h1>
                    <p className="text-gray-500 mb-2">Veuillez finaliser le paiement dans l'onglet GeniusPay.</p>
                    <p className="text-gray-400 text-sm">Cette page se mettra à jour automatiquement.</p>
                    <p className="text-gray-400 text-sm mt-4">
                        Après paiement, revenez sur cette page.
                    </p>
                    <div className="mt-6">
                        <button 
                            onClick={() => window.open(`https://geniuspay.ci/checkout/${orderId}`, '_blank')}
                            className="px-4 py-2 bg-primary text-white rounded-lg"
                        >
                            Rouvrir GeniusPay
                        </button>
                    </div>
                </>
            )}
            
            {status === 'success' && (
                <>
                    <h1 className="text-2xl font-bold text-green-600 mb-2">Paiement réussi !</h1>
                    <p className="text-gray-500">Redirection vers vos commandes...</p>
                </>
            )}
            
            {status === 'failed' && (
                <>
                    <h1 className="text-2xl font-bold text-red-600 mb-2">Paiement échoué</h1>
                    <p className="text-gray-500">Redirection vers le panier...</p>
                </>
            )}
        </div>
    );
};

export default PaymentProcessing;