import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ImageCropper from '../../components/ImageCropper';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import {
    Search, Plus, X, Loader2, Pencil, Trash2, ChevronLeft, ChevronRight,
    Image as ImageIcon, Tag, Eye, EyeOff
} from 'lucide-react';

const Categories = () => {
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
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        bgColor: '#f0f0f0',
        order: 0,
        active: true
    });

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/category/admin-list');
            if (data.success) setCategories(data.categories);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const filteredCategories = useMemo(() => {
        let filtered = [...categories];
        if (searchTerm) {
            filtered = filtered.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        if (statusFilter === 'active') {
            filtered = filtered.filter(c => c.active === true);
        } else if (statusFilter === 'inactive') {
            filtered = filtered.filter(c => c.active === false);
        }
        filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
        return filtered;
    }, [categories, searchTerm, statusFilter]);

    const totalCategories = filteredCategories.length;
    const totalPages = Math.ceil(totalCategories / itemsPerPage);
    const paginatedCategories = filteredCategories.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => setCurrentPage(1), [searchTerm, statusFilter]);

    const stats = {
        total: categories.length,
        active: categories.filter(c => c.active === true).length,
        inactive: categories.filter(c => c.active === false).length,
    };

    const handleImageFileChange = (e) => {
        const file = e.target.files[0];
        if (file) { setTempImageFile(file); setShowCropper(true); }
    };

    const handleCropComplete = (croppedFile) => {
        setImageFile(croppedFile);
        setImagePreview(URL.createObjectURL(croppedFile));
        setShowCropper(false);
        setTempImageFile(null);
    };

    const generateSlug = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name);
        formDataToSend.append('slug', formData.slug);
        formDataToSend.append('bgColor', formData.bgColor);
        formDataToSend.append('order', formData.order);
        if (editingCategory) formDataToSend.append('active', formData.active);

        if (imageType === 'upload' && imageFile) {
            formDataToSend.append('image', imageFile);
        } else if (imageType === 'url' && imageUrl) {
            formDataToSend.append('imageUrl', imageUrl);
        }

        try {
            const endpoint = editingCategory ? '/api/category/update' : '/api/category/add';
            const { data } = await axios.post(endpoint, formDataToSend, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (data.success) {
                toast.success(data.message);
                setShowForm(false);
                resetForm();
                fetchCategories();
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
        setEditingCategory(null);
        setFormData({ name: '', slug: '', bgColor: '#f0f0f0', order: 0, active: true });
        setImageFile(null);
        setImageUrl('');
        setImagePreview('');
        setImageType('url');
        setCropShape('rect');
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

    const toggleStatus = async (id, currentStatus) => {
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

    const handleEdit = (category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            slug: category.slug,
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
                        <h1 className="text-2xl font-bold text-gray-900">Catégories</h1>
                        <p className="text-sm text-gray-500 mt-1">{stats.total} catégorie(s) · {stats.active} actives</p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowForm(!showForm); }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                    >
                        <Plus size={16} />
                        {showForm ? 'Annuler' : 'Ajouter une catégorie'}
                    </button>
                </div>

                {/* Formulaire */}
                {showForm && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-5">
                        <h2 className="font-semibold text-gray-900 mb-4">
                            {editingCategory ? 'Modifier' : 'Nouvelle'} catégorie
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

                            {imageType === 'upload' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Format</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" value="rect" checked={cropShape === 'rect'} onChange={() => setCropShape('rect')} />
                                                <span>Carré</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" value="round" checked={cropShape === 'round'} onChange={() => setCropShape('round')} />
                                                <span>Cercle</span>
                                            </label>
                                        </div>
                                    </div>
                                    <input type="file" accept="image/*" onChange={handleImageFileChange} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" required={!editingCategory} />
                                </>
                            )}

                            {imageType === 'url' && (
                                <input type="text" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} placeholder="https://exemple.com/icone.png" className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" required={!editingCategory} />
                            )}

                            {imagePreview && (
                                <div>
                                    <img src={imagePreview} alt="Aperçu" className={`w-16 h-16 object-cover border border-gray-200 ${cropShape === 'round' ? 'rounded-full' : 'rounded-lg'}`} />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                                    <input type="text" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" required />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Couleur de fond</label>
                                    <div className="flex gap-2">
                                        <input type="color" value={formData.bgColor} onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })} className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                                        <input type="text" value={formData.bgColor} onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })} className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ordre</label>
                                    <input type="number" value={formData.order} onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} className="w-32 border border-gray-200 rounded-xl px-4 py-2 text-sm" />
                                </div>
                            </div>

                            {editingCategory && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Statut</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={formData.active === true} onChange={() => setFormData({ ...formData, active: true })} />
                                            <span>Active</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={formData.active === false} onChange={() => setFormData({ ...formData, active: false })} />
                                            <span>Inactive</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">
                                    {submitting ? <Loader2 size={16} className="animate-spin inline" /> : (editingCategory ? 'Mettre à jour' : 'Ajouter')}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-gray-400 outline-none text-sm" />
                        </div>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white">
                            <option value="all">Tous les statuts</option>
                            <option value="active">Actives</option>
                            <option value="inactive">Inactives</option>
                        </select>
                        <span className="text-xs text-gray-400 flex items-center">{totalCategories} catégorie(s)</span>
                    </div>
                </div>

                {/* Liste */}
                {paginatedCategories.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 mt-5">
                        <Tag size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">Aucune catégorie trouvée</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
                        {paginatedCategories.map((category) => (
                            <div key={category._id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition group">
                                <div className="p-5 flex items-start gap-4">
                                    {category.image ? (
                                        <img src={getPresetImageUrl(category.image, 'categoryIcon')} alt={category.name} className="w-14 h-14 object-cover rounded-full border border-gray-100 group-hover:scale-105 transition" loading="lazy" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400">{category.name?.[0]?.toUpperCase()}</div>
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-gray-900">{category.name}</h3>
                                            <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${category.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${category.active ? 'bg-green-500' : 'bg-red-500'}`} />
                                                {category.active ? 'Active' : 'Inactive'}
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-400">slug: {category.slug}</p>
                                        <p className="text-xs text-gray-400">ordre: {category.order}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: category.bgColor }} />
                                            <span className="text-xs text-gray-500">{category.bgColor}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-5 pb-5 pt-2 flex gap-2">
                                    <button onClick={() => handleEdit(category)} className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Modifier</button>
                                    <button onClick={() => toggleStatus(category._id, category.active)} className={`text-xs px-3 py-1.5 rounded-lg transition ${category.active ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' : 'text-green-600 bg-green-50 hover:bg-green-100'}`}>
                                        {category.active ? 'Désactiver' : 'Activer'}
                                    </button>
                                    <button onClick={() => handleDelete(category._id)} className="text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Supprimer</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-5">
                        <p className="text-sm text-gray-500">Page {currentPage} / {totalPages}</p>
                        <div className="flex gap-1.5">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showCropper && (
                <ImageCropper
                    imageFile={tempImageFile}
                    onCropComplete={handleCropComplete}
                    onCancel={() => { setShowCropper(false); setTempImageFile(null); }}
                    aspectRatio={1 / 1}
                    cropShape={cropShape}
                />
            )}
        </div>
    );
};

export default Categories;