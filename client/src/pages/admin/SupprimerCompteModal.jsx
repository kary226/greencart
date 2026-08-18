import React, { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Trash2, Loader2, AlertTriangle, Package, Wallet } from 'lucide-react';

// Suppression définitive d'un compte staff, avec le détail de ce qu'elle
// emporte. Partagée par la gestion des comptes et celle des boutiques : les
// deux écrans proposent l'action, elle doit se comporter exactement pareil.
//
// Le serveur reste seul juge (il refuse un portefeuille non soldé ou une
// demande de retrait en attente) ; on lui demande d'abord son verdict pour
// l'afficher AVANT que l'admin ne s'engage.
const SupprimerCompteModal = ({ compte, onClose, onSupprime }) => {
    const { axios } = useAppContext();

    const [apercu, setApercu] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [confirmation, setConfirmation] = useState('');
    const [suppressionEnCours, setSuppressionEnCours] = useState(false);

    const chargerApercu = useCallback(async () => {
        setChargement(true);
        try {
            const { data } = await axios.get(`/api/staff/comptes/${compte._id}/suppression`);
            if (data.success) setApercu(data);
            else toast.error(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setChargement(false);
        }
    }, [axios, compte._id]);

    useEffect(() => { chargerApercu(); }, [chargerApercu]);

    const supprimer = async () => {
        setSuppressionEnCours(true);
        try {
            const { data } = await axios.delete(`/api/staff/comptes/${compte._id}`);
            if (data.success) {
                toast.success(data.message);
                onSupprime?.();
                onClose();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSuppressionEnCours(false);
        }
    };

    const bloquee = (apercu?.bloquants?.length || 0) > 0;
    const estCommercant = apercu?.compte?.role === 'commercant';

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Trash2 size={18} className="text-red-600" /> Supprimer {compte.nom}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{compte.email}</p>

                {chargement ? (
                    <div className="py-8 flex justify-center">
                        <Loader2 className="animate-spin text-gray-400" size={22} />
                    </div>
                ) : bloquee ? (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                        <p className="font-medium flex items-center gap-1.5">
                            <AlertTriangle size={15} /> Suppression impossible pour l'instant
                        </p>
                        <ul className="list-disc list-inside mt-1.5 space-y-1">
                            {apercu.bloquants.map((b) => <li key={b}>{b}</li>)}
                        </ul>
                        <p className="mt-2">
                            Réglez d'abord ces points. En attendant, suspendre la boutique arrête
                            immédiatement son activité.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-500 mt-3">
                            Action <strong>irréversible</strong>.
                            {estCommercant
                                ? ` Seront supprimés : le compte, sa boutique${apercu?.boutique ? ` « ${apercu.boutique.nom} »` : ''}, ses codes promo et son portefeuille.`
                                : ' Le compte et son accès à la plateforme seront supprimés.'}
                        </p>

                        {estCommercant && (
                            <>
                                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-gray-50 rounded-xl p-2.5">
                                        <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                                            <Package size={12} /> Articles
                                        </p>
                                        <p className="font-semibold text-gray-800">{apercu.nombreProduits}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-2.5">
                                        <p className="text-xs text-gray-400">Codes promo</p>
                                        <p className="font-semibold text-gray-800">{apercu.nombreCoupons}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-2.5">
                                        <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                                            <Wallet size={12} /> Solde
                                        </p>
                                        <p className="font-semibold text-gray-800">
                                            {(apercu.soldeWallet || 0).toLocaleString('fr-FR')}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-3">
                                    Les articles restent rattachés aux commandes déjà passées : ils sont archivés,
                                    pas effacés, pour que l'historique des clients reste lisible.
                                </p>
                            </>
                        )}

                        <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">
                            Tapez <span className="font-mono text-red-600">SUPPRIMER</span> pour confirmer
                        </label>
                        <input
                            type="text"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                    </>
                )}

                <div className="flex gap-2 mt-5">
                    {!bloquee && !chargement && (
                        <button
                            onClick={supprimer}
                            disabled={confirmation !== 'SUPPRIMER' || suppressionEnCours}
                            className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {suppressionEnCours ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Supprimer définitivement
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SupprimerCompteModal;
