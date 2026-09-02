import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Loader2, RefreshCw, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, Eye,
} from 'lucide-react';

/**
 * CONSOLE — « Ce que je dois faire maintenant »   (guide RAMCI §14)
 * =================================================================
 * « Chaque acteur doit d'abord voir ce qu'il doit faire MAINTENANT. Les
 * détails techniques restent secondaires. »
 *
 * Le tableau de bord existant montre des CHIFFRES (chiffre d'affaires,
 * volumes, KPIs) : utile pour piloter, inutile pour savoir par quoi
 * commencer sa journée. Un Admin Finance devait ouvrir quatre pages pour
 * découvrir qu'il avait trois retraits en attente.
 *
 * Cette page ne montre que des ACTIONS, et uniquement celles que les
 * permissions du compte connecté autorisent — la liste vient du serveur
 * (`/api/console`), qui la construit à partir des permissions réelles et
 * non du rôle affiché. §16 : « le frontend masque ; le backend protège ».
 */

/** Un domaine = une couleur et un nom. Les mêmes partout, pour être lisibles d'un coup d'œil. */
const DOMAINES = {
    direction: { libelle: 'Direction', classe: 'bg-purple-50 text-purple-700 border-purple-200' },
    finance: { libelle: 'Finance', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    operations: { libelle: 'Opérations', classe: 'bg-blue-50 text-blue-700 border-blue-200' },
    support: { libelle: 'Support', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
    catalogue: { libelle: 'Catalogue', classe: 'bg-slate-50 text-slate-700 border-slate-200' },
    commercant: { libelle: 'Ma boutique', classe: 'bg-teal-50 text-teal-700 border-teal-200' },
};

const Console = () => {
    const { axios } = useAppContext();
    const [donnees, setDonnees] = useState(null);
    const [chargement, setChargement] = useState(true);

    const charger = async ({ silencieux = false } = {}) => {
        if (!silencieux) setChargement(true);
        try {
            const { data } = await axios.get('/api/console');
            if (data.success) setDonnees(data);
            else toast.error(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setChargement(false);
        }
    };

    useEffect(() => {
        charger();
        // Rafraîchissement discret : un retrait déposé pendant qu'on regarde
        // l'écran doit apparaître sans qu'on pense à recharger. 60 s suffit —
        // plus court, on rechargerait pour rien.
        const minuterie = setInterval(() => charger({ silencieux: true }), 60_000);
        return () => clearInterval(minuterie);
    }, []);

    if (chargement) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!donnees) return null;

    const { acteur, taches, message, surveillance = [] } = donnees;
    const urgentes = taches.filter((t) => t.urgence === 'haute');
    const autres = taches.filter((t) => t.urgence !== 'haute');

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">

            {/* En-tête : qui je suis, et ce que couvre mon rôle. Le libellé
                vient de configs/roles.js — plus aucun écran ne dit « Seller ». */}
            <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                            Bonjour {acteur.nom}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            <span className="font-medium text-gray-700">{acteur.roleLibelle}</span>
                            {acteur.description ? ` — ${acteur.description}` : ''}
                        </p>
                    </div>
                    <button
                        onClick={() => charger()}
                        className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
                        title="Actualiser"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Rien à faire : le dire explicitement. Un écran vide se lit
                comme un chargement raté, pas comme une bonne nouvelle.
                On ne l'affiche pas à un rôle de consultation : son écran
                n'est pas vide, il est plus bas. */}
            {taches.length === 0 && surveillance.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <p className="text-gray-900 font-medium">Rien ne vous attend pour le moment.</p>
                    <p className="text-sm text-gray-500 mt-1">
                        Les opérations normales avancent sans votre intervention.
                    </p>
                </div>
            )}

            {taches.length > 0 && (
                <>
                    <p className="text-sm text-gray-600 mb-4">{message}</p>

                    {urgentes.length > 0 && (
                        <section className="mb-6">
                            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                À traiter en priorité
                            </h2>
                            <div className="space-y-2">
                                {urgentes.map((t) => <CarteTache key={t.cle} tache={t} prioritaire />)}
                            </div>
                        </section>
                    )}

                    {autres.length > 0 && (
                        <section>
                            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                Ensuite
                            </h2>
                            <div className="space-y-2">
                                {autres.map((t) => <CarteTache key={t.cle} tache={t} />)}
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* Vue de contrôle — pour les rôles qui consultent sans agir.
                Volontairement distincte des tâches : aucun de ces chiffres
                n'attend une action de la personne qui les regarde. */}
            {surveillance.length > 0 && (
                <section className={taches.length > 0 ? 'mt-8' : ''}>
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                        <Eye className="w-3.5 h-3.5" />
                        État du système
                    </h2>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {surveillance.map((s) => (
                            <Link
                                key={s.cle}
                                to={s.lien}
                                className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm"
                            >
                                <span className="block text-2xl font-bold text-gray-900 tabular-nums">
                                    {s.nombre}
                                </span>
                                <span className="block text-xs text-gray-500 mt-0.5 leading-snug">
                                    {s.libelle}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* §1, §4 : rappeler la règle évite qu'on remonte tout au Super
                Admin « par sécurité », ce qui est précisément le travers que
                le guide cherche à supprimer. */}
            <div className="mt-8 rounded-lg bg-gray-50 border border-gray-200 p-4">
                <div className="flex gap-3">
                    <ShieldCheck className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-600 leading-relaxed">
                        {acteur.domaine === 'audit' ? (
                            <>
                                Vous consultez et contrôlez. Aucune de ces pages ne vous
                                demandera d’agir — si vous constatez une anomalie,
                                signalez-la au Super Admin.
                            </>
                        ) : acteur.domaine === 'direction' ? (
                            <>
                                Vous avez l’autorité finale, mais chaque domaine traite normalement
                                son travail quotidien. N’intervenez que sur les exceptions, les
                                conflits et les dossiers contestés.
                            </>
                        ) : (
                            <>
                                Traitez normalement votre domaine. Remontez au Super Admin uniquement
                                un dossier suspect, incohérent, exceptionnel ou contesté — avec un motif.
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
};

/** Une tâche : combien, quoi, et où aller la faire. Rien de plus. */
const CarteTache = ({ tache, prioritaire = false }) => {
    const domaine = DOMAINES[tache.domaine] || DOMAINES.catalogue;

    return (
        <Link
            to={tache.lien}
            className={`flex items-center gap-4 rounded-xl border bg-white p-4 transition hover:shadow-sm ${
                prioritaire ? 'border-red-200 hover:border-red-300' : 'border-gray-200 hover:border-gray-300'
            }`}
        >
            {/* Le nombre d'abord : c'est l'information qu'on cherche. */}
            <span
                className={`shrink-0 w-11 h-11 rounded-lg grid place-items-center text-lg font-bold ${
                    prioritaire ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700'
                }`}
            >
                {tache.nombre}
            </span>

            <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-900 truncate">
                    {tache.libelle}
                </span>
                <span className={`inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded border ${domaine.classe}`}>
                    {domaine.libelle}
                </span>
            </span>

            <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
        </Link>
    );
};

export default Console;
