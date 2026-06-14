import React, { useState, useEffect, useMemo } from 'react';
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
    const [cropShape, setCropShape] = useState('rect');
    
    // 🔍 ÉTATS POUR LA RECHERCHE ET LES FILTRES
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(9);
    const [sortBy, setSortBy] = useState('order');
    const [sortOrder, setSortOrder] = useState('asc');
    
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        image: '',
        bgColor: '#f0f0f0',
        order: 0,
        active: true
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

    // 📊 CATÉGORIES FILTRÉES ET TRIÉES
    const filteredCategories = useMemo(() => {
        let filtered = [...categories];

        if (searchTerm) {
            filtered = filtered.filter(c => 
                c.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter === 'active') {
            filtered = filtered.filter(c => c.active === true);
        } else if (statusFilter === 'inactive') {
            filtered = filtered.filter(c => c.active === false);
        }

        filtered.sort((a, b) => {
            let aVal, bVal;
            switch (sortBy) {
                case 'name':
                    aVal = a.name;
                    bVal = b.name;
                    break;
                case 'order':
                    aVal = a.order || 0;
                    bVal = b.order || 0;
                    break;
                case 'date':
                    aVal = new Date(a.createdAt);
                    bVal = new Date(b.createdAt);
                    break;
                default:
                    aVal = a.order || 0;
                    bVal = b.order || 0;
            }
            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        return filtered;
    }, [categories, searchTerm, statusFilter, sortBy, sortOrder]);

    // 📄 PAGINATION
    const totalCategories = filteredCategories.length;
    const totalPages = Math.ceil(totalCategories / itemsPerPage);
    const paginatedCategories = filteredCategories.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, sortBy, sortOrder]);

    // 📊 STATISTIQUES
    const stats = {
        total: categories.length,
        active: categories.filter(c => c.active === true).length,
        inactive: categories.filter(c => c.active === false).length,
        withImage: categories.filter(c => c.image).length
    };

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
        return name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    };

    const toggleCategoryStatus = async (id, currentStatus) => {
        try {
            const { data } = await axios.post('/api/category/toggle-status', { id });
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name);
        formDataToSend.append('slug', formData.slug);
        formDataToSend.append('bgColor', formData.bgColor);
        formDataToSend.append('order', formData.order);
        if (editingCategory) {
            formDataToSend.append('active', formData.active);
        }
        
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
                setFormData({ name: '', slug: '', image: '', bgColor: '#f0f0f0', order: 0, active: true });
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
            order: category.order || 0,
            active: category.active !== undefined ? category.active : true
        });
        setImagePreview(category.image || '');
        setImageUrl(category.image || '');
        setImageFile(null);
        setImageType('url');
        setShowForm(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-500">Chargement des catégories...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6 space-y-6">
                {/* Header avec statistiques */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Catégories</h1>
                    <p className="text-sm text-gray-500 mt-1">Gérez les catégories de produits</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Actives</p>
                            <p className="text-xl font-bold text-green-600">{stats.active}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Inactives</p>
                            <p className="text-xl font-bold text-red-500">{stats.inactive}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Avec image</p>
                            <p className="text-xl font-bold text-blue-600">{stats.withImage}</p>
                        </div>
                    </div>
                </div>

                {/* Barre de recherche et filtres */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Rechercher une catégorie..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm"
                                />
                            </div>
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="active">Actives</option>
                            <option value="inactive">Inactives</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="order">Trier par ordre</option>
                            <option value="name">Trier par nom</option>
                            <option value="date">Trier par date</option>
                        </select>

                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition flex items-center gap-2"
                        >
                            {sortOrder === 'asc' ? '↑ Croissant' : '↓ Décroissant'}
                        </button>

                        <button
                            onClick={() => {
                                setEditingCategory(null);
                                setFormData({ name: '', slug: '', image: '', bgColor: '#f0f0f0', order: 0, active: true });
                                setImageFile(null);
                                setImageUrl('');
                                setImagePreview('');
                                setImageType('url');
                                setCropShape('rect');
                                setShowForm(!showForm);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition shadow-sm"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="16"/>
                                <line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                            {showForm ? 'Annuler' : 'Ajouter une catégorie'}
                        </button>
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                        {totalCategories} catégorie(s) trouvée(s)
                    </div>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
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

                            {imageType === 'upload' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Format d'image</label>
                                        <div className="flex gap-6">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    value="rect"
                                                    checked={cropShape === 'rect'}
                                                    onChange={() => setCropShape('rect')}
                                                    className="w-4 h-4 text-red-500"
                                                />
                                                <span className="text-sm text-gray-700">Carré</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    value="round"
                                                    checked={cropShape === 'round'}
                                                    onChange={() => setCropShape('round')}
                                                    className="w-4 h-4 text-red-500"
                                                />
                                                <span className="text-sm text-gray-700">Cercle</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Image (upload)</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageFileChange}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            required={!editingCategory && imageType === 'upload'}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                            {cropShape === 'rect' ? 'Recadrage carré (classique)' : 'Recadrage en cercle'}
                                        </p>
                                    </div>
                                </>
                            )}

                            {imageType === 'url' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">URL de l'image</label>
                                    <input
                                        type="text"
                                        value={imageUrl}
                                        onChange={handleImageUrlChange}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        placeholder="https://exemple.com/icone.png"
                                        required={!editingCategory && imageType === 'url'}
                                    />
                                </div>
                            )}

                            {imagePreview && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Aperçu</label>
                                    <img 
                                        src={imagePreview} 
                                        alt="Aperçu" 
                                        className={`w-16 h-16 object-cover border border-gray-200 ${cropShape === 'round' ? 'rounded-full' : 'rounded-lg'}`} 
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la catégorie</label>
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
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (identifiant URL)</label>
                                <input
                                    type="text"
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm bg-gray-50 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    required
                                />
                                <p className="text-xs text-gray-400 mt-1">Ex: fruits, legumes-boissons</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Couleur de fond</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={formData.bgColor}
                                        onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                                        className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={formData.bgColor}
                                        onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                    className="w-32 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">Plus le nombre est petit, plus la catégorie apparaît tôt</p>
                            </div>

                            {editingCategory && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                                    <div className="flex gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                value="true"
                                                checked={formData.active === true}
                                                onChange={() => setFormData({ ...formData, active: true })}
                                                className="w-4 h-4 text-red-500 focus:ring-red-500"
                                            />
                                            <span className="text-sm text-gray-700">Active</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                value="false"
                                                checked={formData.active === false}
                                                onChange={() => setFormData({ ...formData, active: false })}
                                                className="w-4 h-4 text-red-500 focus:ring-red-500"
                                            />
                                            <span className="text-sm text-gray-700">Inactive</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                                    {editingCategory ? 'Mettre à jour' : 'Ajouter la catégorie'}
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

                {/* Liste des catégories */}
                {paginatedCategories.length === 0 && !showForm ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="7" height="7" rx="1"/>
                            <rect x="14" y="3" width="7" height="7" rx="1"/>
                            <rect x="3" y="14" width="7" height="7" rx="1"/>
                            <rect x="14" y="14" width="7" height="7" rx="1"/>
                        </svg>
                        <p className="text-gray-500">Aucune catégorie trouvée</p>
                        <p className="text-sm text-gray-400 mt-1">Cliquez sur "Ajouter une catégorie" pour commencer</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {paginatedCategories.map((category) => (
                                <div key={category._id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition group">
                                    <div className="p-5 flex items-start gap-4">
                                        {category.image && (
                                            <img 
                                                src={category.image} 
                                                alt={category.name} 
                                                className="w-14 h-14 object-cover rounded-full border border-gray-100 group-hover:scale-105 transition"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-semibold text-gray-900">{category.name}</h3>
                                                <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                                    category.active 
                                                        ? 'bg-green-50 text-green-600' 
                                                        : 'bg-red-50 text-red-500'
                                                }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${category.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                    {category.active ? 'Active' : 'Inactive'}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-0.5">slug: {category.slug}</p>
                                            <p className="text-xs text-gray-400">ordre: {category.order}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: category.bgColor }}></div>
                                                <span className="text-xs text-gray-500">{category.bgColor}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-5 pb-5 pt-2 flex gap-2">
                                        <button
                                            onClick={() => handleEdit(category)}
                                            className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                        >
                                            Modifier
                                        </button>
                                        <button
                                            onClick={() => toggleCategoryStatus(category._id, category.active)}
                                            className={`text-xs px-3 py-1.5 rounded-lg transition ${
                                                category.active 
                                                    ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' 
                                                    : 'text-green-600 bg-green-50 hover:bg-green-100'
                                            }`}
                                        >
                                            {category.active ? 'Désactiver' : 'Activer'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(category._id)}
                                            className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                                        >
                                            Supprimer
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-between items-center mt-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">Lignes par page :</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-red-500 outline-none"
                                    >
                                        <option value={9}>9</option>
                                        <option value={15}>15</option>
                                        <option value={30}>30</option>
                                        <option value={60}>60</option>
                                    </select>
                                </div>
                                
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                                    >
                                        «
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                                    >
                                        ‹
                                    </button>
                                    <span className="px-4 py-1.5 text-sm text-gray-600">
                                        Page {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                                    >
                                        ›
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                                    >
                                        »
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
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
                    aspectRatio={1 / 1}
                    cropShape={cropShape}
                />
            )}
        </div>
    );
};

export default CategoryManager;