import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

const PaymentError = () => {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');

    // La redirection automatique au bout de 3 s a été retirée : l'utilisateur
    // vient de rater un paiement, c'est le pire moment pour lui arracher
    // l'écran des mains avant qu'il ait fini de lire. Il repart quand il veut,
    // par l'un des deux boutons.
    useEffect(() => {
        toast.error('Le paiement a échoué ou a été annulé');
    }, []);

    return (
        <div className="max-w-[440px] mx-auto px-4 pt-20 pb-12 text-center" aria-live="polite">
            {/* Teinte `warn` et non rouge : le rouge est réservé à la marque et
                aux actions (DESIGN.md §7), sinon il concurrence « Réessayer ». */}
            <div className="w-16 h-16 rounded-full bg-warn-50 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle size={28} className="text-warn-500" />
            </div>

            <h1 className="rs-h1 mb-2">Paiement échoué</h1>
            <p className="text-[14px] text-ink-500 leading-relaxed mb-6">
                Le paiement a été annulé ou n'a pas abouti. Votre panier est intact — vous pouvez
                réessayer, ou choisir un autre moyen de paiement.
            </p>

            {/* L'identifiant était lu puis jamais utilisé. Il est maintenant
                affiché : c'est la seule information utile si le client doit
                nous écrire au sujet d'un débit. */}
            {orderId && (
                <div className="rs-card mb-6 text-left">
                    <p className="rs-label text-ink-400 mb-1.5">Référence de commande</p>
                    <p className="text-[14px] font-semibold text-ink-900 break-all tabular-nums">{orderId}</p>
                </div>
            )}

            <div className="grid gap-2.5">
                <Link to="/cart" className="rs-btn rs-btn--primary rs-btn--block">
                    Réessayer le paiement
                </Link>
                <Link to="/products" className="rs-btn rs-btn--secondary rs-btn--block">
                    Continuer mes achats
                </Link>
            </div>
        </div>
    );
};

export default PaymentError;
