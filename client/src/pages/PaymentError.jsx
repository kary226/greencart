import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const PaymentError = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');

    useEffect(() => {
        toast.error('Le paiement a échoué ou a été annulé');
        setTimeout(() => {
            navigate('/cart');
        }, 3000);
    }, []);

    return (
        <div className="mt-32 text-center">
            <div className="bg-red-50 inline-block p-4 rounded-full mb-6">
                <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Paiement échoué</h1>
            <p className="text-gray-500 mb-4">Le paiement a été annulé ou une erreur est survenue.</p>
            <p className="text-gray-400">Redirection vers le panier...</p>
        </div>
    );
};

export default PaymentError;