import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ImageCropper from '../../components/ImageCropper';
// [PHASE 1 - PERF] Transformation Cloudinary (f_auto, q_auto, largeur adaptée)
import { getPresetImageUrl } from '../../utils/cloudinaryImage';

const BannerManager = () => {
    const { axios } = useAppContext();
    const [banners, setBanners] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [imageType, setImageType] = useState('url');
    const [imageFile, setImageFile] = useState(null);
    const [imageUrl, setImageUrl] = useState('');
    const [imagePreview, setImagePreview] = useState('');
    const [showCropper, setShowCropper] = useState(false);
    const [tempImageFile, setTempImageFile] = useState(null);
    const [linkType, setLinkType] = useState('custom');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [products, setProducts] = useState([]);
    const [searchProduct, setSearchProduct] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
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

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/category/list');
            if (data.success) {
                setCategories(data.categories);
            }
        } catch (error) {
            console.error('Erreur chargement catégories:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            // admin-list, pas /list : cette dernière est paginée (12 par
            // défaut), on ne pouvait donc mettre en avant que les 12 articles
            // les plus récents.
            const { data } = await axios.get('/api/product/admin-list');
            if (data.success) {
                setProducts(data.products);
            }
        } catch (error) {
            console.error('Erreur chargement produits:', error);
        }
    };

    useEffect(() => {
        fetchBanners();
        fetchCategories();
        fetchProducts();
    }, []);

    useEffect(() => {
        if (searchProduct.trim()) {
            const filtered = products.filter(p => 
                p.name.toLowerCase().includes(searchProduct.toLowerCase())
            );
            setFilteredProducts(filtered.slice(0, 10));
        } else {
            setFilteredProducts([]);
        }
    }, [searchProduct, products]);

    // ✅ handleImageFileChange - capture le fichier
    const handleImageFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log('📸 Fichier sélectionné:', file.name, file.size);
            setTempImageFile(file);
            setShowCropper(true);
        }
    };

    // ✅ handleCropComplete - convertit le Blob en File
    const handleCropComplete = (croppedBlob) => {
        const file = new File(
            [croppedBlob], 
            `banner-${Date.now()}.png`, 
            { type: 'image/png' }
        );
        console.log('✂️ Image recadrée:', file.name, file.size);
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setShowCropper(false);
        setTempImageFile(null);
    };

    const handleImageUrlChange = (e) => {
        const url = e.target.value;
        setImageUrl(url);
        setImagePreview(url);
        setImageFile(null);
    };

    const generateLink = () => {
        if (linkType === 'category' && selectedCategory) {
            const category = categories.find(c => c._id === selectedCategory);
            return `/products/${category?.slug || category?.name?.toLowerCase()}`;
        } else if (linkType === 'product' && selectedProduct) {
            const product = products.find(p => p._id === selectedProduct);
            return `/products/${product?.category?.toLowerCase()}/${product?._id}`;
        }
        return formData.link;
    };

    useEffect(() => {
        if (linkType === 'category' && selectedCategory) {
            const category = categories.find(c => c._id === selectedCategory);
            if (category) {
                const newLink = `/products/${category.slug || category.name?.toLowerCase()}`;
                setFormData(prev => ({ ...prev, link: newLink }));
            }
        }
    }, [selectedCategory, linkType, categories]);

    useEffect(() => {
        if (linkType === 'product' && selectedProduct) {
            const product = products.find(p => p._id === selectedProduct);
            if (product) {
                const newLink = `/products/${product.category?.toLowerCase()}/${product._id}`;
                setFormData(prev => ({ ...prev, link: newLink }));
            }
        }
    }, [selectedProduct, linkType, products]);

    const handleLinkTypeChange = (type) => {
        setLinkType(type);
        if (type === 'custom') {
            // Garder le lien manuel
        } else if (type === 'category') {
            setSelectedCategory('');
            setSelectedProduct('');
            setFormData(prev => ({ ...prev, link: '/products' }));
        } else if (type === 'product') {
            setSelectedProduct('');
            setSelectedCategory('');
            setSearchProduct('');
            setFormData(prev => ({ ...prev, link: '/products' }));
        }
    };

    const handleCategorySelect = (categoryId) => {
        setSelectedCategory(categoryId);
        setSelectedProduct('');
        setLinkType('category');
    };

    const handleProductSelect = (product) => {
        setSelectedProduct(product._id);
        setSelectedCategory('');
        setSearchProduct(product.name);
        setShowProductDropdown(false);
        setLinkType('product');
    };

    // ✅ handleSubmit - corrigé avec console.log pour debug
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const finalLink = generateLink();
        
        const formDataToSend = new FormData();
        formDataToSend.append('title', formData.title || '');
        formDataToSend.append('subtitle', formData.subtitle || '');
        formDataToSend.append('link', finalLink);
        formDataToSend.append('order', formData.order || 0);
        formDataToSend.append('position', formData.position || 'top');
        
        // ✅ Vérifier le type d'image et ajouter au FormData
        if (imageType === 'upload' && imageFile) {
            console.log('📤 Upload image:', imageFile.name, imageFile.size);
            formDataToSend.append('image', imageFile);
        } else if (imageType === 'url' && imageUrl) {
            console.log('📤 URL image:', imageUrl);
            formDataToSend.append('imageUrl', imageUrl);
        } else {
            toast.error('Veuillez choisir une image (upload ou URL)');
            return;
        }

        if (editingBanner) {
            formDataToSend.append('id', editingBanner._id);
        }

        // ✅ Debug : afficher le contenu du FormData
        for (let [key, value] of formDataToSend.entries()) {
            console.log('🔑 FormData:', key, value instanceof File ? `File: ${value.name}` : value);
        }

        try {
            let res;
            const endpoint = editingBanner ? '/api/banner/update' : '/api/banner/add';
            
            res = await axios.post(endpoint, formDataToSend, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            if (res.data.success) {
                toast.success(res.data.message);
                setShowForm(false);
                setEditingBanner(null);
                setImageFile(null);
                setImageUrl('');
                setImagePreview('');
                setLinkType('custom');
                setSelectedCategory('');
                setSelectedProduct('');
                setSearchProduct('');
                setFormData({ title: '', subtitle: '', link: '/products', order: 0, position: 'top' });
                fetchBanners();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            console.error('❌ Erreur:', error.response?.data || error.message);
            toast.error(error.response?.data?.message || error.message);
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
        setLinkType('custom');
        setSelectedCategory('');
        setSelectedProduct('');
        setSearchProduct('');
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
            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
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
                            setLinkType('custom');
                            setSelectedCategory('');
                            setSelectedProduct('');
                            setSearchProduct('');
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

                            {/* Type de redirection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Type de redirection</label>
                                <div className="flex gap-4 mb-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="custom"
                                            checked={linkType === 'custom'}
                                            onChange={() => handleLinkTypeChange('custom')}
                                            className="w-4 h-4 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-sm text-gray-700">Lien personnalisé</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="category"
                                            checked={linkType === 'category'}
                                            onChange={() => handleLinkTypeChange('category')}
                                            className="w-4 h-4 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-sm text-gray-700">Catégorie</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="product"
                                            checked={linkType === 'product'}
                                            onChange={() => handleLinkTypeChange('product')}
                                            className="w-4 h-4 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-sm text-gray-700">Produit</span>
                                    </label>
                                </div>
                            </div>

                            {/* Sélection catégorie */}
                            {linkType === 'category' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sélectionner une catégorie</label>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => handleCategorySelect(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    >
                                        <option value="">-- Choisir une catégorie --</option>
                                        {categories.map((cat) => (
                                            <option key={cat._id} value={cat._id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Redirige vers la page de la catégorie sélectionnée
                                    </p>
                                </div>
                            )}

                            {/* Sélection produit */}
                            {linkType === 'product' && (
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sélectionner un produit</label>
                                    <input
                                        type="text"
                                        value={searchProduct}
                                        onChange={(e) => {
                                            setSearchProduct(e.target.value);
                                            setShowProductDropdown(true);
                                        }}
                                        onFocus={() => setShowProductDropdown(true)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        placeholder="Rechercher un produit..."
                                    />
                                    {showProductDropdown && filteredProducts.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                                            {filteredProducts.map((product) => (
                                                <div
                                                    key={product._id}
                                                    onClick={() => handleProductSelect(product)}
                                                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                                                >
                                                    <p className="font-medium text-gray-800">{product.name}</p>
                                                    <p className="text-xs text-gray-400">{product.category}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">
                                        Redirige vers la page du produit sélectionné
                                    </p>
                                </div>
                            )}

                            {/* Lien personnalisé */}
                            {linkType === 'custom' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lien de redirection</label>
                                    <input
                                        type="text"
                                        value={formData.link}
                                        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        placeholder="Ex: /products, /promotions, /nouveautes"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Lien personnalisé (ex: /products, /promotions, /nouveautes)</p>
                                </div>
                            )}

                            {/* Aperçu du lien généré */}
                            {linkType !== 'custom' && (
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-xs text-gray-500 mb-1">🔗 Lien qui sera utilisé :</p>
                                    <p className="text-sm text-gray-700 font-mono break-all">
                                        {generateLink()}
                                    </p>
                                </div>
                            )}

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
                                <img src={getPresetImageUrl(banner.image, 'card')} alt={banner.title || 'Bannière'} className="w-full h-48 object-cover" loading="lazy" />
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
                                    <p>Lien : <span className="text-gray-600 break-all">{banner.link}</span></p>
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