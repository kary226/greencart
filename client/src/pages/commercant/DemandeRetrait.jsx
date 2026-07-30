import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { DollarSign, Send, Loader2, Clock, CheckCircle, XCircle, Wallet } from 'lucide-react';

const DemandeRetrait = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [wallet, setWallet] = useState(null);
    const [demandes, setDemandes] = useState([]);
    const [formData, setFormData] = useState({ montant: '', moyenPaiement: '' });

    const loadData = async () => {
        setLoading(true);
        try {
            const [walletRes, demandesRes] = await Promise.all([
                axios.get('/api/wallet/moi'),
                axios.get('/api/retraits/moi'),
            ]);
            if (walletRes.data.success) setWallet(walletRes.data.wallet);
            if (demandesRes.data.success) setDemandes(demandesRes.data.demandes);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const montant = parseInt(formData.montant);
        if (montant < 1000) { toast.error('Le montant minimum est de 1000 FCFA'); return; }
        if (!formData.moyenPaiement.trim()) { toast.error('Veuillez indiquer un moyen de paiement'); return; }

        setSubmitting(true);
        try {
            const { data } = await axios.post('/api/retraits', {
                montant,
                moyenPaiement: formData.moyenPaiement.trim(),
            });
            if (data.success) {
                toast.success('Demande de retrait créée avec succès');
                setFormData({ montant: '', moyenPaiement: '' });
                loadData();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (statut) => {
        const config = {
            en_attente: { label: 'En attente', className: 'bg-amber-100 text-amber-700', icon: Clock },
            approuvee: { label: 'Approuvée', className: 'bg-blue-100 text-blue-700', icon: CheckCircle },
            rejetee: { label: 'Rejetée', className: 'bg-red-100 text-red-700', icon: XCircle },
            payee: { label: 'Payée ✅', className: 'bg-green-100 text-green-700', icon: CheckCircle },
        };
        const c = config[statut] || config.en_attente;
        const Icon = c.icon;
        return (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${c.className}`}>
                <Icon size={12} /> {c.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-ivory-200 flex items-center justify-center">
                <Loader2 className="animate-spin text-burgundy-600" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ivory-200">
            <div className="bg-burgundy-600 text-ivory-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <DollarSign size={24} />
                        <div><h1 className="text-lg font-bold">Demandes de retrait</h1><p className="text-sm text-blush-300">Retirez vos gains</p></div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="bg-gradient-to-r from-burgundy-600 to-burgundy-800 rounded-xl shadow-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div><p className="text-blush-300 text-sm">Solde disponible</p><p className="text-2xl font-bold text-ivory-200">{wallet?.solde?.toLocaleString() || 0} FCFA</p></div>
                        <Wallet size={32} className="text-blush-300/50" />
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-6 mb-6">
                    <h2 className="font-semibold text-gray-800 mb-4">💰 Nouvelle demande de retrait</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA) *</label>
                            <input type="number" min="1000" step="100" value={formData.montant} onChange={(e) => setFormData({ ...formData, montant: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-blush-300 focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500 outline-none transition text-sm" placeholder="1000" required />
                            <p className="text-xs text-gray-400 mt-1">Minimum : 1000 FCFA</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Moyen de paiement *</label>
                            <input type="text" value={formData.moyenPaiement} onChange={(e) => setFormData({ ...formData, moyenPaiement: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-blush-300 focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500 outline-none transition text-sm" placeholder="Orange Money 07 12 34 56 78" required />
                            <p className="text-xs text-gray-400 mt-1">Ex: Orange Money / MTN Mobile Money / Banque + numéro</p>
                        </div>
                        <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-burgundy-600 text-ivory-200 px-6 py-2.5 rounded-lg font-medium hover:bg-burgundy-700 transition disabled:opacity-50">
                            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Soumettre la demande
                        </button>
                    </form>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-blush-300 overflow-hidden">
                    <div className="px-6 py-4 border-b border-blush-200"><h2 className="font-semibold text-gray-800">📋 Historique des demandes ({demandes.length})</h2></div>
                    {demandes.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Aucune demande de retrait pour le moment</div>
                    ) : (
                        <div className="divide-y divide-blush-200">
                            {demandes.map((demande) => (
                                <div key={demande._id} className="px-6 py-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{demande.montant.toLocaleString()} FCFA</p>
                                        <p className="text-xs text-gray-500">{new Date(demande.createdAt).toLocaleString('fr-FR')}</p>
                                        <p className="text-xs text-gray-400">{demande.moyenPaiement}</p>
                                        {demande.noteAdmin && <p className="text-xs text-amber-600 mt-1">Note: {demande.noteAdmin}</p>}
                                    </div>
                                    <div className="text-right">
                                        {getStatusBadge(demande.statut)}
                                        {demande.preuvePaiement && (
                                            <button onClick={() => window.open(demande.preuvePaiement, '_blank')} className="block mt-1 text-xs text-burgundy-600 hover:underline">Voir la preuve</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DemandeRetrait;