import { useState, useEffect } from 'react';
import SEO from '../components/SEO';
import { Cookie, ShieldCheck, RotateCcw } from 'lucide-react';

/**
 * Ce que le site dépose, dit simplement.
 *
 * Le contenu n'est pas générique : chaque ligne correspond à quelque chose
 * qui existe réellement dans le code (cookies de session, panier en
 * stockage local, mesure d'audience Vercel, chat Tawk.to). Une page qui
 * annoncerait des traceurs absents — ou qui en oublierait — serait pire
 * qu'une page absente.
 */

const CLE = 'ramci_cookies_v1';

const Confidentialite = () => {
    const [choix, setChoix] = useState(null);

    useEffect(() => {
        try { setChoix(localStorage.getItem(CLE)); } catch { setChoix(null); }
    }, []);

    const revenirSurLeChoix = () => {
        try { localStorage.removeItem(CLE); } catch { /* rien à retirer */ }
        // Rechargement plutôt qu'un simple état : la mesure d'audience est
        // montée au démarrage de l'application, la retirer proprement en
        // cours de route n'est pas garanti.
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-ink-50">
            <SEO
                title="Confidentialité et cookies | Ramci"
                description="Ce que Ramci enregistre sur votre appareil, pourquoi, et comment revenir sur votre choix."
            />

            <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
                <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-3">
                    Confidentialité et cookies
                </h1>
                <p className="text-ink-500 leading-relaxed mb-10">
                    Voici précisément ce que Ramci enregistre sur votre appareil, et
                    à quoi cela sert. Rien d’autre n’est déposé.
                </p>

                {/* ── Nécessaires ─────────────────────────────────────── */}
                <section className="bg-white rounded-2xl border border-ink-200 p-5 sm:p-6 mb-4">
                    <div className="flex items-center gap-2.5 mb-4">
                        <span className="w-9 h-9 rounded-full bg-ok-50 grid place-items-center shrink-0">
                            <ShieldCheck size={18} className="text-ok-600" />
                        </span>
                        <div>
                            <h2 className="text-[15px] font-semibold text-ink-900">Indispensables</h2>
                            <p className="text-[12px] text-ink-400">Toujours actifs</p>
                        </div>
                    </div>

                    <dl className="space-y-3.5">
                        <div>
                            <dt className="text-sm font-medium text-ink-800">Votre session</dt>
                            <dd className="text-[13.5px] text-ink-500 leading-relaxed">
                                Vous garde connecté d’une page à l’autre. Sans elle, vous
                                devriez saisir votre mot de passe à chaque clic et ne
                                pourriez pas commander.
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-ink-800">Votre panier</dt>
                            <dd className="text-[13.5px] text-ink-500 leading-relaxed">
                                Conservé sur votre appareil pour qu’il ne se vide pas
                                quand vous changez de page ou revenez plus tard.
                            </dd>
                        </div>
                    </dl>

                    <p className="text-[12.5px] text-ink-400 mt-4 pt-4 border-t border-ink-100">
                        Ces éléments ne servent qu’au fonctionnement du site. Ils ne sont
                        transmis à personne et ne servent pas à vous suivre ailleurs.
                    </p>
                </section>

                {/* ── Mesure d'audience ───────────────────────────────── */}
                <section className="bg-white rounded-2xl border border-ink-200 p-5 sm:p-6 mb-4">
                    <div className="flex items-center gap-2.5 mb-4">
                        <span className="w-9 h-9 rounded-full bg-ramses-50 grid place-items-center shrink-0">
                            <Cookie size={18} className="text-ramses-600" />
                        </span>
                        <div>
                            <h2 className="text-[15px] font-semibold text-ink-900">Mesure d’audience</h2>
                            <p className="text-[12px] text-ink-400">Seulement si vous l’acceptez</p>
                        </div>
                    </div>

                    <p className="text-[13.5px] text-ink-500 leading-relaxed">
                        Nous comptons les pages consultées et mesurons leur rapidité, pour
                        savoir ce qui intéresse nos visiteurs et ce qui rame. Ces mesures
                        sont fournies par Vercel, l’hébergeur du site.
                    </p>
                    <p className="text-[13.5px] text-ink-500 leading-relaxed mt-2.5">
                        Si vous refusez, <strong className="text-ink-700">rien n’est chargé</strong> :
                        le site fonctionne exactement de la même façon.
                    </p>
                </section>

                {/* ── Chat ────────────────────────────────────────────── */}
                <section className="bg-white rounded-2xl border border-ink-200 p-5 sm:p-6 mb-8">
                    <h2 className="text-[15px] font-semibold text-ink-900 mb-2">Le chat d’assistance</h2>
                    <p className="text-[13.5px] text-ink-500 leading-relaxed">
                        Notre service client passe par Tawk.to. Il ne se charge{' '}
                        <strong className="text-ink-700">qu’au moment où vous l’ouvrez</strong>,
                        depuis « Contactez-nous » ou « Aide ». Tant que vous ne le faites
                        pas, il ne dépose rien. Si vous êtes connecté, votre prénom et
                        votre adresse e-mail lui sont transmis pour que l’agent sache à
                        qui il parle sans vous le redemander.
                    </p>
                </section>

                {/* ── Revenir sur son choix ───────────────────────────── */}
                <div className="bg-white rounded-2xl border border-ink-200 p-5 sm:p-6">
                    <h2 className="text-[15px] font-semibold text-ink-900 mb-1.5">Votre choix</h2>
                    <p className="text-[13.5px] text-ink-500 mb-4">
                        {choix === 'tout'
                            ? 'Vous avez accepté la mesure d’audience.'
                            : choix === 'necessaires'
                                ? 'Vous n’avez accepté que les cookies indispensables.'
                                : 'Vous n’avez pas encore fait de choix.'}
                    </p>
                    <button
                        onClick={revenirSurLeChoix}
                        className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-ink-200
                                   text-sm font-medium text-ink-700 hover:bg-ink-50 active:bg-ink-100 transition"
                    >
                        <RotateCcw size={15} />
                        Revenir sur mon choix
                    </button>
                </div>

                <p className="text-[12.5px] text-ink-400 mt-8 leading-relaxed">
                    Une question sur vos données ? Écrivez-nous depuis le chat
                    d’assistance, en bas de page.
                </p>
            </div>
        </div>
    );
};

export default Confidentialite;
