import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Store, Edit, Save, X, Loader2, Camera, Upload } from 'lucide-react';

const Boutique = () => {
    const { axios } = useAppContext();
    const { boutique, setBoutique } = useOutletContext();

    const [editing, setEditing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [nom, setNom] = useState(boutique?.nom || '');
    const [description, setDescription] = useState(boutique?.description || '');
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    if (!boutique) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-burgundy-600" size={28} /></div>;
    }

    const startEditing = () => {
        setNom(boutique.nom || '');
        setDescription(boutique.description || '');
        setLogoFile(null);
        setLogoPreview(null);
        setEditing(true);
    };

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('nom', nom);
            formData.append('description', description);
            if (logoFile) formData.append('logo', logoFile);

            const { data } = await axios.patch('/api/boutiques/moi', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (data.success) {
                toast.success('Boutique mise à jour');
                setBoutique(data.boutique);
                setEditing(false);
                setLogoFile(null);
                setLogoPreview(null);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-2xl font-semibold text-gray-900">Ma boutique</h1>
                {!editing && (
                    <button onClick={startEditing} className="flex items-center gap-2 bg-burgundy-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-burgundy-700 transition">
                        <Edit size={15} /> Modifier
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-blush-200 overflow-hidden">
                <div className="p-6 border-b border-blush-100 flex items-center gap-5">
                    <div className="relative shrink-0">
                        <div className="w-20 h-20 rounded-2xl bg-blush-100 flex items-center justify-center overflow-hidden">
                            {(logoPreview || boutique.logo) ? (
                                <img src={logoPreview || boutique.logo} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <Camera size={26} className="text-blush-500" />
                            )}
                        </div>
                        {editing && (
                            <label className="absolute -bottom-1.5 -right-1.5 bg-burgundy-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-burgundy-700 transition shadow-sm">
                                <Upload size={13} />
                                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                            </label>
                        )}
                    </div>
                    <div>
                        <h2 className="font-display text-lg font-semibold text-gray-900">{boutique.nom}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {boutique.statut === 'active' ? (
                                <span className="text-green-600 font-medium">● Active</span>
                            ) : (
                                <span className="text-red-600 font-medium">● Suspendue</span>
                            )}
                            <span className="mx-1.5">·</span>
                            Créée le {new Date(boutique.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique</label>
                        <input
                            type="text"
                            value={editing ? nom : boutique.nom}
                            onChange={(e) => setNom(e.target.value)}
                            disabled={!editing}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition ${
                                editing ? 'border-blush-300 focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500' : 'border-transparent bg-ivory-300 text-gray-600'
                            }`}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={editing ? description : (boutique.description || 'Aucune description')}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={!editing}
                            rows={4}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition resize-none ${
                                editing ? 'border-blush-300 focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500' : 'border-transparent bg-ivory-300 text-gray-600'
                            }`}
                            placeholder="Décrivez votre boutique..."
                        />
                    </div>

                    {editing && (
                        <div className="flex items-center gap-3 pt-2">
                            <button type="submit" disabled={uploading} className="flex items-center gap-2 bg-burgundy-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-burgundy-700 transition disabled:opacity-50">
                                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
                            </button>
                            <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-2 bg-ivory-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blush-200 transition">
                                <X size={16} /> Annuler
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default Boutique;