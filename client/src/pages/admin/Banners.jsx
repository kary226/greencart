import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ImageCropper from '../../components/ImageCropper';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import { Plus, X, Loader2, Image as ImageIcon } from 'lucide-react';

const Banners = () => {
    const { axios } = useAppContext();
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [imageType, setImageType] = useState('url');
    const [imageFile, setImageFile] = useState(null);
    const [imageUrl, setImageUrl] = useState('');
    const [imagePreview, setImagePreview] = useState('');
    const [showCropper, setShowCropper] = useState(false);
    const [tempImageFile, setTempImageFile] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        link: '/products',
        order: 0,
        position: 'top'
    });
    const [submitting, setSubmitting] = useState(false);

    const fetchBanners = async () => {
        try {
            const { data } = await axios.get('/api/banner/admin-list');
            if (data.success) setBanners(data.banners);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBanners();
    }, []);

    const handleImageFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setTempImageFile(file);
            setShowCropper(true);
        }
    };

    const handleCropComplete = (croppedBlob) => {
        const file = new File([croppedBlob], `banner-${Date.now()}.png`, { type: 'image/png' });
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setShowCropper(false);
        setTempImageFile(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const formDataToSend = new FormData();
        formDataToSend.append('title', formData.title || '');
        formDataToSend.append('subtitle', formData.subtitle || '');
        formDataToSend.append('link', formData.link);
        formDataToSend.append('order', formData.order || 0);
        formDataToSend.append('position', formData.position || 'top');

        if (imageType === 'upload' && imageFile) {
            formDataToSend.append('image', imageFile);
        } else if (imageType === 'url' && imageUrl) {
            formDataToSend.append('imageUrl', imageUrl);
        } else {
            toast.error('Veuillez choisir une image');
            setSubmitting(false);
            return;
        }

        if (editingBanner) {
            formDataToSend.append('id', editingBanner._id);
        }

        try {
            const endpoint = editingBanner ? '/api/banner/update' : '/api/banner/add';
            const { data } = await axios.post(endpoint, formDataToSend, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (data.success) {
                toast.success(data.message);
                setShowForm(false);
                resetForm();
                fetchBanners();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setEditingBanner(null);
        setImageFile(null);
        setImageUrl('');
        setImagePreview('');
        setFormData({ title: '', subtitle: '', link: '/products', order: 0, position: 'top' });
        setImageType('url');
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer cette bannière ?')) return;
        try {
            const { data } = await axios.post('/api/banner/delete', { id });
            if (data.success) {
                toast.success(data.message);
                fetchBanners();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleEdit = (banner) => {
        setEditingBanner(banner);
        setFormData({
            title: banner.title || '',
            subtitle: banner.subtitle || '',
            link: banner.link,
            order: banner.order,
            position: banner.position || 'top'
        });
        setImagePreview(banner.image);
        setImageUrl(banner.image);
        setImageFile(null);
        setImageType('url');
        setShowForm(true);
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
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                {/* En-tête */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Bannières</h1>
                        <p className="text-sm text-gray-500 mt-1">{banners.length} bannière(s)</p>
                    </div>
                    <button
                        onClick={() => {
                            resetForm();
                            setShowForm(!showForm);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                    >
                        <Plus size={16} />
                        {showForm ? 'Annuler' : 'Ajouter une bannière'}
                    </button>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-5">
                        <h2 className="font-semibold text-gray-900 mb-4">
                            {editingBanner ? 'Modifier' : 'Nouvelle'} bannière
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Source de l'image</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" value="url" checked={imageType === 'url'} onChange={() => setImageType('url')} />
                                        <span className="text-sm">URL</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" value="upload" checked={imageType === 'upload'} onChange={() => setImageType('upload')} />
                                        <span className="text-sm">Upload</span>
                                    </label>
                                </div>
                            </div>

                            {imageType === 'upload' ? (
                                <div>
                                    <input type="file" accept="image/*" onChange={handleImageFileChange} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" required={!editingBanner} />
                                    <p className="text-xs text-gray-400 mt-1">Recadrage automatique 16:9</p>
                                </div>
                            ) : (
                                <div>
                                    <input type="text" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} placeholder="https://exemple.com/image.jpg" className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" required={!editingBanner} />
                                </div>
                            )}

                            {imagePreview && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Aperçu</label>
                                    <img src={imagePreview} alt="Aperçu" className="w-32 h-20 object-cover rounded-lg border border-gray-200" />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                                    <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" placeholder="Ex: Promotion" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sous-titre</label>
                                    <input type="text" value={formData.subtitle} onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" placeholder="Ex: Livraison gratuite" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lien</label>
                                <input type="text" value={formData.link} onChange={(e) => setFormData({ ...formData, link: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" placeholder="/products" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ordre</label>
                                    <input type="number" value={formData.order} onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} className="w-32 border border-gray-200 rounded-xl px-4 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                                    <select value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm">
                                        <option value="top">Carrousel haut</option>
                                        <option value="bottom">Bannière bas</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                    {submitting ? <Loader2 size={16} className="animate-spin inline" /> : (editingBanner ? 'Mettre à jour' : 'Ajouter')}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Liste */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                    {banners.map((banner) => (
                        <div key={banner._id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition">
                            <div className="relative">
                                <img src={getPresetImageUrl(banner.image, 'card')} alt={banner.title || 'Bannière'} className="w-full h-48 object-cover" loading="lazy" />
                                <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-medium text-white ${banner.position === 'top' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                                    {banner.position === 'top' ? 'Haut' : 'Bas'}
                                </div>
                            </div>
                            <div className="p-4">
                                {banner.title && <h3 className="font-semibold text-gray-900">{banner.title}</h3>}
                                {banner.subtitle && <p className="text-sm text-gray-500">{banner.subtitle}</p>}
                                <div className="mt-2 text-xs text-gray-400">
                                    <p>Lien : <span className="text-gray-600 break-all">{banner.link}</span></p>
                                    <p>Ordre : {banner.order}</p>
                                </div>
                                <div className="flex gap-2 mt-3">
                                    <button onClick={() => handleEdit(banner)} className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Modifier</button>
                                    <button onClick={() => handleDelete(banner._id)} className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Supprimer</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {banners.length === 0 && !showForm && (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <ImageIcon size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucune bannière</p>
                        <p className="text-sm text-gray-400 mt-1">Cliquez sur "Ajouter une bannière" pour commencer</p>
                    </div>
                )}
            </div>

            {showCropper && (
                <ImageCropper
                    imageFile={tempImageFile}
                    onCropComplete={handleCropComplete}
                    onCancel={() => { setShowCropper(false); setTempImageFile(null); }}
                    aspectRatio={16 / 9}
                />
            )}
        </div>
    );
};

export default Banners;