import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { ArrowLeft, ImagePlus, X, Loader2, Save, Trash2 } from 'lucide-react';

const ProduitForm = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdition = Boolean(id);

    const [loading, setLoading] = useState(isEdition);
    const [submitting, setSubmitting] = useState(false);
    const [categoriesList, setCategoriesList] = useState([]);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [price, setPrice] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [stock, setStock] = useState('');

    const [existingImages, setExistingImages] = useState([]);
    const [newFiles, setNewFiles] = useState([]);
    const [newPreviews, setNewPreviews] = useState([]);

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const { data } = await axios.get('/api/category/list');
                if (data.success) setCategoriesList(data.categories || []);
            } catch (error) { console.error(error); }
        };
        loadCategories();
    }, [axios]);

    useEffect(() => {
        if (!isEdition) return;
        const loadProduct = async () => {
            try {
                const { data } = await axios.post('/api/product/id', { id });
                if (data.success && data.product) {
                    const p = data.product;
                    setName(p.name || '');
                    setDescription(p.description || '');
                    setSelectedCategories(p.categories || []);
                    setPrice(p.price ?? '');
                    setOfferPrice(p.offerPrice ?? '');
                    setStock(p.stock ?? '');
                    setExistingImages(p.image || []);
                } else {
                    toast.error(data.message || 'Produit introuvable');
                    navigate('/commercant/produits');
                }
            } catch (error) {
                toast.error(error.response?.data?.message || error.message);
                navigate('/commercant/produits');
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [id, isEdition, axios, navigate]);

    const toggleCategory = (name) => {
        setSelectedCategories((prev) =>
            prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
        );
    };

    const onPickFiles = (e) => {
        const files = Array.from(e.target.files || []).slice(0, 5 - existingImages.length);
        setNewFiles(files);
        setNewPreviews(files.map((f) => URL.createObjectURL(f)));
    };

    const removeExistingImage = (idx) => {
        setExistingImages((prev) => prev.filter((_, i) => i !== idx));
    };

    const validate = () => {
        if (!name.trim()) { toast.error('Le nom est requis'); return false; }
        if (!description.trim()) { toast.error('La description est requise'); return false; }
        if (!price || Number(price) <= 0) { toast.error('Le prix est requis'); return false; }
        if (!isEdition && newFiles.length === 0) { toast.error('Au moins une photo est requise'); return false; }
        return true;
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSubmitting(true);

        try {
            if (!isEdition) {
                const formData = new FormData();
                formData.append('productData', JSON.stringify({
                    name: name.trim(),
                    description: description.trim(),
                    categories: selectedCategories,
                    price: Number(price),
                    offerPrice: Number(offerPrice) || Number(price),
                    stock: Number(stock) || 0,
                    variants: [],
                }));
                newFiles.forEach((file) => formData.append('images', file));

                const { data } = await axios.post('/api/product/staff/add', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                if (data.success) {
                    toast.success('Produit ajouté');
                    navigate('/commercant/produits');
                } else {
                    toast.error(data.message);
                }
            } else {
                const { data } = await axios.post('/api/product/staff/update', {
                    id,
                    name: name.trim(),
                    description: description.trim(),
                    categories: selectedCategories,
                    price: Number(price),
                    offerPrice: Number(offerPrice) || Number(price),
                    stock: Number(stock) || 0,
                    variants: [],
                    image: existingImages,
                });

                if (!data.success) {
                    toast.error(data.message);
                    setSubmitting(false);
                    return;
                }

                if (newFiles.length > 0) {
                    const imgForm = new FormData();
                    imgForm.append('productId', id);
                    newFiles.forEach((file) => imgForm.append('images', file));
                    await axios.post('/api/product/staff/add-images', imgForm, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                }

                toast.success('Produit mis à jour');
                navigate('/commercant/produits');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-burgundy-600" size={28} /></div>;
    }

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
            <Link to="/commercant/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-burgundy-700 transition mb-4">
                <ArrowLeft size={15} /> Retour aux produits
            </Link>
            <h1 className="font-display text-2xl font-semibold text-gray-900 mb-6">
                {isEdition ? "Modifier l'article" : 'Ajouter un article'}
            </h1>

            <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-blush-200 p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'article</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} required
                        className="w-full px-3.5 py-2.5 border border-blush-300 rounded-xl text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required
                        className="w-full px-3.5 py-2.5 border border-blush-300 rounded-xl text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA)</label>
                        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min="0"
                            className="w-full px-3.5 py-2.5 border border-blush-300 rounded-xl text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prix promo (optionnel)</label>
                        <input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} min="0"
                            className="w-full px-3.5 py-2.5 border border-blush-300 rounded-xl text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock disponible</label>
                    <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} min="0"
                        className="w-full sm:w-40 px-3.5 py-2.5 border border-blush-300 rounded-xl text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500" />
                </div>

                {categoriesList.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Catégories</label>
                        <div className="flex flex-wrap gap-2">
                            {categoriesList.map((cat) => {
                                const active = selectedCategories.includes(cat.name);
                                return (
                                    <button
                                        type="button" key={cat._id}
                                        onClick={() => toggleCategory(cat.name)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                            active
                                                ? 'bg-burgundy-600 border-burgundy-600 text-white'
                                                : 'bg-white border-blush-300 text-gray-600 hover:border-burgundy-400'
                                        }`}
                                    >
                                        {cat.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>

                    {existingImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {existingImages.map((url, idx) => (
                                <div key={url + idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-blush-200">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => removeExistingImage(idx)}
                                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-600 transition">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {newPreviews.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {newPreviews.map((src, idx) => (
                                <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden border border-blush-300">
                                    <img src={src} alt="" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    )}

                    <label className="flex items-center gap-1.5 text-xs font-medium text-burgundy-700 mb-1 cursor-pointer w-fit hover:underline">
                        <ImagePlus size={14} /> {isEdition ? 'Ajouter des photos' : 'Choisir des photos (jusqu\'à 5)'}
                        <input type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
                    </label>
                    {newFiles.length > 0 && <p className="text-xs text-gray-400">{newFiles.length} nouvelle(s) photo(s) sélectionnée(s)</p>}
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-blush-100">
                    <button disabled={submitting}
                        className="flex items-center gap-2 bg-burgundy-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-burgundy-700 transition disabled:opacity-50">
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isEdition ? 'Enregistrer les modifications' : "Publier l'article"}
                    </button>
                    <Link to="/commercant/produits" className="flex items-center gap-2 bg-ivory-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blush-200 transition">
                        <X size={16} /> Annuler
                    </Link>
                </div>
            </form>
        </div>
    );
};

export default ProduitForm;