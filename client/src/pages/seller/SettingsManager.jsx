import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const SettingsManager = () => {
    const { axios } = useAppContext();
    const [returnPolicy, setReturnPolicy] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editorMode, setEditorMode] = useState('html'); // Par défaut HTML

    // Moyens de paiement actifs au checkout — un interrupteur simple par
    // moyen, pour pouvoir désactiver Jèko en un clic si l'intégration pose
    // problème, sans toucher au code ni redéployer.
    const [paymentMethods, setPaymentMethods] = useState({ geniuspay: true, jeko: false });
    const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);

    useEffect(() => {
        const fetchReturnPolicy = async () => {
            try {
                const { data } = await axios.get('/api/setting/return-policy');
                if (data.success) {
                    setReturnPolicy(data.data || '');
                }
            } catch (error) {
                console.error('Erreur chargement politique:', error);
            } finally {
                setLoading(false);
            }
        };
        const fetchPaymentMethods = async () => {
            try {
                const { data } = await axios.get('/api/setting/paymentMethodsEnabled');
                if (data.success && data.data) {
                    setPaymentMethods((p) => ({ ...p, ...data.data }));
                }
            } catch (error) {
                // Pas encore configuré — reste sur les valeurs par défaut
            }
        };
        fetchReturnPolicy();
        fetchPaymentMethods();
    }, []);

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
                setPaymentMethods(paymentMethods); // annule le changement optimiste
            }
        } catch (error) {
            toast.error(error.message);
            setPaymentMethods(paymentMethods);
        } finally {
            setSavingPaymentMethods(false);
        }
    };

    const handleSave = async () => {
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
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 grid gap-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h1 className="text-2xl font-bold text-gray-900">Moyens de paiement</h1>
                <p className="text-sm text-gray-500 mt-1 mb-5">
                    Actifs sur la page de paiement client. Désactive-en un à tout moment sans redéployer.
                </p>

                <div className="grid gap-3">
                    {[
                        { key: 'geniuspay', label: 'GeniusPay', desc: 'Mobile Money, Wave, Carte — en place depuis le début.' },
                        { key: 'jeko', label: 'Jèko', desc: "En cours d'intégration — n'activer qu'une fois testé." },
                    ].map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3.5">
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">{label}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                            </div>
                            <button
                                onClick={() => togglePaymentMethod(key)}
                                disabled={savingPaymentMethods}
                                role="switch"
                                aria-checked={paymentMethods[key]}
                                className={`shrink-0 w-11 h-6 rounded-full transition relative disabled:opacity-50 ${paymentMethods[key] ? 'bg-red-500' : 'bg-gray-300'}`}
                            >
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${paymentMethods[key] ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Politique de retour</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Gérez la politique de retour et remboursement affichée sur chaque produit
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                    >
                        {saving ? 'Enregistrement...' : '💾 Enregistrer'}
                    </button>
                </div>

                <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-3 mb-3">
                        <label className="text-sm font-medium text-gray-700">Mode d'édition :</label>
                        <button
                            onClick={() => setEditorMode('rich')}
                            className={`px-3 py-1.5 text-xs rounded-lg transition ${
                                editorMode === 'rich' 
                                    ? 'bg-red-500 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            📝 Éditeur visuel
                        </button>
                        <button
                            onClick={() => setEditorMode('html')}
                            className={`px-3 py-1.5 text-xs rounded-lg transition ${
                                editorMode === 'html' 
                                    ? 'bg-red-500 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            🖥️ Code HTML (recommandé)
                        </button>
                    </div>

                    <p className="text-xs text-gray-400 mb-2">
                        {editorMode === 'html' 
                            ? '💡 Mode HTML : collez votre code HTML complet. Il sera conservé tel quel.'
                            : '💡 Éditeur visuel : saisissez votre texte simplement.'}
                    </p>

                    {editorMode === 'rich' ? (
                        <ReactQuill
                            value={returnPolicy}
                            onChange={setReturnPolicy}
                            theme="snow"
                            placeholder="Ex: Retours acceptés sous 14 jours..."
                            className="bg-white rounded-lg"
                            style={{ minHeight: '250px' }}
                        />
                    ) : (
                        <textarea
                            value={returnPolicy}
                            onChange={(e) => setReturnPolicy(e.target.value)}
                            className="w-full h-[500px] p-4 border border-gray-200 rounded-lg font-mono text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-white"
                            placeholder="Collez votre HTML ici..."
                        />
                    )}
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
                    <span className="text-blue-500">💡</span>
                    <p className="text-xs text-blue-600">
                        {editorMode === 'html' 
                            ? 'Le mode HTML conserve exactement votre code. Utilisez-le pour un design personnalisé.'
                            : 'L\'éditeur visuel est plus simple mais peut modifier votre mise en page.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SettingsManager;