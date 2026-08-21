import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import BoutiqueIndisponible from './BoutiqueIndisponible';
import { Search, Loader2, ShoppingBag, ChevronDown, PackageCheck } from 'lucide-react';

// Badge : mêmes tons que le tableau de bord (statutCommercant côté serveur
// fournit déjà 'action' / 'attente' / 'succes' / 'neutre'), pour que le
// même statut se lise pareil partout dans l'espace commerçant.
const TON_CLASSES = {
    action: 'bg-ramses-100 text-ramses-700',
    attente: 'bg-warn-50 text-warn-500',
    succes: 'bg-ok-50 text-ok-500',
    neutre: 'bg-ink-100 text-ink-500',
};

const ONGLETS = [
    { key: 'toutes', label: 'Toutes' },
    { key: 'a_confirmer', label: 'À confirmer' },
    { key: 'en_attente_validation', label: 'En attente de validation' },
    { key: 'fonds_disponibles', label: 'Fonds disponibles' },
    { key: 'terminees', label: 'Annulées / retournées' },
];

// Regroupe les 6 clés de statut serveur (a_confirmer, confirmee, livree,
// validee, annulee, retournee) en catégories d'onglet lisibles.
const appartientOnglet = (cle, onglet) => {
    if (onglet === 'toutes') return true;
    if (onglet === 'a_confirmer') return cle === 'a_confirmer';
    if (onglet === 'en_attente_validation') return cle === 'confirmee';
    if (onglet === 'fonds_disponibles') return cle === 'livree' || cle === 'validee';
    if (onglet === 'terminees') return cle === 'annulee' || cle === 'retournee';
    return true;
};

