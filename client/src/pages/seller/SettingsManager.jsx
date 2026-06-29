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

    // Récupérer la politique actuelle
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
        fetchReturnPolicy();
    }, []);

    // Sauvegarder la politique
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
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contenu de la politique de retour
                    </label>
                    <p className="text-xs text-gray-400 mb-3">
                        💡 Ce texte s'affichera dans la section "Politique de retour" sur chaque page produit.
                    </p>
                    <ReactQuill
                        value={returnPolicy}
                        onChange={setReturnPolicy}
                        theme="snow"
                        placeholder="Ex: Retours acceptés sous 14 jours. Le produit doit être neuf, non porté..."
                        className="bg-white rounded-lg"
                        style={{ minHeight: '250px' }}
                    />
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-400">
                        📌 La politique de retour sera affichée sur chaque page produit dans une section pliable.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SettingsManager;