import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Package, Truck, RotateCcw, Loader2, CalendarDays,
} from 'lucide-react';

/**
 * MON ACTIVITÉ — le bilan des tournées du livreur.
 *
 * Il n'avait qu'une liste des 50 dernières commandes closes, sans dates ni
 * totaux, et qui ignorait complètement ses collectes. Impossible de répondre
 * à « qu'est-ce que j'ai fait aujourd'hui ? » — ni de justifier une somme
 * encaissée en fin de journée.
 *
 * Deux activités séparées, parce que ce sont deux déplacements distincts :
 * récupérer chez les commerçants, puis livrer chez le client.
 */

/** AAAA-MM-JJ dans le fuseau local — `toISOString` décalerait d'un jour. */
const enDateISO = (d) => {
    const copie = new Date(d);
    copie.setMinutes(copie.getMinutes() - copie.getTimezoneOffset());
    return copie.toISOString().slice(0, 10);
};

const ilYA = (jours) => {
    const d = new Date();
    d.setDate(d.getDate() - jours);
    return enDateISO(d);
};

const RACCOURCIS = [
    { cle: 'jour', label: "Aujourd'hui", depuis: () => enDateISO(new Date()), jusqu: () => enDateISO(new Date()) },
    { cle: 'semaine', label: '7 derniers jours', depuis: () => ilYA(6), jusqu: () => enDateISO(new Date()) },
    { cle: 'mois', label: '30 derniers jours', depuis: () => ilYA(29), jusqu: () => enDateISO(new Date()) },
];

const Carte = ({ icone: Icone, valeur, libelle, accent = false }) => (
    <div className={`rounded-2xl border p-4 ${accent ? 'bg-burgundy-600 border-burgundy-600 text-white' : 'bg-white border-gray-200'}`}>
        <Icone size={18} className={accent ? 'text-white/80' : 'text-gray-400'} />
        <p className={`text-2xl font-bold tabular-nums mt-2 ${accent ? 'text-white' : 'text-gray-900'}`}>
            {valeur}
        </p>
        <p className={`text-[12px] leading-snug ${accent ? 'text-white/80' : 'text-gray-500'}`}>
            {libelle}
        </p>
    </div>
);

