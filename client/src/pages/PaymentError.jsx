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
        <div className="mt-16 text-center py-20">
            <div className="text-red-600 text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-2">Paiement échoué</h1>
            <p className="text-gray-500">Veuillez réessayer ou choisir un autre moyen de paiement.</p>
            <p className="text-gray-400 mt-4">Redirection vers le panier...</p>
        </div>
    );
};

export default PaymentError;