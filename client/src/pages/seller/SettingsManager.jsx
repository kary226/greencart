import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { 
    Settings, 
    Save, 
    Eye, 
    Code2, 
    ArrowLeft,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';

const SettingsManager = () => {
    const { axios } = useAppContext();
    const [returnPolicy, setReturnPolicy] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editorMode, setEditorMode] = useState('rich');
    const [previewMode, setPreviewMode] = useState(false);
    const [saved, setSaved] = useState(false);

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

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data } = await axios.post('/api/setting/update', {
                key: 'return-policy',
                value: returnPolicy
            });
            if (data.success) {
                toast.success('Politique de retour mise à jour ✓');
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
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
        <div className="max-w-5xl mx-auto p-6">
            {/* Header avec badges */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-red-50 rounded-xl">
                        <Settings className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Politique de retour</h1>
                        <p className="text-sm text-gray-500">
                            Gérez la politique de retour et remboursement
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                            <CheckCircle2 className="w-4 h-4" />
                            Sauvegardé
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition disabled:opacity-50 shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </div>

            {/* Cartes des modes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                <button
                    onClick={() => { setEditorMode('rich'); setPreviewMode(false); }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        editorMode === 'rich' && !previewMode
                            ? 'border-red-500 bg-red-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                    <div className={`p-2 rounded-lg ${editorMode === 'rich' && !previewMode ? 'bg-red-100' : 'bg-gray-100'}`}>
                        <Eye className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="text-left">
                        <p className={`text-sm font-medium ${editorMode === 'rich' && !previewMode ? 'text-red-600' : 'text-gray-700'}`}>
                            Éditeur visuel
                        </p>
                        <p className="text-xs text-gray-400">Saisie simplifiée</p>
                    </div>
                </button>

                <button
                    onClick={() => { setEditorMode('html'); setPreviewMode(false); }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        editorMode === 'html' && !previewMode
                            ? 'border-red-500 bg-red-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                    <div className={`p-2 rounded-lg ${editorMode === 'html' && !previewMode ? 'bg-red-100' : 'bg-gray-100'}`}>
                        <Code2 className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="text-left">
                        <p className={`text-sm font-medium ${editorMode === 'html' && !previewMode ? 'text-red-600' : 'text-gray-700'}`}>
                            Code HTML
                        </p>
                        <p className="text-xs text-gray-400">HTML complet</p>
                    </div>
                </button>

                <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        previewMode
                            ? 'border-red-500 bg-red-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                    <div className={`p-2 rounded-lg ${previewMode ? 'bg-red-100' : 'bg-gray-100'}`}>
                        <ArrowLeft className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="text-left">
                        <p className={`text-sm font-medium ${previewMode ? 'text-red-600' : 'text-gray-700'}`}>
                            Aperçu
                        </p>
                        <p className="text-xs text-gray-400">Voir le résultat</p>
                    </div>
                </button>
            </div>

            {/* Éditeur */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        {editorMode === 'rich' && !previewMode && (
                            <span className="text-xs font-medium text-gray-500">📝 Mode visuel</span>
                        )}
                        {editorMode === 'html' && !previewMode && (
                            <span className="text-xs font-medium text-gray-500">🖥️ Mode HTML</span>
                        )}
                        {previewMode && (
                            <span className="text-xs font-medium text-gray-500">👁️ Aperçu</span>
                        )}
                    </div>
                </div>

                <div className="p-4">
                    {previewMode ? (
                        <div 
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: returnPolicy || '<p class="text-gray-400 text-center py-8">Aucun contenu à afficher</p>' }}
                        />
                    ) : editorMode === 'rich' ? (
                        <ReactQuill
                            value={returnPolicy}
                            onChange={setReturnPolicy}
                            theme="snow"
                            placeholder="Ex: Retours acceptés sous 14 jours..."
                            className="bg-white rounded-lg"
                            style={{ minHeight: '300px' }}
                        />
                    ) : (
                        <textarea
                            value={returnPolicy}
                            onChange={(e) => setReturnPolicy(e.target.value)}
                            className="w-full h-[400px] p-4 border border-gray-200 rounded-lg font-mono text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-white"
                            placeholder="Collez votre HTML ici..."
                        />
                    )}
                </div>
            </div>

            {/* Footer info */}
            <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-600">
                    📌 La politique de retour s'affichera dans une section pliable sur chaque page produit.
                    {editorMode === 'html' && ' Le mode HTML permet d\'utiliser du code personnalisé.'}
                </p>
            </div>
        </div>
    );
};

export default SettingsManager;