const CommandeCard = ({ order, onConfirmer, confirmationEnCours }) => {
    const [ouverte, setOuverte] = useState(false);
    const ton = TON_CLASSES[order.statut?.ton] || TON_CLASSES.neutre;
    const peutConfirmer = order.statut?.cle === 'a_confirmer';

    return (
        <div className="bg-white rounded-2xl border border-ink-200 overflow-hidden">
            <button
                type="button"
                onClick={() => setOuverte((o) => !o)}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-ink-50 transition"
                aria-expanded={ouverte}
            >
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">#{order.reference}</p>
                    <p className="text-xs text-ink-400 mt-0.5">
                        {new Date(order.dateCommande).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{order.nombreArticles} article{order.nombreArticles > 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-ink-900">
                        {(order.montantBoutique || 0).toLocaleString('fr-FR')} FCFA
                    </span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${ton}`}>
                        {order.statut?.libelle || '—'}
                    </span>
                    <ChevronDown size={16} className={`text-ink-400 transition-transform shrink-0 ${ouverte ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {ouverte && (
                <div className="border-t border-ink-100 px-5 py-4 grid gap-4">
                    <ul className="grid gap-2.5">
                        {(order.articles || []).map((item, idx) => (
                            <li key={idx} className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-ink-50 border border-ink-100 overflow-hidden shrink-0">
                                    {item.image && (
                                        <img
                                            src={getPresetImageUrl(item.image, 'thumbnail')}
                                            alt={item.nom || ''}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-ink-800 truncate">{item.nom || 'Produit supprimé'}</p>
                                    <p className="text-xs text-ink-400">
                                        {item.quantite} × {(item.prixUnitaire || 0).toLocaleString('fr-FR')} FCFA
                                        {(item.couleur || item.taille) && (
                                            <> · {[item.couleur, item.taille].filter(Boolean).join(' / ')}</>
                                        )}
                                    </p>
                                </div>
                                <span className="text-sm font-semibold text-ink-800 shrink-0">
                                    {((item.prixUnitaire || 0) * (item.quantite || 0)).toLocaleString('fr-FR')} FCFA
                                </span>
                            </li>
                        ))}
                    </ul>

                    {peutConfirmer && (
                        <button
                            onClick={() => onConfirmer(order._id)}
                            disabled={confirmationEnCours === order._id}
                            className="flex items-center justify-center gap-2 bg-ramses-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition disabled:opacity-50"
                        >
                            {confirmationEnCours === order._id
                                ? <Loader2 size={16} className="animate-spin" />
                                : <PackageCheck size={16} />}
                            J'ai mis le colis de côté — confirmer
                        </button>
                    )}
                    {order.statut?.cle === 'confirmee' && (
                        <p className="text-xs text-warn-500">Confirmée de ton côté — en attente de validation par l'équipe RAMCI.</p>
                    )}
                </div>
            )}
        </div>
    );
};

const Commandes = () => {
    const { axios } = useAppContext();
    const { boutique, boutiqueEnCours, erreurBoutique, rechargerBoutique } = useOutletContext();

    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [onglet, setOnglet] = useState('toutes');
    const [recherche, setRecherche] = useState('');
    const [nbAffiches, setNbAffiches] = useState(20);
    const [confirmationEnCours, setConfirmationEnCours] = useState(null);

    const charger = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/order/commercant/mes-ventes');
            if (data.success) {
                setOrders(data.orders || []);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!boutique) { setLoading(false); return; }
        charger();
    }, [axios, boutique]);

    const confirmer = async (orderId) => {
        setConfirmationEnCours(orderId);
        try {
            const { data } = await axios.post('/api/order/commercant/confirmer', { orderId });
            if (data.success) {
                toast.success(data.message);
                charger();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setConfirmationEnCours(null);
        }
    };

    const filtrees = useMemo(() => {
        const terme = recherche.trim().toLowerCase();
        return orders.filter((o) => {
            if (!appartientOnglet(o.statut?.cle, onglet)) return false;
            if (!terme) return true;
            return o.reference.toLowerCase().includes(terme);
        });
    }, [orders, onglet, recherche]);

    const compteurs = useMemo(() => {
        const c = { toutes: orders.length, a_confirmer: 0, en_attente_validation: 0, fonds_disponibles: 0, terminees: 0 };
        orders.forEach((o) => {
            const cle = o.statut?.cle;
            if (cle === 'a_confirmer') c.a_confirmer += 1;
            else if (cle === 'confirmee') c.en_attente_validation += 1;
            else if (cle === 'livree' || cle === 'validee') c.fonds_disponibles += 1;
            else c.terminees += 1;
        });
        return c;
    }, [orders]);

    if (loading || boutiqueEnCours) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-ramses-600" size={32} />
            </div>
        );
    }

    if (!boutique) {
        return (
            <div className="py-16 px-4">
                <BoutiqueIndisponible erreur={erreurBoutique} onRetry={rechargerBoutique} />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <header className="mb-5">
                <h1 className="rs-h1">Commandes</h1>
                <p className="text-[13px] text-ink-400 mt-1">
                    Les commandes contenant au moins un article de votre boutique.
                </p>
            </header>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex gap-1.5 overflow-x-auto rs-scroll">
                    {ONGLETS.map((o) => (
                        <button
                            key={o.key}
                            onClick={() => setOnglet(o.key)}
                            className={`shrink-0 px-3.5 py-2 rounded-xl text-[13px] font-medium transition ${
                                onglet === o.key ? 'bg-ramses-600 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'
                            }`}
                        >
                            {o.label} <span className="opacity-70">({compteurs[o.key]})</span>
                        </button>
                    ))}
                </div>
                <div className="relative sm:ml-auto sm:w-64">
                    <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                    <input
                        type="text"
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        placeholder="N° commande…"
                        className="rs-input rs-input--icon-l"
                    />
                </div>
            </div>

            {filtrees.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ink-200 p-12 text-center">
                    <ShoppingBag size={28} className="text-ink-300 mx-auto mb-2" />
                    <p className="text-sm text-ink-400">
                        {orders.length === 0 ? "Aucune commande pour l'instant." : 'Aucune commande ne correspond à ce filtre.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid gap-2.5">
                        {filtrees.slice(0, nbAffiches).map((order) => (
                            <CommandeCard
                                key={order._id}
                                order={order}
                                onConfirmer={confirmer}
                                confirmationEnCours={confirmationEnCours}
                            />
                        ))}
                    </div>
                    {filtrees.length > nbAffiches && (
                        <button
                            onClick={() => setNbAffiches((n) => n + 20)}
                            className="rs-btn rs-btn--secondary w-full mt-4"
                        >
                            Afficher plus ({filtrees.length - nbAffiches} restantes)
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default Commandes;