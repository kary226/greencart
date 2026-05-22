import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const PaymentError = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');

    useEffect(() => {
        // Afficher l'erreur
        toast.error('Le paiement a échoué ou a été annulé');
        
        // SOLUTION 2 : Vider le token pour forcer une reconnexion propre
        localStorage.removeItem('token');
        
        // Rediriger vers la page d'accueil (au lieu du panier)
        setTimeout(() => {
            navigate('/');
        }, 3000);
    }, [navigate, orderId]);

    return (
        <div className="mt-16 text-center py-20">
            <div className="text-red-600 text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-2">Paiement échoué</h1>
            <p className="text-gray-500">Le paiement a été annulé ou une erreur est survenue.</p>
            <p className="text-gray-400 mt-4">Redirection vers la page d'accueil...</p>
        </div>
    );
};

export default PaymentError;