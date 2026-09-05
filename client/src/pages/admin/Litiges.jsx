import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';

/**
 * LITIGES (Super Admin / Admin habilité à trancher)
 * ================================================================
 * Deux fonctions existaient déjà côté serveur mais n'avaient jamais eu
 * d'écran : listLitiges() (une liste détaillée, séparée du filtre
 * générique "Toutes les commandes") et resoudreLitige(). Conséquence
 * concrète : une fois un litige déclaré, RIEN ne permettait de le
 * refermer — la commande restait gelée indéfiniment sur "Litige".
 *
 * Trois façons de trancher (resolution) :
 *   - classe               : classé sans suite, aucun impact financier
 *   - dette_commercant     : retenue sur le portefeuille d'une boutique
 *                            de la commande (boutique + montant requis)
 *   - remboursement_client : crédit RCOINS exceptionnel au client
 *                            (montant requis)
 */

const LABELS_RESOLUTION = {
    classe: 'Classé sans suite',
    dette_commercant: 'Retenue commerçant',
    remboursement_client: 'Remboursement client',
};

const Litiges = () => {
    const { axios, currency } = useAppContext();
    const [tab, setTab] = useState('encours');
    const [litiges, setLitiges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [litigeOuvert, setLitigeOuvert] = useState(null);

    const fetchLitiges = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/order/admin/litiges', {
                params: { enCours: tab === 'encours' ? 'true' : 'false' },
            });
            if (data.success) setLitiges(data.litiges || []);
            else toast.error(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    }, [axios, tab]);

    useEffect(() => { fetchLitiges(); }, [fetchLitiges]);

    const boutiquesDe = (order) => {
        const vues = new Map();
        for (const item of order.items || []) {
            const b = item.product?.boutiqueId;
            if (b?._id) vues.set(b._id, b.nom);
        }
        return Array.from(vues, ([_id, nom]) => ({ _id, nom }));
    };

    const formatDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-4xl mx-auto">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <AlertTriangle className="text-yellow-500" size={22} /> Litiges
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Tant qu'un litige est "en cours", la commande reste gelée — la résoudre ici la débloque.
                        </p>
                    </div>
                    <button onClick={fetchLitiges} className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-100 rounded-xl text-sm hover:bg-gray-200 transition">
                        <RefreshCw size={15} /> Actualiser
                    </button>
                </div>

                <div className="flex gap-2 mt-5">
                    <button
                        onClick={() => setTab('encours')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${tab === 'encours' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                    >
                        En cours
                    </button>
                    <button
                        onClick={() => setTab('resolues')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${tab === 'resolues' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                    >
                        Résolues
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="animate-spin text-gray-400" size={28} />
                    </div>
                ) : litiges.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm mt-5">
                        {tab === 'encours' ? 'Aucun litige en cours.' : 'Aucun litige résolu pour l\'instant.'}
                    </div>
                ) : (
                    <div className="space-y-3 mt-5">
                        {litiges.map((order) => (
                            <div key={order._id} className="bg-white rounded-2xl border border-gray-200 p-5">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900">
                                            #{order._id.slice(-8).toUpperCase()} · {order.amount} {currency}
                                        </p>
                                        <p className="text-sm text-gray-700 mt-1.5">{order.litige.raison}</p>
                                        <p className="text-xs text-gray-400 mt-1.5">
                                            Déclaré par {order.litige.declareParNom} le {formatDate(order.litige.declareLe)}
                                            {order.litige.statutAvant && ` · statut gelé : ${order.litige.statutAvant}`}
                                        </p>
                                        {tab === 'resolues' && (
                                            <p className="text-xs text-green-700 bg-green-50 inline-block px-2 py-1 rounded-lg mt-2">
                                                {LABELS_RESOLUTION[order.litige.resolution] || order.litige.resolution}
                                                {order.litige.resoluPar?.nom && ` — par ${order.litige.resoluPar.nom}`}
                                                {order.litige.note && ` — "${order.litige.note}"`}
                                            </p>
                                        )}
                                    </div>
                                    {tab === 'encours' && (
                                        <button
                                            onClick={() => setLitigeOuvert(order)}
                                            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition shrink-0"
                                        >
                                            Résoudre
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {litigeOuvert && (
                <ResoudreLitigeModal
                    order={litigeOuvert}
                    boutiques={boutiquesDe(litigeOuvert)}
                    onClose={() => setLitigeOuvert(null)}
                    onResolved={() => { setLitigeOuvert(null); fetchLitiges(); }}
                />
            )}
        </div>
    );
};

const ResoudreLitigeModal = ({ order, boutiques, onClose, onResolved }) => {
    const { axios } = useAppContext();
    const [resolution, setResolution] = useState('classe');
    const [boutiqueId, setBoutiqueId] = useState(boutiques[0]?._id || '');
    const [montant, setMontant] = useState('');
    const [note, setNote] = useState('');
    const [envoi, setEnvoi] = useState(false);

    const soumettre = async () => {
        if (resolution === 'dette_commercant' && (!boutiqueId || !(Number(montant) > 0))) {
            toast.error('Choisis une boutique et un montant positif');
            return;
        }
        if (resolution === 'remboursement_client' && !(Number(montant) > 0)) {
            toast.error('Indique un montant positif à rembourser');
            return;
        }
        setEnvoi(true);
        try {
            const { data } = await axios.post('/api/order/admin/litige/resoudre', {
                orderId: order._id,
                resolution,
                boutiqueId: resolution === 'dette_commercant' ? boutiqueId : undefined,
                montant: resolution === 'classe' ? undefined : Number(montant),
                note: note.trim() || undefined,
            });
            if (data.success) {
                toast.success('Litige résolu');
                onResolved();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setEnvoi(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Résoudre le litige</h2>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <p className="text-sm text-gray-500 mb-4">#{order._id.slice(-8).toUpperCase()} — {order.litige.raison}</p>

                <label className="text-xs font-medium text-gray-500">Décision</label>
                <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full mt-1 mb-4 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none"
                >
                    <option value="classe">Classé sans suite (aucun impact financier)</option>
                    <option value="dette_commercant">Retenue sur un commerçant</option>
                    <option value="remboursement_client">Remboursement au client (RCOINS)</option>
                </select>

                {resolution === 'dette_commercant' && (
                    <>
                        <label className="text-xs font-medium text-gray-500">Boutique concernée</label>
                        {boutiques.length === 0 ? (
                            <p className="text-xs text-red-500 mb-4">Aucune boutique identifiée sur cette commande.</p>
                        ) : (
                            <select
                                value={boutiqueId}
                                onChange={(e) => setBoutiqueId(e.target.value)}
                                className="w-full mt-1 mb-4 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none"
                            >
                                {boutiques.map((b) => <option key={b._id} value={b._id}>{b.nom}</option>)}
                            </select>
                        )}
                    </>
                )}

                {resolution !== 'classe' && (
                    <>
                        <label className="text-xs font-medium text-gray-500">Montant (FCFA)</label>
                        <input
                            type="number"
                            value={montant}
                            onChange={(e) => setMontant(e.target.value)}
                            className="w-full mt-1 mb-4 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none"
                            placeholder="0"
                        />
                    </>
                )}

                <label className="text-xs font-medium text-gray-500">Note (optionnelle)</label>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full mt-1 mb-5 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none resize-none"
                />

                <button
                    onClick={soumettre}
                    disabled={envoi}
                    className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {envoi ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Confirmer la résolution
                </button>
            </div>
        </div>
    );
};

export default Litiges;