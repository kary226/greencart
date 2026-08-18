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
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="animate-spin text-emerald-600" size={28} />
            </div>
        );
    }

    if (authorized === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="text-center max-w-sm">
                    <ShieldAlert size={44} className="text-red-500 mx-auto mb-3" />
                    <h1 className="text-lg font-bold text-gray-900">Accès refusé</h1>
                    <p className="text-sm text-gray-500 mt-1 mb-5">
                        Cette page est réservée aux comptes admin.
                    </p>
                    <button
                        onClick={() => navigate('/staff/login')}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
                    >
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <AdminNav
                titre="Boutiques"
                sousTitre={`${moi?.nom} · Administrateur · ${stats.total} boutique${stats.total > 1 ? 's' : ''}`}
            />

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Chiffres clés */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Boutiques', valeur: stats.total, icone: Store, couleur: 'text-gray-700' },
                        { label: 'Actives', valeur: stats.actives, icone: Store, couleur: 'text-emerald-600' },
                        { label: 'Suspendues', valeur: stats.suspendues, icone: Ban, couleur: 'text-red-600' },
                        { label: 'Articles en ligne', valeur: stats.produits, icone: Package, couleur: 'text-gray-700' },
                    ].map(({ label, valeur, icone: Icone, couleur }) => (
                        <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Icone size={14} /> {label}
                            </div>
                            <p className={`text-2xl font-bold mt-1 ${couleur}`}>{valeur}</p>
                        </div>
                    ))}
                </div>

                {/* Commerçants sans boutique — anomalie à corriger en un clic */}
                {sansBoutique.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle size={18} className="text-amber-600" />
                            <h2 className="font-semibold text-amber-900">
                                {sansBoutique.length} commerçant{sansBoutique.length > 1 ? 's' : ''} sans boutique
                            </h2>
                        </div>
                        <p className="text-sm text-amber-800 mb-3">
                            La boutique est normalement créée à l'activation du compte. Ces comptes-là n'en ont pas :
                            elle sera créée automatiquement à leur prochaine connexion, ou dès maintenant ici.
                        </p>
                        <div className="space-y-2">
                            {sansBoutique.map((c) => (
                                <div key={c._id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 text-sm">
                                    <div>
                                        <p className="font-medium text-gray-800">{c.nom}</p>
                                        <p className="text-xs text-gray-400">{c.email}</p>
                                    </div>
                                    <button
                                        onClick={() => creerBoutique(c)}
                                        className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition"
                                    >
                                        <PlusCircle size={15} /> Créer la boutique
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Liste des boutiques */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="font-semibold text-gray-900">Toutes les boutiques</h2>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Boutique, commerçant, email…"
                                    value={recherche}
                                    onChange={(e) => setRecherche(e.target.value)}
                                    className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-full sm:w-56"
                                />
                            </div>
                            <select
                                value={filtreStatut}
                                onChange={(e) => setFiltreStatut(e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            >
                                <option value="">Tous les statuts</option>
                                <option value="active">Actives</option>
                                <option value="suspendue">Suspendues</option>
                            </select>
                            {(recherche || filtreStatut) && (
                                <button
                                    onClick={() => { setRecherche(''); setFiltreStatut(''); }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                                    title="Effacer les filtres"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="animate-spin text-gray-400" size={22} />
                        </div>
                    ) : boutiquesFiltrees.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            {boutiques.length === 0
                                ? "Aucune boutique pour l'instant. Invitez un commerçant depuis l'onglet Comptes."
                                : 'Aucune boutique ne correspond aux filtres'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                                        <th className="px-5 py-2.5">Boutique</th>
                                        <th className="px-5 py-2.5">Commerçant</th>
                                        <th className="px-5 py-2.5">Statut</th>
                                        <th className="px-5 py-2.5">Articles</th>
                                        <th className="px-5 py-2.5">Portefeuille</th>
                                        <th className="px-5 py-2.5"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {boutiquesFiltrees.map((b) => (
                                        <tr key={b._id} className="hover:bg-gray-50">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                                                        {b.logo
                                                            ? <img src={b.logo} alt={b.nom} className="w-full h-full object-cover" />
                                                            : <Store size={16} className="text-gray-400" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-gray-800 truncate">{b.nom}</p>
                                                        <p className="text-xs text-gray-400">
                                                            Créée le {new Date(b.createdAt).toLocaleDateString('fr-FR')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <p className="text-gray-800">{b.ownerId?.nom || '—'}</p>
                                                <p className="text-xs text-gray-400">{b.ownerId?.email || ''}</p>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                    b.statut === 'active'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {b.statut === 'active' ? 'Active' : 'Suspendue'}
                                                </span>
                                                {b.ownerId?.statut && b.ownerId.statut !== 'actif' && (
                                                    <span className="block text-xs text-amber-600 mt-1">
                                                        Compte {b.ownerId.statut}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-gray-600">
                                                {b.produitsEnLigne}
                                                <span className="text-gray-400"> / {b.nombreProduits}</span>
                                            </td>
                                            <td className="px-5 py-3 text-gray-600">
                                                {(b.soldeWallet || 0).toLocaleString('fr-FR')} FCFA
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {b.statut === 'active' ? (
                                                        <button
                                                            onClick={() => { setCibleSuspension(b); setMotif(''); }}
                                                            title="Suspendre la boutique"
                                                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
                                                        >
                                                            <Ban size={16} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => reactiver(b)}
                                                            title="Réactiver la boutique"
                                                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        disabled={!b.ownerId}
                                                        onClick={() => setCibleSuppression(b.ownerId)}
                                                        title="Supprimer le commerçant"
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-30"
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
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Ban size={18} className="text-red-600" /> Suspendre « {cibleSuspension.nom} »
                        </h3>
                        <p className="text-sm text-gray-500 mt-2">
                            Les articles de cette boutique sortent immédiatement du catalogue et le commerçant
                            ne peut plus rien publier. Il garde l'accès à son espace, à ses ventes passées et à
                            son portefeuille. L'opération est réversible.
                        </p>
                        <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">
                            Motif (affiché au commerçant)
                        </label>
                        <textarea
                            value={motif}
                            onChange={(e) => setMotif(e.target.value)}
                            rows={3}
                            placeholder="Ex. : articles non conformes, à corriger avant réouverture"
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                        />
                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={confirmerSuspension}
                                disabled={suspensionEnCours}
                                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
                            >
                                {suspensionEnCours ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                                Suspendre
                            </button>
                            <button
                                onClick={() => setCibleSuspension(null)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
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
