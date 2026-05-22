import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ImageCropper from '../../components/ImageCropper';

const CategoryManager = () => {
    const { axios } = useAppContext();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [imageType, setImageType] = useState('url');
    const [imageFile, setImageFile] = useState(null);
    const [imageUrl, setImageUrl] = useState('');
    const [imagePreview, setImagePreview] = useState('');
    const [showCropper, setShowCropper] = useState(false);
    const [tempImageFile, setTempImageFile] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        image: '',
        bgColor: '#f0f0f0',
        order: 0
    });

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/category/admin-list');
            if (data.success) {
                setCategories(data.categories);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
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

    const generateSlug = (name) => {
        return name.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, '');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name);
        formDataToSend.append('slug', formData.slug);
        formDataToSend.append('bgColor', formData.bgColor);
        formDataToSend.append('order', formData.order);
        
        if (imageType === 'upload' && imageFile) {
            formDataToSend.append('image', imageFile);
        } else if (imageType === 'url' && imageUrl) {
            formDataToSend.append('imageUrl', imageUrl);
        }

        try {
            let res;
            if (editingCategory) {
                formDataToSend.append('id', editingCategory._id);
                res = await axios.post('/api/category/update', formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                res = await axios.post('/api/category/add', formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            
            if (res.data.success) {
                toast.success(res.data.message);
                setShowForm(false);
                setEditingCategory(null);
                setImageFile(null);
                setImageUrl('');
                setImagePreview('');
                setFormData({ name: '', slug: '', image: '', bgColor: '#f0f0f0', order: 0 });
                fetchCategories();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer cette catégorie ?')) return;
        try {
            const { data } = await axios.post('/api/category/delete', { id });
            if (data.success) {
                toast.success(data.message);
                fetchCategories();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleEdit = (category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            slug: category.slug,
            image: category.image || '',
            bgColor: category.bgColor || '#f0f0f0',
            order: category.order || 0
        });
        setImagePreview(category.image || '');
        setImageUrl(category.image || '');
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
                    <h2 className="text-2xl font-bold">Gestion des catégories</h2>
                    <button
                        onClick={() => {
                            setEditingCategory(null);
                            setFormData({ name: '', slug: '', image: '', bgColor: '#f0f0f0', order: 0 });
                            setImageFile(null);
                            setImageUrl('');
                            setImagePreview('');
                            setImageType('url');
                            setShowForm(!showForm);
                        }}
                        className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
                    >
                        {showForm ? 'Annuler' : '+ Ajouter une catégorie'}
                    </button>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4">
                        <h3 className="text-lg font-semibold">{editingCategory ? 'Modifier' : 'Ajouter'} une catégorie</h3>
                        
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

                        {/* Upload d'image avec cropper */}
                        {imageType === 'upload' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Image (upload)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageFileChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                    required={!editingCategory && imageType === 'upload'}
                                />
                                <p className="text-xs text-gray-400 mt-1">L'image sera automatiquement recadrée (format carré)</p>
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
                                    placeholder="https://exemple.com/icone.png"
                                    required={!editingCategory && imageType === 'url'}
                                />
                            </div>
                        )}

                        {/* Aperçu */}
                        {imagePreview && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Aperçu</label>
                                <img src={imagePreview} alt="Aperçu" className="w-16 h-16 object-cover rounded-lg border" />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-1">Nom de la catégorie</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => {
                                    const name = e.target.value;
                                    setFormData({ 
                                        ...formData, 
                                        name,
                                        slug: generateSlug(name)
                                    });
                                }}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Slug (identifiant URL)</label>
                            <input
                                type="text"
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary bg-gray-50"
                                required
                            />
                            <p className="text-xs text-gray-400 mt-1">Ex: fruits, legumes-boissons</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Couleur de fond</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={formData.bgColor}
                                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                                    className="w-12 h-10 rounded border cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={formData.bgColor}
                                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary"
                                />
                            </div>
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

                        <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition">
                            {editingCategory ? 'Mettre à jour' : 'Ajouter'}
                        </button>
                    </form>
                )}

                {/* Liste des catégories */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((category) => (
                        <div key={category._id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 flex items-center gap-4">
                                {category.image && (
                                    <img src={category.image} alt={category.name} className="w-16 h-16 object-cover rounded-lg" />
                                )}
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg">{category.name}</h3>
                                    <p className="text-xs text-gray-400">slug: {category.slug}</p>
                                    <p className="text-xs text-gray-400">ordre: {category.order}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: category.bgColor }}></div>
                                        <span className="text-xs text-gray-500">{category.bgColor}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t flex gap-2">
                                <button
                                    onClick={() => handleEdit(category)}
                                    className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 transition"
                                >
                                    Modifier
                                </button>
                                <button
                                    onClick={() => handleDelete(category._id)}
                                    className="text-sm bg-red-50 text-red-500 px-3 py-1.5 rounded hover:bg-red-100 transition"
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {categories.length === 0 && !showForm && (
                    <p className="text-gray-500 text-center py-10">Aucune catégorie. Cliquez sur "Ajouter une catégorie" pour commencer.</p>
                )}
            </div>

            {/* Cropper modal avec ratio carré pour catégories */}
            {showCropper && (
                <ImageCropper
                    imageFile={tempImageFile}
                    onCropComplete={handleCropComplete}
                    onCancel={() => {
                        setShowCropper(false);
                        setTempImageFile(null);
                    }}
                    aspectRatio={1 / 1}
                />
            )}
        </div>
    );
};

export default CategoryManager;