import React, { useState } from 'react';
import { Store, Loader2, RefreshCw } from 'lucide-react';

// Écran affiché quand la boutique du commerçant n'a pas pu être chargée.
//
// Ce n'est plus un cul-de-sac : le serveur crée la boutique manquante à la
// demande (cf. GET /api/boutiques/moi), donc un simple « Réessayer » suffit
// dans l'immense majorité des cas. On n'oriente vers l'administrateur qu'en
// dernier recours, avec le message d'erreur réel sous les yeux.
const BoutiqueIndisponible = ({ erreur, onRetry }) => {
    const [enCours, setEnCours] = useState(false);

    const reessayer = async () => {
        setEnCours(true);
        try {
            await onRetry?.();
        } finally {
            setEnCours(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-ink-200 p-12 text-center max-w-lg mx-auto">
            <Store className="mx-auto text-ink-300 mb-3" size={40} />
            <h3 className="text-base font-medium text-ink-800">Boutique indisponible</h3>
            <p className="text-sm text-ink-500 mt-1.5">
                Votre boutique n'a pas pu être chargée. Elle est normalement créée automatiquement
                avec votre compte — réessayez, elle sera rétablie si elle manque.
            </p>
            {erreur && (
                <p className="text-xs text-ink-400 mt-2 break-words">Détail : {erreur}</p>
            )}
            <button
                onClick={reessayer}
                disabled={enCours}
                className="mt-5 inline-flex items-center gap-2 bg-ramses-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition disabled:opacity-50"
            >
                {enCours ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Réessayer
            </button>
            <p className="text-xs text-ink-400 mt-3">
                Si le problème persiste, contactez l'administrateur.
            </p>
        </div>
    );
};

export default BoutiqueIndisponible;
