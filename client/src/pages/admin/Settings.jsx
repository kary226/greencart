import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Save, Loader2, Shield, CreditCard, Package, Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
    const { axios } = useAppContext();
    const [returnPolicy, setReturnPolicy] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editorMode, setEditorMode] = useState('html');

    // Moyens de paiement
    const [paymentMethods, setPaymentMethods] = useState({ jeko: true });
    const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);

    // Colis Shein
    const [colisSheinActif, setColisSheinActif] = useState(false);
    const [savingColis, setSavingColis] = useState(false);

    // Seuils d'approbation (Phase 2)
    const [thresholds, setThresholds] = useState({
        wallet_adjust: 50000,
        withdrawal: 100000,
    });
    const [savingThresholds, setSavingThresholds] = useState(false);

    // État de chargement des seuils
    const [loadingThresholds, setLoadingThresholds] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const [policyRes, paymentRes, colisRes, thresholdsRes] = await Promise.all([
                    axios.get('/api/setting/return-policy'),
                    axios.get('/api/setting/paymentMethodsEnabled'),
                    axios.get('/api/setting/colisSheinActif'),
                    axios.get('/api/setting/financeApprovalThresholds'),
                ]);

                if (policyRes.data.success) setReturnPolicy(policyRes.data.data || '');
                if (paymentRes.data.success && paymentRes.data.data) setPaymentMethods(p => ({ ...p, ...paymentRes.data.data }));
                if (colisRes.data.success) setColisSheinActif(colisRes.data.data === true);
                if (thresholdsRes.data.success && thresholdsRes.data.data) {
                    setThresholds({
                        wallet_adjust: thresholdsRes.data.data.wallet_adjust_threshold || 50000,
                        withdrawal: thresholdsRes.data.data.withdrawal_threshold || 100000,
                    });
                }
            } catch (error) {
                console.error('Erreur chargement paramètres:', error);
            } finally {
                setLoading(false);
                setLoadingThresholds(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSaveReturnPolicy = async () => {
        setSaving(true);
        try {
            const { data } = await axios.post('/api/setting/update', {
                key: 'return-policy',
                value: returnPolicy
            });
            if (data.success) {
                toast.success('Politique de retour mise à jour ✓');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSaving(false);
        }
    };

    const togglePaymentMethod = async (key) => {
        const next = { ...paymentMethods, [key]: !paymentMethods[key] };
        setPaymentMethods(next);
        setSavingPaymentMethods(true);
        try {
            const { data } = await axios.post('/api/setting/update', {
                key: 'paymentMethodsEnabled',
                value: next,
            });
            if (data.success) {
                toast.success('Moyens de paiement mis à jour ✓');
            } else {
                toast.error(data.message);
                setPaymentMethods(paymentMethods);
            }
        } catch (error) {
            toast.error(error.message);
            setPaymentMethods(paymentMethods);
        } finally {
            setSavingPaymentMethods(false);
        }
    };

    const toggleColisShein = async () => {
        const next = !colisSheinActif;
        setColisSheinActif(next);
        setSavingColis(true);
        try {
            const { data } = await axios.post('/api/setting/update', {
                key: 'colisSheinActif',
                value: next,
            });
            if (data.success) {
                toast.success(next ? 'Section Colis activée ✓' : 'Section Colis masquée ✓');
            } else {
                toast.error(data.message);
                setColisSheinActif(!next);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
            setColisSheinActif(!next);
        } finally {
            setSavingColis(false);
        }
    };

    const handleSaveThresholds = async () => {
        setSavingThresholds(true);
        try {
            const { data } = await axios.post('/api/setting/update', {
                key: 'financeApprovalThresholds',
                value: {
                    wallet_adjust_threshold: Number(thresholds.wallet_adjust),
                    withdrawal_threshold: Number(thresholds.withdrawal),
                },
            });
            if (data.success) {
                toast.success('Seuils d\'approbation mis à jour ✓');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSavingThresholds(false);
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
            <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
                    <p className="text-sm text-gray-500 mt-1">Gérez les paramètres de la plateforme</p>
                </div>

                {/* Sections du site */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Package size={18} /> Sections du site
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Affiche ou masque des sections entières côté client</p>
                    <div className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3.5">
                        <div>
                            <p className="font-semibold text-gray-800 text-sm">Colis SHEIN</p>
                            <p className="text-xs text-gray-500 mt-0.5">Onglet « Colis » de la barre du bas</p>
                        </div>
                        <button onClick={toggleColisShein} disabled={savingColis} role="switch" aria-checked={colisSheinActif} className={`shrink-0 w-11 h-6 rounded-full transition relative disabled:opacity-50 ${colisSheinActif ? 'bg-red-500' : 'bg-gray-300'}`}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${colisSheinActif ? 'left-[22px]' : 'left-0.5px'}`} />
                        </button>
                    </div>
                </div>

                {/* Moyens de paiement */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <CreditCard size={18} /> Moyens de paiement
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Interrupteur d'urgence — coupe les paiements en ligne</p>
                    <div className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3.5">
                        <div>
                            <p className="font-semibold text-gray-800 text-sm">Jèko</p>
                            <p className="text-xs text-gray-500 mt-0.5">Mobile Money, Wave — seul moyen en ligne</p>
                        </div>
                        <button onClick={() => togglePaymentMethod('jeko')} disabled={savingPaymentMethods} role="switch" aria-checked={paymentMethods.jeko} className={`shrink-0 w-11 h-6 rounded-full transition relative disabled:opacity-50 ${paymentMethods.jeko ? 'bg-red-500' : 'bg-gray-300'}`}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${paymentMethods.jeko ? 'left-[22px]' : 'left-0.5px'}`} />
                        </button>
                    </div>
                </div>

                {/* Seuils d'approbation */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Shield size={18} /> Seuils d'approbation
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Au-dessus de ces montants, une double approbation est requise</p>
                    {loadingThresholds ? (
                        <Loader2 className="animate-spin text-red-500 mx-auto" size={24} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ajustement de wallet (FCFA)</label>
                                <input type="number" value={thresholds.wallet_adjust} onChange={(e) => setThresholds({ ...thresholds, wallet_adjust: parseInt(e.target.value) || 0 })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" />
                                <p className="text-xs text-gray-400 mt-1">Actuel : {thresholds.wallet_adjust.toLocaleString('fr-FR')} FCFA</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Retrait (FCFA)</label>
                                <input type="number" value={thresholds.withdrawal} onChange={(e) => setThresholds({ ...thresholds, withdrawal: parseInt(e.target.value) || 0 })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-gray-400 outline-none" />
                                <p className="text-xs text-gray-400 mt-1">Actuel : {thresholds.withdrawal.toLocaleString('fr-FR')} FCFA</p>
                            </div>
                            <div className="md:col-span-2">
                                <button onClick={handleSaveThresholds} disabled={savingThresholds} className="flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                    {savingThresholds ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Enregistrer les seuils
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Politique de retour */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <SettingsIcon size={18} /> Politique de retour
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Affichée sur chaque produit</p>
                        </div>
                        <button onClick={handleSaveReturnPolicy} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Enregistrer
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-medium text-gray-700">Mode :</span>
                        <button onClick={() => setEditorMode('rich')} className={`px-3 py-1.5 text-xs rounded-lg transition ${editorMode === 'rich' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>📝 Visuel</button>
                        <button onClick={() => setEditorMode('html')} className={`px-3 py-1.5 text-xs rounded-lg transition ${editorMode === 'html' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>🖥️ HTML</button>
                    </div>

                    {editorMode === 'rich' ? (
                        <ReactQuill value={returnPolicy} onChange={setReturnPolicy} theme="snow" placeholder="Ex: Retours acceptés sous 14 jours..." className="bg-white rounded-lg" style={{ minHeight: '250px' }} />
                    ) : (
                        <textarea value={returnPolicy} onChange={(e) => setReturnPolicy(e.target.value)} className="w-full h-[300px] p-4 border border-gray-200 rounded-lg font-mono text-sm focus:border-gray-400 outline-none bg-white" placeholder="Collez votre HTML ici..." />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;