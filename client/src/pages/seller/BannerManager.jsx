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
        return <div className="p-10 text-center">Chargement...</div>;
    }

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll">
            <div className="md:p-10 p-4 space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Gestion des bannières</h2>
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
                        className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                    >
                        {showForm ? 'Annuler' : '+ Ajouter une bannière'}
                    </button>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4">
                        <h3 className="text-lg font-semibold">{editingBanner ? 'Modifier' : 'Ajouter'} une bannière</h3>
                        
                        {/* Type d'image */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Type d'image</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        value="url"
                                        checked={imageType === 'url'}
                                        onChange={() => {
                                            setImageType('url');
                                            setImageFile(null);
                                        }}
                                    />
                                    <span>Lien URL</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        value="upload"
                                        checked={imageType === 'upload'}
                                        onChange={() => {
                                            setImageType('upload');
                                            setImageUrl('');
                                        }}
                                    />
                                    <span>Uploader une image</span>
                                </label>
                            </div>
                        </div>

                        {/* Upload d'image */}
                        {imageType === 'upload' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Image (upload)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageFileChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    required={!editingBanner && imageType === 'upload'}
                                />
                                <p className="text-xs text-gray-400 mt-1">L'image sera automatiquement recadrée (format 16/9)</p>
                            </div>
                        )}

                        {/* Lien URL */}
                        {imageType === 'url' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">URL de l'image</label>
                                <input
                                    type="text"
                                    value={imageUrl}
                                    onChange={handleImageUrlChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    placeholder="https://exemple.com/image.jpg"
                                    required={!editingBanner && imageType === 'url'}
                                />
                            </div>
                        )}

                        {/* Aperçu */}
                        {imagePreview && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Aperçu</label>
                                <img src={imagePreview} alt="Aperçu" className="w-32 h-32 object-cover rounded-lg border" />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-1">Titre (optionnel)</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                placeholder="Promotion exceptionnelle"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Sous-titre (optionnel)</label>
                            <input
                                type="text"
                                value={formData.subtitle}
                                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                placeholder="Livraison gratuite"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Lien de redirection</label>
                            <input
                                type="text"
                                value={formData.link}
                                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                placeholder="/products"
                            />
                            <p className="text-xs text-gray-400 mt-1">Ex: /products, /products/fruits, /cart</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Ordre d'affichage</label>
                            <input
                                type="number"
                                value={formData.order}
                                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                className="w-32 border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                            />
                        </div>

                        {/* Champ POSITION */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Position d'affichage</label>
                            <select
                                value={formData.position}
                                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                            >
                                <option value="top">🎠 Carrousel du haut (Hero)</option>
                                <option value="bottom">📢 Bannière du bas (Bottom)</option>
                            </select>
                            <p className="text-xs text-gray-400 mt-1">
                                "Haut" : apparaît dans le carrousel principal en haut de la page d'accueil.<br />
                                "Bas" : apparaît dans le carrousel du bas (avant la newsletter).
                            </p>
                        </div>

                        <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition">
                            {editingBanner ? 'Mettre à jour' : 'Ajouter'}
                        </button>
                    </form>
                )}

                {/* Liste des bannières */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {banners.map((banner) => (
                        <div key={banner._id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <div className="relative">
                                <img src={banner.image} alt={banner.title} className="w-full h-48 object-cover" />
                                <span className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full ${
                                    banner.position === 'top' 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-purple-500 text-white'
                                }`}>
                                    {banner.position === 'top' ? '🎠 Carrousel haut' : '📢 Bannière bas'}
                                </span>
                            </div>
                            <div className="p-4">
                                {banner.title && <h3 className="font-semibold text-lg">{banner.title}</h3>}
                                {banner.subtitle && <p className="text-gray-500 text-sm">{banner.subtitle}</p>}
                                <p className="text-xs text-gray-400 mt-2">Lien : {banner.link}</p>
                                <p className="text-xs text-gray-400">Ordre : {banner.order}</p>
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => handleEdit(banner)}
                                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 transition"
                                    >
                                        Modifier
                                    </button>
                                    <button
                                        onClick={() => handleDelete(banner._id)}
                                        className="text-sm bg-red-50 text-red-500 px-3 py-1.5 rounded hover:bg-red-100 transition"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {banners.length === 0 && !showForm && (
                    <p className="text-gray-500 text-center py-10">Aucune bannière. Cliquez sur "Ajouter une bannière" pour commencer.</p>
                )}
            </div>

            {/* Cropper modal avec ratio large pour bannières */}
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