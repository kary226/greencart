import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';

/**
 * BANDEAU COOKIES
 * ===============
 *
 * Affiché à la première visite, tant qu'aucun choix n'a été fait. Le voile
 * derrière empêche de naviguer sans répondre : c'est ce qui distingue un
 * bandeau qu'on ignore d'un choix qu'on fait.
 *
 * CE QUE LE SITE DÉPOSE RÉELLEMENT — c'est ce qui décide du contenu :
 *
 *   Nécessaires, jamais désactivables
 *     · `token` / `staffToken` — la session. Les refuser, c'est ne plus
 *       pouvoir se connecter ni commander.
 *     · le panier (stockage local) — sinon il se vide à chaque page.
 *
 *   Mesure d'audience, refusables
 *     · Vercel Analytics et Speed Insights — fréquentation et rapidité des
 *       pages. Le site fonctionne exactement pareil sans eux.
 *
 * Le chat Tawk.to ne se charge qu'au clic sur « Aide » : rien n'est déposé
 * pour lui tant que le client ne l'ouvre pas, il n'a donc pas à figurer dans
 * un consentement préalable.
 */

const CLE = 'ramci_cookies_v1';

/** Le visiteur accepte-t-il la mesure d'audience ? */
export const mesureAcceptee = () => {
    try {
        return localStorage.getItem(CLE) === 'tout';
    } catch {
        // Stockage bloqué : on ne mesure pas. Dans le doute, on s'abstient.
        return false;
    }
};

/** Un choix a-t-il déjà été fait ? */
const choixFait = () => {
    try {
        return localStorage.getItem(CLE) !== null;
    } catch {
        // Sans stockage, le choix ne pourrait pas être retenu : reposer la
        // question à chaque page serait insupportable. On n'affiche rien.
        return true;
    }
};

const BandeauCookies = ({ onChoix }) => {
    const [visible, setVisible] = useState(false);

    // Après le premier rendu : lire le stockage pendant le rendu ferait
    // clignoter le bandeau chez ceux qui ont déjà répondu.
    useEffect(() => { setVisible(!choixFait()); }, []);

    const repondre = (valeur) => {
        try { localStorage.setItem(CLE, valeur); } catch { /* rien à retenir */ }
        setVisible(false);
        onChoix?.(valeur === 'tout');
    };

    if (!visible) return null;

    return (
        <>
            {/* Voile : on ne continue pas sans répondre. Volontairement peu
                opaque — le client doit voir qu'il y a un site derrière, pas
                croire à une page d'erreur. */}
            <div className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-[1px]" aria-hidden="true" />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cookies-titre"
                className="fixed z-[91] inset-x-3 bottom-3 sm:inset-x-auto sm:left-5 sm:bottom-5 sm:max-w-sm
                           bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 sm:p-6"
            >
                <div className="flex items-center gap-2.5 mb-3">
                    <span className="w-9 h-9 rounded-full bg-ramses-50 grid place-items-center shrink-0">
                        <Cookie size={18} className="text-ramses-600" />
                    </span>
                    <h2 id="cookies-titre" className="text-[15px] font-semibold text-ink-900">
                        Ce site utilise des cookies
                    </h2>
                </div>

                <p className="text-[13.5px] text-ink-500 leading-relaxed mb-4">
                    Certains sont indispensables pour vous connecter et garder votre
                    panier. D’autres nous servent à mesurer la fréquentation du site.
                    {' '}
                    <Link
                        to="/confidentialite"
                        className="text-ramses-600 underline underline-offset-2 hover:text-ramses-700"
                    >
                        En savoir plus
                    </Link>
                </p>

                <div className="flex flex-col-reverse sm:flex-row gap-2">
                    {/* Refuser reste possible, et discret. Sans ce bouton, le
                        « choix » n'en serait pas un — et la mesure d'audience
                        se ferait sans accord réel. */}
                    <button
                        onClick={() => repondre('necessaires')}
                        className="flex-1 h-11 rounded-xl border border-ink-200 text-ink-700 text-sm font-medium
                                   hover:bg-ink-50 active:bg-ink-100 transition"
                    >
                        Cookies nécessaires uniquement
                    </button>
                    <button
                        onClick={() => repondre('tout')}
                        className="flex-1 h-11 rounded-xl bg-ramses-600 text-white text-sm font-semibold
                                   hover:bg-ramses-700 active:bg-ramses-800 transition"
                        autoFocus
                    >
                        Accepter
                    </button>
                </div>
            </div>
        </>
    );
};

export default BandeauCookies;
