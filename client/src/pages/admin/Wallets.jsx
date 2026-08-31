import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Wallet, Search, Loader2, ArrowUpCircle, ArrowDownCircle,
    X, AlertCircle, Clock, User
} from 'lucide-react';

// Page "Portefeuilles" — consultation des soldes commerçants et ajustement
// manuel (crédit / débit) avec motif obligatoire.
//
// S'appuie sur les routes déjà existantes côté serveur (walletRoute.js) :
//   GET  /api/boutiques                  -> liste des commerçants + solde
//   GET  /api/wallet/admin/:commercialId -> détail du portefeuille
//   POST /api/wallet/admin/ajustement    -> ajustement (motif >= 10 caractères,
//                                            en-tête Idempotency-Key requis)
//
// Si le montant ajusté dépasse le seuil configuré dans
// Administration > Seuils d'approbation, le serveur ne l'exécute pas
// immédiatement : il crée une demande dans Finance > Approbations.

const Wallets = () => {
    const { axios } = useAppContext();
    const [boutiques, setBoutiques] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [selected, setSelected] = useState(null); // { ownerId, boutique }
    const [walletDetail, setWalletDetail] = useState(null);
    const [loadingWallet, setLoadingWallet] = useState(false);

    const [montant, setMontant] = useState('');
    const [sens, setSens] = useState('credit'); // 'credit' ou 'debit'
    const [description, setDescription] = useState('');
    const [motif, setMotif] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchBoutiques = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/boutiques');
            const liste = Array.isArray(data) ? data : (data.boutiques || []);
            setBoutiques(liste.filter((b) => b.ownerId));
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBoutiques(); }, []);

    const filtrees = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return boutiques;
        return boutiques.filter((b) =>
            b.nom?.toLowerCase().includes(q) ||
            b.ownerId?.nom?.toLowerCase().includes(q) ||
            b.ownerId?.email?.toLowerCase().includes(q)
        );
    }, [boutiques, search]);

    const ouvrirPortefeuille = async (boutique) => {
        setSelected(boutique);
        setWalletDetail(null);
        setMontant(''); setDescription(''); setMotif(''); setSens('credit');
        setLoadingWallet(true);
        try {
            const { data } = await axios.get(`/api/wallet/admin/${boutique.ownerId._id}`);
            if (data.success) setWalletDetail(data.wallet);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Portefeuille introuvable');
        } finally {
            setLoadingWallet(false);
        }
    };

    const fermerPanneau = () => {
        setSelected(null);
        setWalletDetail(null);
    };

    const soumettreAjustement = async (e) => {
        e.preventDefault();
        if (!selected) return;

        const montantNum = Number(montant);
        if (!montantNum || montantNum <= 0) {
            toast.error('Indiquez un montant valide (> 0)');
            return;
        }
        if (!description.trim()) {
            toast.error('La description est obligatoire');
            return;
        }
        if (motif.trim().length < 10) {
            toast.error('Le motif doit contenir au moins 10 caractères');
            return;
        }

        const montantSigne = sens === 'debit' ? -Math.abs(montantNum) : Math.abs(montantNum);
        const idempotencyKey = (crypto.randomUUID && crypto.randomUUID()) ||
            `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        setSubmitting(true);
        try {
            const { data } = await axios.post(
                '/api/wallet/admin/ajustement',
                {
                    commercialId: selected.ownerId._id,
                    montant: montantSigne,
                    description: description.trim(),
                    motif: motif.trim(),
                },
                { headers: { 'Idempotency-Key': idempotencyKey } }
            );

            if (data.success && data.approvalRequestId) {
                toast.success("Montant au-dessus du seuil : demande envoyée dans Finance > Approbations");
            } else if (data.success) {
                toast.success('Ajustement effectué ✓');
            } else {
                toast.error(data.message);
            }

            fermerPanneau();
            fetchBoutiques();
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-red-500 mx-auto" size={32} />
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-6xl mx-auto">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Portefeuilles commerçants</h1>
                        <p className="text-sm text-gray-500 mt-1">{boutiques.length} commerçant(s)</p>
                    </div>
                </div>

                {/* Recherche */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5 flex items-center gap-2">
                    <Search size={16} className="text-gray-400 shrink-0" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un commerçant, une boutique, un email…"
                        className="w-full outline-none text-sm"
                    />
                </div>

                {/* Liste */}
                <div className="bg-white rounded-2xl border border-gray-200 mt-5 divide-y divide-gray-100 overflow-hidden">
                    {filtrees.length === 0 ? (
                        <div className="text-center py-16">
                            <AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500">Aucun commerçant trouvé</p>
                        </div>
                    ) : filtrees.map((b) => (
                        <button
                            key={b._id}
                            onClick={() => ouvrirPortefeuille(b)}
                            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition text-left"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                    <User size={16} className="text-gray-500" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{b.ownerId?.nom || 'Commerçant'}</p>
                                    <p className="text-xs text-gray-400 truncate">{b.nom} · {b.ownerId?.email}</p>
                                </div>
                            </div>
                            <span className="text-sm font-semibold text-gray-700 shrink-0">
                                {(b.soldeWallet || 0).toLocaleString('fr-FR')} FCFA
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Panneau latéral portefeuille */}
            {selected && (
                <div className="fixed inset-0 z-40 flex justify-end">
                    <div className="absolute inset-0 bg-black/40" onClick={fermerPanneau} />
                    <div className="relative w-full sm:w-[420px] bg-white h-full overflow-y-auto shadow-xl">
                        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-gray-900">{selected.ownerId?.nom}</p>
                                <p className="text-xs text-gray-400">{selected.ownerId?.email}</p>
                            </div>
                            <button onClick={fermerPanneau} className="p-2 rounded-lg hover:bg-gray-100">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-5">
                            {loadingWallet ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="animate-spin text-red-500" size={24} />
                                </div>
                            ) : walletDetail ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-green-50 rounded-xl p-3">
                                        <p className="text-xs text-green-700">Solde retirable</p>
                                        <p className="text-lg font-bold text-green-800">{(walletDetail.solde || 0).toLocaleString('fr-FR')} FCFA</p>
                                    </div>
                                    <div className="bg-yellow-50 rounded-xl p-3">
                                        <p className="text-xs text-yellow-700 flex items-center gap-1"><Clock size={12} /> En attente</p>
                                        <p className="text-lg font-bold text-yellow-800">{(walletDetail.soldeEnAttente || 0).toLocaleString('fr-FR')} FCFA</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">Portefeuille introuvable pour ce commerçant.</p>
                            )}

                            <form onSubmit={soumettreAjustement} className="space-y-3 border-t border-gray-100 pt-4">
                                <p className="text-sm font-semibold text-gray-900">Ajustement manuel</p>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSens('credit')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition ${sens === 'credit' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        <ArrowUpCircle size={15} /> Créditer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSens('debit')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition ${sens === 'debit' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        <ArrowDownCircle size={15} /> Débiter
                                    </button>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500">Montant (FCFA)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={montant}
                                        onChange={(e) => setMontant(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:border-gray-400"
                                        placeholder="Ex : 15000"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500">Description (visible sur le relevé)</label>
                                    <input
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:border-gray-400"
                                        placeholder="Ex : Correction erreur de livraison"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500">Motif interne (min. 10 caractères)</label>
                                    <textarea
                                        value={motif}
                                        onChange={(e) => setMotif(e.target.value)}
                                        rows={3}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:border-gray-400 resize-none"
                                        placeholder="Justification détaillée, conservée dans le journal d'audit"
                                    />
                                </div>

                                <p className="text-xs text-gray-400 flex items-start gap-1.5">
                                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                    Au-dessus du seuil configuré, cet ajustement créera une demande dans
                                    Finance &gt; Approbations au lieu d'être exécuté immédiatement.
                                </p>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                                    Valider l'ajustement
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wallets;