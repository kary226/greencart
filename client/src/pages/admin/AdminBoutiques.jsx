import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import AdminNav from './AdminNav';
import SupprimerCompteModal from './SupprimerCompteModal';
import {
    Store, ShieldAlert, Loader2, Ban, RotateCcw, Trash2, Search, X,
    AlertTriangle, Package, PlusCircle,
} from 'lucide-react';

// Vue d'ensemble des boutiques, côté administrateur.
//
// Deux leviers, volontairement distincts :
//   - SUSPENDRE la boutique : la vitrine ferme (articles hors catalogue,
//     publication bloquée) mais le commerçant garde l'accès à son espace,
//     à son historique et à son portefeuille. C'est réversible.
//   - SUPPRIMER le commerçant : le compte et la boutique disparaissent.
//     Irréversible, et refusé tant qu'il reste de l'argent à lui verser.
const AdminBoutiques = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [authorized, setAuthorized] = useState(null);
    const [moi, setMoi] = useState(null);

    const [boutiques, setBoutiques] = useState([]);
    const [sansBoutique, setSansBoutique] = useState([]);
    const [loading, setLoading] = useState(true);

    const [recherche, setRecherche] = useState('');
    const [filtreStatut, setFiltreStatut] = useState('');

    // Modale de suspension (le motif est affiché tel quel au commerçant)
    const [cibleSuspension, setCibleSuspension] = useState(null);
    const [motif, setMotif] = useState('');
    const [suspensionEnCours, setSuspensionEnCours] = useState(false);

    // Suppression du commerçant : la modale partagée avec la gestion des
    // comptes se charge de l'aperçu et des garde-fous.
    const [cibleSuppression, setCibleSuppression] = useState(null);

    const charger = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/boutiques');
            if (data.success) {
                setBoutiques(data.boutiques || []);
                setSansBoutique(data.sansBoutique || []);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    }, [axios]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axios.get('/api/staff/is-auth');
                if (data.success && ['admin', 'super_admin'].includes(data.staffUser?.role)) {
                    setMoi(data.staffUser);
                    setAuthorized(true);
                } else {
                    setAuthorized(false);
                }
            } catch (error) {
                console.error('Erreur vérification authentification admin:', error);
                setAuthorized(false);
            }
        })();
    }, [axios]);

    useEffect(() => { if (authorized) charger(); }, [authorized, charger]);

    const boutiquesFiltrees = useMemo(() => {
        const terme = recherche.trim().toLowerCase();
        return boutiques.filter((b) => {
            if (filtreStatut && b.statut !== filtreStatut) return false;
            if (!terme) return true;
            return [b.nom, b.ownerId?.nom, b.ownerId?.email]
                .filter(Boolean)
                .some((champ) => champ.toLowerCase().includes(terme));
        });
    }, [boutiques, recherche, filtreStatut]);

    const stats = useMemo(() => ({
        total: boutiques.length,
        actives: boutiques.filter((b) => b.statut === 'active').length,
        suspendues: boutiques.filter((b) => b.statut === 'suspendue').length,
        produits: boutiques.reduce((acc, b) => acc + (b.produitsEnLigne || 0), 0),
    }), [boutiques]);

    const changerStatut = async (boutique, statut, motifSaisi = '') => {
        try {
            const { data } = await axios.patch(`/api/boutiques/${boutique._id}/statut`, {
                statut,
                motif: motifSaisi,
            });
            if (data.success) {
                toast.success(data.message);
                charger();
                return true;
            }
            toast.error(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
        return false;
    };

    const confirmerSuspension = async () => {
        setSuspensionEnCours(true);
        const ok = await changerStatut(cibleSuspension, 'suspendue', motif);
        setSuspensionEnCours(false);
        if (ok) {
            setCibleSuspension(null);
            setMotif('');
        }
    };

    // Droit d'ajouter des articles, accordé boutique par boutique. Par
    // défaut fermé : c'est l'admin qui ouvre, jamais l'inverse.
    const basculerCreation = async (boutique) => {
        const actif = !boutique.peutCreerProduits;
        try {
            const { data } = await axios.patch(`/api/boutiques/${boutique._id}/autorisations`, {
                peutCreerProduits: actif,
            });
            if (data.success) {
                toast.success(data.message);
                charger();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const reactiver = async (boutique) => {
        if (!window.confirm(`Réactiver « ${boutique.nom} » ? Ses articles reviendront dans le catalogue.`)) return;
        await changerStatut(boutique, 'active');
    };

    const creerBoutique = async (commercant) => {
        try {
            const { data } = await axios.post('/api/boutiques', { ownerId: commercant._id });
            if (data.success) {
                toast.success('Boutique créée');
                charger();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
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
                    <p className="text-sm text-ink-500 mt-1 mb-5">
                        Cette page est réservée aux comptes admin.
                    </p>
                    <button
                        onClick={() => navigate('/staff/login')}
                        className="px-4 py-2 bg-ramses-600 text-white rounded-xl text-sm font-medium hover:bg-ramses-700 transition"
                    >
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-50">
            <AdminNav
                titre="Boutiques"
                sousTitre={`${moi?.nom} · Administrateur · ${stats.total} boutique${stats.total > 1 ? 's' : ''}`}
            />

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Chiffres clés */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Boutiques', valeur: stats.total, icone: Store, couleur: 'text-ink-700' },
                        { label: 'Actives', valeur: stats.actives, icone: Store, couleur: 'text-ramses-600' },
                        { label: 'Suspendues', valeur: stats.suspendues, icone: Ban, couleur: 'text-ramses-600' },
                        { label: 'Articles en ligne', valeur: stats.produits, icone: Package, couleur: 'text-ink-700' },
                    ].map(({ label, valeur, icone: Icone, couleur }) => (
                        <div key={label} className="bg-white rounded-2xl border border-ink-100 p-4">
                            <div className="flex items-center gap-2 text-xs text-ink-400">
                                <Icone size={14} /> {label}
                            </div>
                            <p className={`text-2xl font-bold mt-1 ${couleur}`}>{valeur}</p>
                        </div>
                    ))}
                </div>

                {/* Commerçants sans boutique — anomalie à corriger en un clic */}
                {sansBoutique.length > 0 && (
                    <div className="bg-warn-50 border border-warn-500/30 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle size={18} className="text-warn-500" />
                            <h2 className="font-semibold text-warn-500">
                                {sansBoutique.length} commerçant{sansBoutique.length > 1 ? 's' : ''} sans boutique
                            </h2>
                        </div>
                        <p className="text-sm text-warn-500 mb-3">
                            La boutique est normalement créée à l'activation du compte. Ces comptes-là n'en ont pas :
                            elle sera créée automatiquement à leur prochaine connexion, ou dès maintenant ici.
                        </p>
                        <div className="space-y-2">
                            {sansBoutique.map((c) => (
                                <div key={c._id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 text-sm">
                                    <div>
                                        <p className="font-medium text-ink-800">{c.nom}</p>
                                        <p className="text-xs text-ink-400">{c.email}</p>
                                    </div>
                                    <button
                                        onClick={() => creerBoutique(c)}
                                        className="flex items-center gap-1.5 text-sm bg-ramses-600 text-white px-3 py-1.5 rounded-lg hover:bg-ramses-700 transition"
                                    >
                                        <PlusCircle size={15} /> Créer la boutique
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Liste des boutiques */}
                <div className="bg-white rounded-2xl shadow-sm border border-ink-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-ink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="font-semibold text-ink-900">Toutes les boutiques</h2>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                                <input
                                    type="text"
                                    placeholder="Boutique, commerçant, email…"
                                    value={recherche}
                                    onChange={(e) => setRecherche(e.target.value)}
                                    className="pl-9 pr-3 py-1.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-600 focus:ring-1 focus:ring-ramses-600 w-full sm:w-56"
                                />
                            </div>
                            <select
                                value={filtreStatut}
                                onChange={(e) => setFiltreStatut(e.target.value)}
                                className="px-3 py-1.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-600 focus:ring-1 focus:ring-ramses-600"
                            >
                                <option value="">Tous les statuts</option>
                                <option value="active">Actives</option>
                                <option value="suspendue">Suspendues</option>
                            </select>
                            {(recherche || filtreStatut) && (
                                <button
                                    onClick={() => { setRecherche(''); setFiltreStatut(''); }}
                                    className="p-1.5 text-ink-400 hover:text-ink-600 rounded-lg hover:bg-ink-100 transition"
                                    title="Effacer les filtres"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="animate-spin text-ink-400" size={22} />
                        </div>
                    ) : boutiquesFiltrees.length === 0 ? (
                        <div className="p-8 text-center text-ink-500 text-sm">
                            {boutiques.length === 0
                                ? "Aucune boutique pour l'instant. Invitez un commerçant depuis l'onglet Comptes."
                                : 'Aucune boutique ne correspond aux filtres'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-ink-400 uppercase tracking-wide">
                                        <th className="px-5 py-2.5">Boutique</th>
                                        <th className="px-5 py-2.5">Commerçant</th>
                                        <th className="px-5 py-2.5">Statut</th>
                                        <th className="px-5 py-2.5">Articles</th>
                                        <th className="px-5 py-2.5">Ajout d'articles</th>
                                        <th className="px-5 py-2.5">Portefeuille</th>
                                        <th className="px-5 py-2.5"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ink-100">
                                    {boutiquesFiltrees.map((b) => (
                                        <tr key={b._id} className="hover:bg-ink-50">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-ink-100 overflow-hidden flex items-center justify-center shrink-0">
                                                        {b.logo
                                                            ? <img src={b.logo} alt={b.nom} className="w-full h-full object-cover" />
                                                            : <Store size={16} className="text-ink-400" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-ink-800 truncate">{b.nom}</p>
                                                        <p className="text-xs text-ink-400">
                                                            Créée le {new Date(b.createdAt).toLocaleDateString('fr-FR')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <p className="text-ink-800">{b.ownerId?.nom || '—'}</p>
                                                <p className="text-xs text-ink-400">{b.ownerId?.email || ''}</p>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                    b.statut === 'active'
                                                        ? 'bg-ok-50 text-ok-500'
                                                        : 'bg-ramses-100 text-ramses-700'
                                                }`}>
                                                    {b.statut === 'active' ? 'Active' : 'Suspendue'}
                                                </span>
                                                {b.ownerId?.statut && b.ownerId.statut !== 'actif' && (
                                                    <span className="block text-xs text-warn-500 mt-1">
                                                        Compte {b.ownerId.statut}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-ink-600">
                                                {b.produitsEnLigne}
                                                <span className="text-ink-400"> / {b.nombreProduits}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={Boolean(b.peutCreerProduits)}
                                                    onClick={() => basculerCreation(b)}
                                                    title={b.peutCreerProduits
                                                        ? "Retirer le droit d'ajouter des articles"
                                                        : "Autoriser ce commerçant à ajouter des articles"}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                                        b.peutCreerProduits ? 'bg-ramses-600' : 'bg-ink-200'
                                                    }`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                        b.peutCreerProduits ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                                </button>
                                            </td>
                                            <td className="px-5 py-3 text-ink-600">
                                                {(b.soldeWallet || 0).toLocaleString('fr-FR')} FCFA
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {b.statut === 'active' ? (
                                                        <button
                                                            onClick={() => { setCibleSuspension(b); setMotif(''); }}
                                                            title="Suspendre la boutique"
                                                            className="p-1.5 rounded-lg text-ramses-600 hover:bg-ramses-50 transition"
                                                        >
                                                            <Ban size={16} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => reactiver(b)}
                                                            title="Réactiver la boutique"
                                                            className="p-1.5 rounded-lg text-ok-500 hover:bg-ok-50 transition"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        disabled={!b.ownerId}
                                                        onClick={() => setCibleSuppression(b.ownerId)}
                                                        title="Supprimer le commerçant"
                                                        className="p-1.5 rounded-lg text-ink-400 hover:text-ramses-600 hover:bg-ramses-50 transition disabled:opacity-30"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modale : suspension de la boutique */}
            {cibleSuspension && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="font-semibold text-ink-900 flex items-center gap-2">
                            <Ban size={18} className="text-ramses-600" /> Suspendre « {cibleSuspension.nom} »
                        </h3>
                        <p className="text-sm text-ink-500 mt-2">
                            Les articles de cette boutique sortent immédiatement du catalogue et le commerçant
                            ne peut plus rien publier. Il garde l'accès à son espace, à ses ventes passées et à
                            son portefeuille. L'opération est réversible.
                        </p>
                        <label className="block text-sm font-medium text-ink-700 mt-4 mb-1">
                            Motif (affiché au commerçant)
                        </label>
                        <textarea
                            value={motif}
                            onChange={(e) => setMotif(e.target.value)}
                            rows={3}
                            placeholder="Ex. : articles non conformes, à corriger avant réouverture"
                            className="w-full px-3 py-2 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-600 focus:ring-1 focus:ring-ramses-600 resize-none"
                        />
                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={confirmerSuspension}
                                disabled={suspensionEnCours}
                                className="flex-1 flex items-center justify-center gap-2 bg-white text-ramses-700 border border-ramses-200 hover:bg-ramses-50 px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                            >
                                {suspensionEnCours ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                                Suspendre
                            </button>
                            <button
                                onClick={() => setCibleSuspension(null)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-ink-100 text-ink-600 hover:bg-ink-200 transition"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {cibleSuppression && (
                <SupprimerCompteModal
                    compte={cibleSuppression}
                    onClose={() => setCibleSuppression(null)}
                    onSupprime={charger}
                />
            )}
        </div>
    );
};

export default AdminBoutiques;