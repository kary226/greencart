import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import AdminNav from './AdminNav';
import {
    Search, Loader2, ShieldAlert, PackageX, CheckCircle2, AlertTriangle,
} from 'lucide-react';

// Écran admin — retour de colis (compte staff, 2FA).
//
// Manquait jusqu'ici côté panel staff moderne : la seule UI existante pour
// marquer une commande 'Returned' vivait sur l'ancien /seller (compte
// technique unique). POST /order/status accepte désormais les deux
// sessions (voir routes/orderRoute.js) — cet écran est le premier à
// l'utiliser depuis le panel staff.
//
// Un retour engage TOUJOURS deux décisions séparées côté serveur :
//   - l'argent du commerçant est repris, quoi qu'il arrive ;
//   - le stock n'est réintégré que si le colis revient en bon état.
// On force donc ce choix ici plutôt que de laisser un défaut silencieux.

const STATUTS_RETOURNABLES = ['Confirmed', 'Collecting', 'Ready for Shipment', 'Shipped', 'Out for Delivery', 'Delivered'];

const AdminRetours = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [authorized, setAuthorized] = useState(null);
    const [moi, setMoi] = useState(null);

    const [recherche, setRecherche] = useState('');
    const [resultats, setResultats] = useState([]);
    const [recherchant, setRecherchant] = useState(false);
    const [dejaCherche, setDejaCherche] = useState(false);

    const [modale, setModale] = useState(null); // { order, etat: 'bon_etat'|'endommage', note }
    const [envoi, setEnvoi] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (data.success && data.staffUser?.role === 'admin') {
                    setMoi(data.staffUser);
                    setAuthorized(true);
                } else {
                    setAuthorized(false);
                }
            } catch (error) {
                setAuthorized(false);
            }
        })();
    }, [axios]);

    const chercher = async (e) => {
        e.preventDefault();
        const terme = recherche.trim();
        if (terme.length < 3) {
            toast.error('Entrez au moins 3 caractères (fin du numéro de commande).');
            return;
        }
        setRecherchant(true);
        setDejaCherche(true);
        try {
            const { data } = await axios.get('/api/order/admin/recherche', { params: { q: terme } });
            if (data.success) {
                setResultats(data.orders || []);
            } else {
                toast.error(data.message);
                setResultats([]);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
            setResultats([]);
        } finally {
            setRecherchant(false);
        }
    };

    const ouvrirModale = (order) => setModale({ order, etat: 'bon_etat', note: '' });

    const confirmerRetour = async () => {
        if (!modale) return;
        setEnvoi(true);
        try {
            const { data } = await axios.post('/api/order/status', {
                orderId: modale.order._id,
                status: 'Returned',
                retourEtat: modale.etat,
                retourNote: modale.note,
            });
            if (data.success) {
                toast.success(
                    data.montantRembourseClient > 0
                        ? `Retour traité — ${data.montantRembourseClient.toLocaleString('fr-FR')} FCFA remboursés au client`
                        : 'Retour traité'
                );
                setModale(null);
                chercher({ preventDefault: () => {} });
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setEnvoi(false);
        }
    };

    if (authorized === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-50">
                <Loader2 className="animate-spin text-ramses-600" size={28} />
            </div>
        );
    }

    if (authorized === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
                <div className="text-center max-w-sm">
                    <ShieldAlert size={44} className="text-ramses-600 mx-auto mb-3" />
                    <h1 className="text-lg font-bold text-ink-900">Accès refusé</h1>
                    <p className="text-sm text-ink-500 mt-1 mb-5">Cette page est réservée aux comptes admin.</p>
                    <button onClick={() => navigate('/staff/login')} className="px-4 py-2 bg-ramses-600 text-white rounded-xl text-sm font-medium hover:bg-ramses-700 transition">
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-50">
            <AdminNav titre="Retours de colis" sousTitre={`${moi?.nom} · Administrateur`} />

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                <form onSubmit={chercher} className="bg-white rounded-2xl border border-ink-100 p-4 flex gap-2">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                        <input
                            type="text"
                            value={recherche}
                            onChange={(e) => setRecherche(e.target.value)}
                            placeholder="Numéro de commande (ex. A1B2C3)"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-ink-200 text-sm focus:outline-none focus:border-ramses-500"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={recherchant}
                        className="px-4 py-2.5 rounded-xl bg-ramses-600 text-white text-sm font-medium hover:bg-ramses-700 transition disabled:opacity-50"
                    >
                        {recherchant ? <Loader2 size={16} className="animate-spin" /> : 'Chercher'}
                    </button>
                </form>

                {dejaCherche && !recherchant && resultats.length === 0 && (
                    <div className="bg-white rounded-2xl border border-ink-100 p-10 text-center text-sm text-ink-400">
                        Aucune commande trouvée pour « {recherche} »
                    </div>
                )}

                <div className="space-y-3">
                    {resultats.map((o) => {
                        const dejaRetournee = o.status === 'Returned';
                        const retournable = STATUTS_RETOURNABLES.includes(o.status);
                        return (
                            <div key={o._id} className="bg-white rounded-2xl border border-ink-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="font-semibold text-ink-900">#{o._id.slice(-6).toUpperCase()}</span>
                                        <span className="text-sm text-ink-600">{(o.amount || 0).toLocaleString('fr-FR')} FCFA</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-ink-100 text-ink-500">{o.status}</span>
                                    </div>
                                    <p className="text-xs text-ink-400">
                                        {o.userId?.name || o.userId?.email || 'Client'} · {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                                    </p>
                                    {dejaRetournee && (
                                        <p className="text-xs text-ok-500 mt-1 flex items-center gap-1">
                                            <CheckCircle2 size={12} />
                                            Déjà retournée — {o.retourEtat === 'endommage' ? 'endommagé' : 'bon état'}
                                            {o.retourNote ? ` (« ${o.retourNote} »)` : ''}
                                        </p>
                                    )}
                                </div>
                                <div className="shrink-0">
                                    {dejaRetournee ? null : retournable ? (
                                        <button
                                            onClick={() => ouvrirModale(o)}
                                            className="px-4 py-2 rounded-xl bg-ink-900 text-white text-sm font-medium hover:bg-ink-800 transition flex items-center gap-1.5"
                                        >
                                            <PackageX size={15} /> Marquer retournée
                                        </button>
                                    ) : (
                                        <span className="text-xs text-ink-400 flex items-center gap-1">
                                            <AlertTriangle size={12} /> Statut non éligible
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {modale && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-5">
                        <h2 className="font-bold text-ink-900 mb-1">
                            Retour — commande #{modale.order._id.slice(-6).toUpperCase()}
                        </h2>
                        <p className="text-xs text-ink-400 mb-4">
                            L'argent du/des commerçant(s) est repris dans tous les cas. Précisez l'état du colis.
                        </p>

                        <div className="space-y-2 mb-4">
                            <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${modale.etat === 'bon_etat' ? 'border-ok-500 bg-ok-50' : 'border-ink-200'}`}>
                                <input
                                    type="radio"
                                    checked={modale.etat === 'bon_etat'}
                                    onChange={() => setModale((m) => ({ ...m, etat: 'bon_etat' }))}
                                    className="mt-0.5"
                                />
                                <span className="text-sm">
                                    <span className="font-medium block">Bon état</span>
                                    <span className="text-ink-400 text-xs">Remis en stock, revendable</span>
                                </span>
                            </label>
                            <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${modale.etat === 'endommage' ? 'border-red-500 bg-red-50' : 'border-ink-200'}`}>
                                <input
                                    type="radio"
                                    checked={modale.etat === 'endommage'}
                                    onChange={() => setModale((m) => ({ ...m, etat: 'endommage' }))}
                                    className="mt-0.5"
                                />
                                <span className="text-sm">
                                    <span className="font-medium block">Endommagé</span>
                                    <span className="text-ink-400 text-xs">Mis au rebut, stock NON réintégré</span>
                                </span>
                            </label>
                        </div>

                        <textarea
                            value={modale.note}
                            onChange={(e) => setModale((m) => ({ ...m, note: e.target.value.slice(0, 300) }))}
                            placeholder="Note (optionnelle, 300 caractères max)"
                            className="w-full rounded-xl border border-ink-200 p-2.5 text-sm mb-4 resize-none"
                            rows={2}
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => setModale(null)}
                                disabled={envoi}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-ink-200 text-sm font-medium hover:bg-ink-50 transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmerRetour}
                                disabled={envoi}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-ramses-600 text-white text-sm font-medium hover:bg-ramses-700 transition disabled:opacity-50"
                            >
                                {envoi ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirmer le retour'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminRetours;