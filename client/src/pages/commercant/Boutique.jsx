import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Store, Edit, Save, X, Loader2, Camera, Upload } from 'lucide-react';

const Boutique = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [boutique, setBoutique] = useState(null);
    const [formData, setFormData] = useState({ nom: '', description: '', logo: '' });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const loadBoutique = async () => {
            try {
                const { data } = await axios.get('/api/boutiques/moi');
                if (data.success) {
                    setBoutique(data.boutique);
                    setFormData({
                        nom: data.boutique.nom || '',
                        description: data.boutique.description || '',
                        logo: data.boutique.logo || '',
                    });
                    if (data.boutique.logo) setLogoPreview(data.boutique.logo);
                }
            } catch (error) {
                toast.error(error.response?.data?.message || error.message);
            } finally {
                setLoading(false);
            }
        };
        loadBoutique();
    }, [axios]);

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
            let logoUrl = formData.logo;
            if (logoFile) {
                const formDataUpload = new FormData();
                formDataUpload.append('image', logoFile);
                const { data: uploadData } = await axios.post('/api/upload', formDataUpload);
                if (uploadData.success) logoUrl = uploadData.url;
                else throw new Error('Erreur lors de l\'upload du logo');
            }

            const { data } = await axios.patch('/api/boutiques/moi', {
                nom: formData.nom,
                description: formData.description,
                logo: logoUrl,
            });

            if (data.success) {
                toast.success('Boutique mise à jour avec succès');
                setBoutique(data.boutique);
                setEditing(false);
                setLogoFile(null);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setUploading(false);
        }
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
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Store size={24} />
                            <div>
                                <h1 className="text-lg font-bold">Ma boutique</h1>
                                <p className="text-sm text-blush-300">Gérez les informations de votre boutique</p>
                            </div>
                        </div>
                        {!editing && (
                            <button onClick={() => setEditing(true)} className="flex items-center gap-2 bg-blush-200 text-burgundy-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blush-300 transition">
                                <Edit size={16} /> Modifier
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="bg-white rounded-xl shadow-sm border border-blush-300 overflow-hidden">
                    <div className="p-6 border-b border-blush-200">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-xl bg-blush-200 flex items-center justify-center overflow-hidden">
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <Camera size={32} className="text-gray-400" />
                                    )}
                                </div>
                                {editing && (
                                    <label className="absolute -bottom-2 -right-2 bg-burgundy-600 text-ivory-200 p-1.5 rounded-full cursor-pointer hover:bg-burgundy-700 transition shadow-md">
                                        <Upload size={14} />
                                        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                                    </label>
                                )}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">{boutique?.nom || 'Ma boutique'}</h2>
                                <p className="text-sm text-gray-500">{boutique?.statut === 'active' ? '🟢 Active' : '🔴 Suspendue'}</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique *</label>
                            <input
                                type="text"
                                value={formData.nom}
                                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                disabled={!editing}
                                className={`w-full px-4 py-2.5 rounded-lg border ${
                                    editing ? 'border-blush-300 focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500' : 'border-gray-200 bg-gray-50'
                                } outline-none transition text-sm`}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                disabled={!editing}
                                rows={4}
                                className={`w-full px-4 py-2.5 rounded-lg border ${
                                    editing ? 'border-blush-300 focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500' : 'border-gray-200 bg-gray-50'
                                } outline-none transition text-sm resize-none`}
                                placeholder="Décrivez votre boutique..."
                            />
                        </div>
                        {editing && (
                            <div className="flex items-center gap-3 pt-4 border-t border-blush-200">
                                <button type="submit" disabled={uploading} className="flex items-center gap-2 bg-burgundy-600 text-ivory-200 px-6 py-2.5 rounded-lg font-medium hover:bg-burgundy-700 transition disabled:opacity-50">
                                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Enregistrer
                                </button>
                                <button type="button" onClick={() => {
                                    setEditing(false);
                                    setFormData({ nom: boutique?.nom || '', description: boutique?.description || '', logo: boutique?.logo || '' });
                                    setLogoPreview(boutique?.logo || null);
                                    setLogoFile(null);
                                }} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition">
                                    <X size={18} /> Annuler
                                </button>
                            </div>
                        )}
                    </form>
                </div>

                <div className="mt-4 bg-white rounded-xl shadow-sm border border-blush-300 p-6">
                    <h3 className="font-semibold text-gray-800 mb-2">📊 Informations</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-gray-500">ID</p><p className="font-medium text-gray-800">{boutique?._id?.slice(-8)}</p></div>
                        <div><p className="text-gray-500">Créée le</p><p className="font-medium text-gray-800">{boutique?.createdAt ? new Date(boutique.createdAt).toLocaleDateString('fr-FR') : '-'}</p></div>
                        <div><p className="text-gray-500">Statut</p><p className={`font-medium ${boutique?.statut === 'active' ? 'text-green-600' : 'text-red-600'}`}>{boutique?.statut === 'active' ? 'Active' : 'Suspendue'}</p></div>
                        <div><p className="text-gray-500">Propriétaire</p><p className="font-medium text-gray-800">{boutique?.ownerId?.nom || '-'}</p></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Boutique;