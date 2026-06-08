import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ImageCropper from '../../components/ImageCropper';

const BannerManager = () => {
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

    const fetchBanners = async () => {
        try {
            const { data } = await axios.get('/api/banner/admin-list');
            if (data.success) {
                setBanners(data.banners);
            }
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

    const handleCropComplete = (croppedFile) => {
        setImageFile(croppedFile);
        setImagePreview(URL.createObjectURL(croppedFile));
        setShowCropper(false);
        setTempImageFile(null);
    };

    const handleImageUrlChange = (e) => {
        const url = e.target.value;
        setImageUrl(url);
        setImagePreview(url);
        setImageFile(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const formDataToSend = new FormData();
        formDataToSend.append('title', formData.title);
        formDataToSend.append('subtitle', formData.subtitle);
        formDataToSend.append('link', formData.link);
        formDataToSend.append('order', formData.order);
        formDataToSend.append('position', formData.position);
        
        if (imageType === 'upload' && imageFile) {
            formDataToSend.append('image', imageFile);
        } else if (imageType === 'url' && imageUrl) {
            formDataToSend.append('imageUrl', imageUrl);
        } else {
            toast.error('Veuillez choisir une image (upload ou URL)');
            return;
        }

        try {
            let res;
            if (editingBanner) {
                formDataToSend.append('id', editingBanner._id);
                res = await axios.post('/api/banner/update', formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await axios.post('/api/banner/add', formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            
            if (res.data.success) {
                toast.success(res.data.message);
                setShowForm(false);
                setEditingBanner(null);
                setImageFile(null);
                setImageUrl('');
                setImagePreview('');
                setFormData({ title: '', subtitle: '', link: '/products', order: 0, position: 'top' });
                fetchBanners();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
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
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-500">Chargement des bannières...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Bannières</h1>
                        <p className="text-sm text-gray-500 mt-1">Gérez les bannières du site (carrousel haut et bas)</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingBanner(null);
                            setFormData({ title: '', subtitle: '', link: '/products', order: 0, position: 'top' });
                            setImageFile(null);
                            setImageUrl('');
                            setImagePreview('');
                            setImageType('url');
                            setShowForm(!showForm);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="16"/>
                            <line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                        {showForm ? 'Annuler' : 'Ajouter une bannière'}
                    </button>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingBanner ? 'Modifier la bannière' : 'Nouvelle bannière'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Type d'image */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Source de l'image</label>
                                <div className="flex gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="url"
                                            checked={imageType === 'url'}
                                            onChange={() => {
                                                setImageType('url');
                                                setImageFile(null);
                                            }}
                                            className="w-4 h-4 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-sm text-gray-700">Lien URL</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="upload"
                                            checked={imageType === 'upload'}
                                            onChange={() => {
                                                setImageType('upload');
                                                setImageUrl('');
                                            }}
                                            className="w-4 h-4 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-sm text-gray-700">Uploader une image</span>
                                    </label>
                                </div>
                            </div>

                            {/* Upload d'image */}
                            {imageType === 'upload' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Image (upload)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageFileChange}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        required={!editingBanner && imageType === 'upload'}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">L'image sera automatiquement recadrée au format 16:9</p>
                                </div>
                            )}

                            {/* Lien URL */}
                            {imageType === 'url' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">URL de l'image</label>
                                    <input
                                        type="text"
                                        value={imageUrl}
                                        onChange={handleImageUrlChange}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        placeholder="https://exemple.com/image.jpg"
                                        required={!editingBanner && imageType === 'url'}
                                    />
                                </div>
                            )}

                            {/* Aperçu */}
                            {imagePreview && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Aperçu</label>
                                    <img src={imagePreview} alt="Aperçu" className="w-32 h-20 object-cover rounded-lg border border-gray-200" />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    placeholder="Ex: Promotion exceptionnelle"
                                />
                                <p className="text-xs text-gray-400 mt-1">Optionnel</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sous-titre</label>
                                <input
                                    type="text"
                                    value={formData.subtitle}
                                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    placeholder="Ex: Livraison gratuite"
                                />
                                <p className="text-xs text-gray-400 mt-1">Optionnel</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lien de redirection</label>
                                <input
                                    type="text"
                                    value={formData.link}
                                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">Ex: /products, /products/fruits, /cart</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                    className="w-32 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">Plus le nombre est petit, plus la bannière apparaît tôt</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Position d'affichage</label>
                                <select
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                >
                                    <option value="top">Carrousel du haut (Hero)</option>
                                    <option value="bottom">Bannière du bas (Bottom)</option>
                                </select>
                                <p className="text-xs text-gray-400 mt-1">
                                    "Haut" : apparaît dans le carrousel principal en haut de la page d'accueil.<br />
                                    "Bas" : apparaît dans le carrousel du bas.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                    {editingBanner ? 'Mettre à jour' : 'Ajouter la bannière'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-6 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                                >
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Liste des bannières */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {banners.map((banner) => (
                        <div key={banner._id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition">
                            <div className="relative">
                                <img src={banner.image} alt={banner.title || 'Bannière'} className="w-full h-48 object-cover" />
                                <div className={`absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-medium ${
                                    banner.position === 'top' 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-purple-500 text-white'
                                }`}>
                                    {banner.position === 'top' ? 'Carrousel haut' : 'Bannière bas'}
                                </div>
                            </div>
                            <div className="p-5">
                                {banner.title && (
                                    <h3 className="font-semibold text-gray-900 mb-1">{banner.title}</h3>
                                )}
                                {banner.subtitle && (
                                    <p className="text-sm text-gray-500 mb-3">{banner.subtitle}</p>
                                )}
                                <div className="space-y-1 text-xs text-gray-400 mb-4">
                                    <p>Lien : <span className="text-gray-600">{banner.link}</span></p>
                                    <p>Ordre : <span className="text-gray-600">{banner.order}</span></p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(banner)}
                                        className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                    >
                                        Modifier
                                    </button>
                                    <button
                                        onClick={() => handleDelete(banner._id)}
                                        className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {banners.length === 0 && !showForm && (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <path d="M2 8h20"/>
                        </svg>
                        <p className="text-gray-500">Aucune bannière</p>
                        <p className="text-sm text-gray-400 mt-1">Cliquez sur "Ajouter une bannière" pour commencer</p>
                    </div>
                )}
            </div>

            {/* Cropper modal */}
            {showCropper && (
                <ImageCropper
                    imageFile={tempImageFile}
                    onCropComplete={handleCropComplete}
                    onCancel={() => {
                        setShowCropper(false);
                        setTempImageFile(null);
                    }}
                    aspectRatio={16 / 9}
                />
            )}
        </div>
    );
};

export default BannerManager;