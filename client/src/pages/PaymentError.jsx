import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const PaymentError = () => {
    const navigate = useNavigate();
    const { axios } = useAppContext();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');
    const message = searchParams.get('message') || 'Le paiement a été annulé ou a échoué';

    useEffect(() => {
        const checkOrderStatus = async () => {
            // Si on a un orderId, vérifier le statut de la commande
            if (orderId) {
                try {
                    const { data } = await axios.get(`/api/order/${orderId}`);
                    if (data.success && data.order && data.order.isPaid) {
                        // La commande est payée malgré la redirection vers error
                        toast.success('Votre commande a été validée avec succès !');
                        setTimeout(() => navigate('/my-orders'), 2000);
                        return;
                    }
                } catch (error) {
                    console.error("Erreur vérification commande:", error);
                }
            }
            
            // Sinon, afficher l'erreur
            toast.error(message);
            setTimeout(() => {
                navigate('/cart');
            }, 2500);
        };
        
        checkOrderStatus();
    }, [orderId]);

    return (
        <div className="mt-32 text-center">
            <div className="bg-yellow-50 inline-block p-4 rounded-full mb-6">
                <svg className="w-16 h-16 text-yellow-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
            <h1 className="text-2xl font-bold text-yellow-600 mb-2">Vérification en cours...</h1>
            <p className="text-gray-500">Nous vérifions le statut de votre paiement.</p>
        </div>
    );
};

export default PaymentError;