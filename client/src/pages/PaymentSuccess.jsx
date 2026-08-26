import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { Check, AlertTriangle, Loader2 } from 'lucide-react';

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

        let intervalId;
        let timeoutId;

        const checkPayment = async () => {
            try {
                const { data } = await axios.get(`/api/order/${orderId}`);
                if (data.success && data.order && data.order.isPaid) {
                    setStatus('success');
                    setCartItems({});
                    localStorage.removeItem('greencart_cart');
                    sessionStorage.removeItem('pendingOrderId');
                    toast.success('Commande confirmée !');
                    clearInterval(intervalId);
                    clearTimeout(timeoutId);
                    setTimeout(() => navigate('/my-orders'), 2000);
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        };

        checkPayment().then(paid => {
            if (!paid) {
                intervalId = setInterval(() => checkPayment(), 3000);
                timeoutId = setTimeout(() => {
                    clearInterval(intervalId);
                    setStatus('failed');
                    toast.error('Le paiement a expiré ou a été annulé');
                    sessionStorage.removeItem('pendingOrderId');
                    setTimeout(() => navigate('/cart'), 2000);
                }, 30000);
            }
        });

        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };
    }, [orderId]);

    // Échec de vérification. L'icône est en `warn` et non en rouge : le rouge
    // est la couleur de marque et des actions (DESIGN.md §7), l'utiliser pour
    // une erreur le mettrait en concurrence avec le bouton « Réessayer ».
    if (status === 'failed') {
        return (
            <div className="max-w-[440px] mx-auto px-4 pt-20 pb-12 text-center" aria-live="polite">
                <div className="w-16 h-16 rounded-full bg-warn-50 flex items-center justify-center mx-auto mb-5">
                    <AlertTriangle size={28} className="text-warn-500" />
                </div>
                <h1 className="rs-h1 mb-2">Paiement non confirmé</h1>
                <p className="text-[14px] text-ink-500 leading-relaxed mb-6">
                    Nous n'avons pas reçu la confirmation de votre paiement. Si votre compte a été
                    débité, contactez-nous avec la référence ci-dessous — rien n'est perdu.
                </p>

                {orderId && (
                    <div className="rs-card mb-6 text-left">
                        <p className="rs-label text-ink-400 mb-1.5">Référence de commande</p>
                        <p className="text-[14px] font-semibold text-ink-900 break-all tabular-nums">{orderId}</p>
                    </div>
                )}

                {/* Une porte de sortie manuelle : la redirection automatique peut
                    échouer, et l'utilisateur ne doit pas rester bloqué ici. */}
                <div className="grid gap-2.5">
                    <Link to="/cart" className="rs-btn rs-btn--primary rs-btn--block">
                        Retourner au panier
                    </Link>
                    <Link to="/my-orders" className="rs-btn rs-btn--secondary rs-btn--block">
                        Voir mes commandes
                    </Link>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="max-w-[440px] mx-auto px-4 pt-20 pb-12 text-center" aria-live="polite">
                <div className="w-16 h-16 rounded-full bg-ok-50 flex items-center justify-center mx-auto mb-5">
                    <Check size={30} className="text-ok-500" strokeWidth={2.5} />
                </div>
                <h1 className="rs-h1 mb-2">Paiement confirmé</h1>
                <p className="text-[14px] text-ink-500 mb-6">
                    Votre commande est enregistrée. Vous allez être redirigé vers vos commandes.
                </p>
                <Link to="/my-orders" className="rs-btn rs-btn--primary rs-btn--block">
                    Voir mes commandes
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-[440px] mx-auto px-4 pt-20 pb-12 text-center" aria-live="polite">
            <div className="w-16 h-16 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-5">
                <Loader2 size={26} className="text-ink-500 animate-spin" />
            </div>
            {/* Le message d'origine annonçait « Paiement effectué ! » AVANT toute
                vérification. C'est précisément ce qu'on ne sait pas encore. */}
            <h1 className="rs-h1 mb-2">Vérification du paiement</h1>
            <p className="text-[14px] text-ink-500 leading-relaxed">
                Cela prend quelques secondes. Ne fermez pas cette page.
            </p>
        </div>
    );
};

export default PaymentSuccess;