const MonActivite = () => {
    const { axios } = useAppContext();
    const [raccourci, setRaccourci] = useState('jour');
    const [depuis, setDepuis] = useState(enDateISO(new Date()));
    const [jusqu, setJusqu] = useState(enDateISO(new Date()));
    const [donnees, setDonnees] = useState(null);
    const [chargement, setChargement] = useState(true);

    const charger = useCallback(async () => {
        setChargement(true);
        try {
            const { data } = await axios.get('/api/order/livreur/activite', {
                params: { depuis, jusqu },
            });
            if (data.success) setDonnees(data);
            else toast.error(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setChargement(false);
        }
    }, [axios, depuis, jusqu]);

    useEffect(() => { charger(); }, [charger]);

    const appliquer = (r) => {
        setRaccourci(r.cle);
        setDepuis(r.depuis());
        setJusqu(r.jusqu());
    };

    // [NOUVEAU] Ces deux listes peuvent couvrir plusieurs jours (selon la
    // période choisie) — l'heure seule ne suffit pas à savoir de quel jour
    // il s'agit, même si un créneau de livraison avait été fixé à l'avance.
    const dateHeure = (d) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const jourCourt = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="max-w-4xl mx-auto px-4 py-6">

            {/* ── Période ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 mb-4">
                {RACCOURCIS.map((r) => (
                    <button
                        key={r.cle}
                        onClick={() => appliquer(r)}
                        className={`h-10 px-4 rounded-xl text-sm font-medium transition ${
                            raccourci === r.cle
                                ? 'bg-burgundy-600 text-white'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            {/* Dates libres : pour retrouver une journée précise quand on
                lui demande des comptes sur une tournée passée. */}
            <div className="flex flex-wrap items-center gap-2 mb-6 text-sm">
                <CalendarDays size={16} className="text-gray-400" />
                <input
                    type="date" value={depuis} max={jusqu}
                    onChange={(e) => { setDepuis(e.target.value); setRaccourci(''); }}
                    className="h-10 px-3 rounded-xl border border-gray-200 text-sm"
                    aria-label="Depuis le"
                />
                <span className="text-gray-400">au</span>
                <input
                    type="date" value={jusqu} min={depuis} max={enDateISO(new Date())}
                    onChange={(e) => { setJusqu(e.target.value); setRaccourci(''); }}
                    className="h-10 px-3 rounded-xl border border-gray-200 text-sm"
                    aria-label="Jusqu'au"
                />
            </div>

            {chargement ? (
                <div className="grid place-items-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            ) : !donnees ? null : (
                <>
                    {/* ── Résumé ──────────────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                        <Carte icone={Package} valeur={donnees.resume.collectes}
                               libelle={`Collecte${donnees.resume.collectes > 1 ? 's' : ''} · ${donnees.resume.articlesCollectes} article(s)`} />
                        <Carte icone={Truck} valeur={donnees.resume.livraisons}
                               libelle={`Livraison${donnees.resume.livraisons > 1 ? 's' : ''} effectuée${donnees.resume.livraisons > 1 ? 's' : ''}`} accent />
                        <Carte icone={RotateCcw} valeur={donnees.resume.retours} libelle="Retour(s)" />
                    </div>

                    {/* ── Jour par jour ───────────────────────────────── */}
                    {donnees.parJour.length > 1 && (
                        <section className="mb-8">
                            <h2 className="text-sm font-semibold text-gray-800 mb-3">Jour par jour</h2>
                            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                                {donnees.parJour.map((j) => (
                                    <div key={j.jour} className="flex items-center justify-between px-4 py-3">
                                        <span className="text-sm text-gray-700 capitalize">{jourCourt(j.jour)}</span>
                                        <span className="flex gap-4 text-sm tabular-nums shrink-0">
                                            <span className="text-gray-500">
                                                <Package size={13} className="inline mr-1 -mt-0.5" />{j.collectes}
                                            </span>
                                            <span className="text-gray-900 font-medium">
                                                <Truck size={13} className="inline mr-1 -mt-0.5" />{j.livraisons}
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── Le détail ───────────────────────────────────── */}
                    <div className="grid gap-6 sm:grid-cols-2">
                        <section>
                            <h2 className="text-sm font-semibold text-gray-800 mb-3">
                                Colis récupérés ({donnees.collectes.length})
                            </h2>
                            {donnees.collectes.length === 0 ? (
                                <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-200 p-5 text-center">
                                    Aucune collecte sur cette période.
                                </p>
                            ) : (
                                <ul className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 list-none p-0 m-0">
                                    {donnees.collectes.map((c) => (
                                        <li key={c.orderId} className="px-4 py-3 flex items-center justify-between gap-3">
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium text-gray-800">#{c.reference}</span>
                                                <span className="block text-[12px] text-gray-500">
                                                    {c.articles} article(s){c.commune ? ` · ${c.commune}` : ''}
                                                </span>
                                            </span>
                                            <span className="text-[12px] text-gray-400 tabular-nums shrink-0">{dateHeure(c.le)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold text-gray-800 mb-3">
                                Colis livrés ({donnees.livraisons.length})
                            </h2>
                            {donnees.livraisons.length === 0 ? (
                                <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-200 p-5 text-center">
                                    Aucune livraison sur cette période.
                                </p>
                            ) : (
                                <ul className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 list-none p-0 m-0">
                                    {donnees.livraisons.map((l) => (
                                        <li key={l.orderId} className="px-4 py-3 flex items-center justify-between gap-3">
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium text-gray-800">#{l.reference}</span>
                                                <span className="block text-[12px] text-gray-500">
                                                    {l.commune || 'Livrée'}
                                                </span>
                                            </span>
                                            <span className="text-[12px] text-gray-400 tabular-nums shrink-0">{dateHeure(l.le)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                </>
            )}
        </div>
    );
};

export default MonActivite;