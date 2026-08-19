import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ImageCropper from '../../components/ImageCropper';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { resizeAndConvertToWebP } from '../../utils/resizeImage';
import {
    ArrowLeft, ImagePlus, X, Loader2, Save, Trash2,
    Video, FileText, Tag, Layers, Plus, Pencil,
    ChevronDown, Box, Ruler, Palette, Info, AlertCircle, Lock
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Composants réutilisés
// ---------------------------------------------------------------------------

const Section = ({ icon: Icon, title, subtitle, children }) => (
    <section className="bg-white border border-ink-200 rounded-2xl p-5 md:p-6">
        <div className="flex items-start gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-ink-100 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-ink-700" />
            </div>
            <div>
                <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
                {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
            </div>
        </div>
        {children}
    </section>
);

const Hint = ({ children }) => (
    <p className="flex items-start gap-1.5 text-xs text-ink-400 mt-2">
        <Info size={13} className="mt-[1px] shrink-0" />
        <span>{children}</span>
    </p>
);

const Field = ({ label, required, children, hint }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-800">
            {label} {required && <span className="text-ink-400">*</span>}
        </label>
        {children}
        {hint && <Hint>{hint}</Hint>}
    </div>
);

const inputClass =
    "outline-none py-2.5 px-3 rounded-lg border border-ink-200 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-400 transition w-full";

const quillModules = {
    toolbar: [
        [{ header: [false, 2, 3] }],
        ['bold', 'italic', 'underline'],
        [{ color: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image'],
        ['clean'],
    ],
};
const quillFormats = ['header', 'bold', 'italic', 'underline', 'color', 'list', 'link', 'image'];

const SegmentedControl = ({ options, value, onChange, columns = options.length }) => (
    <div
        className="grid gap-1.5 p-1 bg-ink-100 rounded-xl"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
        {options.map((opt) => {
            const active = value === opt.value;
            const OptIcon = opt.icon;
            return (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition ${
                        active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
                    }`}
                >
                    {OptIcon && <OptIcon size={15} />}
                    {opt.label}
                </button>
            );
        })}
    </div>
);

const IconButton = ({ onClick, variant = 'default', children, className = '' }) => {
    const variants = {
        default: 'text-ink-400 hover:text-ink-700 hover:bg-ink-100',
        danger: 'text-ink-400 hover:text-ramses-600 hover:bg-ramses-50',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${variants[variant]} ${className}`}
        >
            {children}
        </button>
    );
};

// ---------------------------------------------------------------------------

const ProduitForm = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();
    const { id } = useParams();
    const { boutique } = useOutletContext();
    const isEdition = Boolean(id);
    // Article saisi par la plateforme et confié à cette boutique : le prix et
    // les médias sont fixés en amont. Le serveur les ignore de toute façon —
    // les afficher modifiables ferait saisir des valeurs qui disparaîtraient
    // sans explication.
    const [verrouilleParPlateforme, setVerrouilleParPlateforme] = useState(false);

    // Chargement
    const [loading, setLoading] = useState(isEdition);
    const [submitting, setSubmitting] = useState(false);

    // Données du produit
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [price, setPrice] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [categoriesList, setCategoriesList] = useState([]);

    // Mode produit
    const [productMode, setProductMode] = useState('simple');
    const [labelType, setLabelType] = useState('size');

    // Mode simple
    const [simpleStock, setSimpleStock] = useState('');
    const [simpleSize, setSimpleSize] = useState('');

    // Mode multi-sizes
    const [sizesList, setSizesList] = useState([]);
    const [sizeInput, setSizeInput] = useState('');
    const [stockInput, setStockInput] = useState('');
    const [sizePriceInput, setSizePriceInput] = useState('');
    const [sizeOfferPriceInput, setSizeOfferPriceInput] = useState('');
    const [editingSizeIndex, setEditingSizeIndex] = useState(null);
    const [openSizesPanel, setOpenSizesPanel] = useState(true);

    // Mode variants (couleurs + tailles)
    const [variantColors, setVariantColors] = useState([]);
    const [variantSizes, setVariantSizes] = useState([]);
    const [variantCells, setVariantCells] = useState({});
    const [colorTagInput, setColorTagInput] = useState('');
    const [colorCodeTagInput, setColorCodeTagInput] = useState('#000000');
    const [sizeTagInput, setSizeTagInput] = useState('');
    const [collapsedColorGroups, setCollapsedColorGroups] = useState({});

    // Images et vidéo
    const [files, setFiles] = useState([]);
    const [existingImages, setExistingImages] = useState([]);
    const [newPreviews, setNewPreviews] = useState([]);
    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState('');
    const [showCropper, setShowCropper] = useState(false);
    const [tempImageFile, setTempImageFile] = useState(null);
    const [previewIndex, setPreviewIndex] = useState(null);
    const [isConverting, setIsConverting] = useState(false);

    // Helpers
    const cellKey = (colorName, size) => `${colorName}__${size ?? ''}`;

    // Chargement des catégories
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const { data } = await axios.get('/api/category/list');
                if (data.success) setCategoriesList(data.categories || []);
            } catch (error) { console.error(error); }
        };
        loadCategories();
    }, [axios]);

    // Chargement du produit en édition
    useEffect(() => {
        if (!isEdition) return;
        const loadProduct = async () => {
            try {
                console.log('🔍 Chargement du produit:', id);
                // ✅ CORRECTION : GET au lieu de POST
                const { data } = await axios.get(`/api/product/id?id=${id}`);
                console.log('🔍 Réponse:', data);
                if (data.success && data.product) {
                    const p = data.product;
                    console.log('✅ Produit chargé:', p);
                    setVerrouilleParPlateforme(p.origine === 'plateforme' && Boolean(p.boutiqueId));
                    setName(p.name || '');
                    setDescription(p.description || '');
                    setSelectedCategories(p.categories || []);
                    setPrice(p.price ?? '');
                    setOfferPrice(p.offerPrice ?? '');
                    setExistingImages(p.image || []);
                    setLabelType(p.labelType || 'size');
                    setProductMode('simple');

                    const hasVariants = p.variants && p.variants.length > 0;
                    if (hasVariants) {
                        const hasColors = p.variants.some(v => v.color);
                        const hasSizes = p.variants.some(v => v.size);
                        if (hasColors && hasSizes) {
                            setProductMode('variants');
                            const colors = [...new Set(p.variants.map(v => v.color).filter(Boolean))];
                            const sizes = [...new Set(p.variants.map(v => v.size).filter(Boolean))];
                            const cells = {};
                            p.variants.forEach(v => {
                                const key = cellKey(v.color, v.size);
                                cells[key] = {
                                    stock: v.stock || 0,
                                    price: v.price || '',
                                    offerPrice: v.offerPrice || '',
                                };
                            });
                            setVariantColors(colors.map(c => ({ name: c, colorCode: '#000000', startImageIndex: 0 })));
                            setVariantSizes(sizes);
                            setVariantCells(cells);
                        } else if (hasSizes) {
                            setProductMode('multi-sizes');
                            setSizesList(p.variants.map(v => ({
                                size: v.size,
                                stock: v.stock || 0,
                                price: v.price || null,
                                offerPrice: v.offerPrice || null,
                            })));
                        }
                    } else {
                        setProductMode('simple');
                        setSimpleStock(p.stock ?? '');
                        setSimpleSize(p.size || '');
                    }

                    if (p.video) {
                        setVideoPreview(p.video);
                        setVideoFile(p.video);
                    }
                } else {
                    toast.error(data.message || 'Produit introuvable');
                    navigate('/commercant/produits');
                }
            } catch (error) {
                console.error('❌ Erreur chargement produit:', error);
                toast.error(error.response?.data?.message || error.message);
                navigate('/commercant/produits');
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [id, isEdition, axios, navigate]);

    // Helpers pour les modes
    const resetSizeForm = () => {
        setSizeInput('');
        setStockInput('');
        setSizePriceInput('');
        setSizeOfferPriceInput('');
        setEditingSizeIndex(null);
    };

    const addSize = () => {
        if (!sizeInput.trim()) {
            toast.error('Entrez une taille');
            return;
        }
        if (!stockInput || Number(stockInput) < 0) {
            toast.error('Entrez un stock valide');
            return;
        }

        const newSize = {
            size: sizeInput.trim().toUpperCase(),
            stock: Number(stockInput),
            price: sizePriceInput !== '' ? Number(sizePriceInput) : null,
            offerPrice: sizeOfferPriceInput !== '' ? Number(sizeOfferPriceInput) : null
        };

        if (editingSizeIndex !== null) {
            const updatedSizes = [...sizesList];
            updatedSizes[editingSizeIndex] = newSize;
            setSizesList(updatedSizes);
        } else {
            setSizesList([...sizesList, newSize]);
        }
        resetSizeForm();
    };

    const editSize = (index) => {
        const size = sizesList[index];
        setSizeInput(size.size);
        setStockInput(size.stock.toString());
        setSizePriceInput(size.price !== null ? size.price.toString() : '');
        setSizeOfferPriceInput(size.offerPrice !== null ? size.offerPrice.toString() : '');
        setEditingSizeIndex(index);
    };

    const removeSize = (index) => {
        setSizesList(sizesList.filter((_, i) => i !== index));
        if (editingSizeIndex === index) resetSizeForm();
    };

    // Helpers pour les variants
    const addColorTag = () => {
        const trimmed = colorTagInput.trim();
        if (!trimmed) return;
        if (variantColors.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
            toast.error('Cette couleur existe déjà');
            return;
        }
        setVariantColors(prev => [...prev, { name: trimmed, colorCode: colorCodeTagInput, startImageIndex: 0 }]);
        setColorTagInput('');
    };

    const removeColorTag = (name) => {
        setVariantColors(prev => prev.filter(c => c.name !== name));
        setVariantCells(prev => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => { if (k.startsWith(`${name}__`)) delete next[k]; });
            return next;
        });
    };

    const updateColorMeta = (name, field, value) => {
        setVariantColors(prev => prev.map(c => (c.name === name ? { ...c, [field]: value } : c)));
    };

    const addSizeTag = () => {
        const trimmed = sizeTagInput.trim().toUpperCase();
        if (!trimmed) return;
        if (variantSizes.includes(trimmed)) {
            toast.error('Cette taille existe déjà');
            return;
        }
        setVariantSizes(prev => [...prev, trimmed]);
        setSizeTagInput('');
    };

    const removeSizeTag = (size) => {
        setVariantSizes(prev => prev.filter(s => s !== size));
        setVariantCells(prev => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => { if (k.endsWith(`__${size}`)) delete next[k]; });
            return next;
        });
    };

    const toggleColorGroup = (name) => {
        setCollapsedColorGroups(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const colorGroupStockTotal = (colorName) => {
        const sizes = variantSizes.length > 0 ? variantSizes : [null];
        return sizes.reduce((sum, sz) => sum + (Number(variantCells[cellKey(colorName, sz)]?.stock) || 0), 0);
    };

    const updateCell = (colorName, size, field, value) => {
        const key = cellKey(colorName, size);
        setVariantCells(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    };

    const buildVariantsPayload = () => {
        const variants = [];
        const sizes = variantSizes.length > 0 ? variantSizes : [null];
        variantColors.forEach(col => {
            sizes.forEach(sz => {
                const cell = variantCells[cellKey(col.name, sz)] || {};
                variants.push({
                    color: col.name,
                    colorCode: col.colorCode || null,
                    size: sz,
                    stock: Number(cell.stock) || 0,
                    price: cell.price !== undefined && cell.price !== '' ? Number(cell.price) : null,
                    offerPrice: cell.offerPrice !== undefined && cell.offerPrice !== '' ? Number(cell.offerPrice) : null,
                    startImageIndex: Number(col.startImageIndex) || 0,
                });
            });
        });
        return variants;
    };

    // Gestion des images
    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setTempImageFile(file);
            setShowCropper(true);
        }
    };

    const handleCropComplete = async (croppedFile) => {
        setIsConverting(true);
        try {
            const webpFile = await resizeAndConvertToWebP(croppedFile);
            setFiles(prev => [...prev, webpFile]);
            setNewPreviews(prev => [...prev, URL.createObjectURL(webpFile)]);
            toast.success('Image optimisée');
        } catch (error) {
            console.error("Erreur conversion WebP:", error);
            toast.error("Erreur lors de l'optimisation de l'image");
        } finally {
            setIsConverting(false);
            setShowCropper(false);
            setTempImageFile(null);
        }
    };

    const removeImage = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setNewPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingImage = (idx) => {
        setExistingImages(prev => prev.filter((_, i) => i !== idx));
    };

    // Gestion de la vidéo
    const handleVideoSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('video/')) {
                toast.error('Veuillez sélectionner une vidéo');
                return;
            }
            if (file.size > 100 * 1024 * 1024) {
                toast.error('La vidéo ne doit pas dépasser 100MB');
                return;
            }
            setVideoFile(file);
            setVideoPreview(URL.createObjectURL(file));
            toast.success('Vidéo sélectionnée');
        }
    };

    const removeVideo = () => {
        setVideoFile(null);
        setVideoPreview('');
    };

    // Catégories
    const toggleCategory = (name) => {
        setSelectedCategories(prev =>
            prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
        );
    };

    // Validation
    const validate = () => {
        if (!name.trim()) { toast.error('Le nom est requis'); return false; }
        if (!description.trim()) { toast.error('La description est requise'); return false; }
        if (!price || Number(price) <= 0) { toast.error('Le prix est requis'); return false; }
        if (!isEdition && files.length === 0 && existingImages.length === 0) {
            toast.error('Au moins une photo est requise');
            return false;
        }

        if (productMode === 'simple') {
            // OK
        } else if (productMode === 'multi-sizes') {
            if (sizesList.length === 0) {
                toast.error('Ajoutez au moins une taille');
                return false;
            }
        } else if (productMode === 'variants') {
            if (variantColors.length === 0) {
                toast.error('Ajoutez au moins une couleur');
                return false;
            }
            let hasStock = false;
            const sizes = variantSizes.length > 0 ? variantSizes : [null];
            variantColors.forEach(col => {
                sizes.forEach(sz => {
                    if (Number(variantCells[cellKey(col.name, sz)]?.stock) > 0) hasStock = true;
                });
            });
            if (!hasStock) {
                toast.error('Ajoutez au moins un stock pour une variante');
                return false;
            }
        }
        return true;
    };

    // Soumission
    const onSubmit = async (e) => {
        e.preventDefault();
        console.log('🚀 === DÉBUT SOUMISSION MODIFICATION ===');
        console.log('📝 ID du produit:', id);
        console.log('📝 Nom:', name);
        console.log('📝 Catégories:', selectedCategories);
        console.log('📝 Prix:', price);
        console.log('📝 Prix promo:', offerPrice);
        console.log('📝 Mode produit:', productMode);
        console.log('📝 Images existantes:', existingImages.length);
        console.log('📝 Nouvelles images:', files.length);
        console.log('📝 Vidéo:', videoFile ? 'Oui' : 'Non');

        if (!validate()) return;
        setSubmitting(true);

        const productData = {
            name: name.trim(),
            description: description.trim(),
            categories: selectedCategories,
            price: Number(price),
            offerPrice: Number(offerPrice) || Number(price),
            labelType: labelType,
        };

        if (productMode === 'simple') {
            productData.variants = [];
            productData.stock = Number(simpleStock) || 0;
            productData.size = simpleSize || null;
        } else if (productMode === 'multi-sizes') {
            productData.variants = sizesList.map(s => ({
                color: null,
                colorCode: '#000000',
                size: s.size,
                price: s.price || 0,
                offerPrice: s.offerPrice || 0,
                stock: s.stock || 0,
                startImageIndex: 0
            }));
            productData.stock = 0;
            productData.size = null;
        } else if (productMode === 'variants') {
            productData.variants = buildVariantsPayload();
            productData.stock = 0;
            productData.size = null;
        }

        console.log('📦 ProductData envoyé:', JSON.stringify(productData, null, 2));

        try {
            if (!isEdition) {
                const formData = new FormData();
                formData.append('productData', JSON.stringify(productData));
                files.forEach((file) => formData.append('images', file));
                if (videoFile) formData.append('video', videoFile);

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
                console.log('📤 Envoi de la mise à jour...');
                const { data } = await axios.post('/api/product/staff/update', {
                    id,
                    ...productData,
                    image: existingImages,
                });

                console.log('📥 Réponse update:', data);

                if (!data.success) {
                    toast.error(data.message);
                    setSubmitting(false);
                    return;
                }

                if (files.length > 0) {
                    console.log('📸 Upload de nouvelles images...');
                    const imgForm = new FormData();
                    imgForm.append('productId', id);
                    files.forEach((file) => imgForm.append('images', file));
                    await axios.post('/api/product/staff/add-images', imgForm, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                }

                if (videoFile && typeof videoFile !== 'string') {
                    console.log('🎬 Upload de la vidéo...');
                    const videoForm = new FormData();
                    videoForm.append('id', id);
                    videoForm.append('video', videoFile);
                    await axios.post('/api/product/staff/update', videoForm, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                }

                toast.success('Produit mis à jour avec succès');
                navigate('/commercant/produits');
            }
        } catch (error) {
            console.error('❌ ERREUR SOUMISSION:', error);
            console.error('❌ Response:', error.response);
            console.error('❌ Response data:', error.response?.data);
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSubmitting(false);
        }
        console.log('🚀 === FIN SOUMISSION MODIFICATION ===');
    };

    if (loading) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-ramses-600" size={28} /></div>;
    }

    // Création d'article non ouverte par l'admin : on ne montre pas un
    // formulaire de 900 lignes que le serveur refusera à la soumission.
    // La modification d'un article existant, elle, reste permise.
    if (!isEdition && boutique && !boutique.peutCreerProduits) {
        return (
            <div className="max-w-lg mx-auto px-4 py-20 text-center">
                <div className="w-14 h-14 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4">
                    <Lock size={24} className="text-ink-400" />
                </div>
                <h1 className="font-display text-xl font-semibold text-ink-900">Indisponible pour l'instant</h1>
                <p className="text-sm text-ink-500 mt-2">
                    L'ajout d'articles n'a pas été activé pour votre boutique. L'administrateur peut
                    vous ouvrir ce droit à tout moment.
                </p>
                <p className="text-sm text-ink-500 mt-2">
                    En attendant, vous gérez les quantités, les descriptions et les caractéristiques
                    de vos articles existants.
                </p>
                <Link to="/commercant/produits" className="mt-6 inline-flex items-center gap-2 bg-ramses-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition">
                    Revenir à mes produits
                </Link>
            </div>
        );
    }

    return (
        <div className="no-scrollbar flex-1 min-h-screen bg-ink-50">
            <form id="add-product-form" onSubmit={onSubmit} className="max-w-3xl mx-auto p-4 md:p-8 pb-28 space-y-4">
                <div className="mb-2">
                    <h1 className="font-display text-xl font-semibold text-ink-900">
                        {isEdition ? "Modifier l'article" : 'Ajouter un article'}
                    </h1>
                    <p className="text-sm text-ink-400 mt-0.5">
                        {isEdition ? 'Modifiez les informations de votre article' : 'Renseignez les informations ci-dessous pour publier un article.'}
                    </p>
                </div>

                {/* Informations générales */}
                <Section icon={FileText} title="Informations générales">
                    <div className="space-y-4">
                        <Field label="Nom de l'article" required>
                            <input value={name} onChange={(e) => setName(e.target.value)} required
                                className={inputClass} />
                        </Field>

                        <Field label="Description">
                            <div className="pd-quill">
                                <ReactQuill
                                    value={description}
                                    onChange={setDescription}
                                    theme="snow"
                                    placeholder="Décrivez votre produit…"
                                    modules={quillModules}
                                    formats={quillFormats}
                                    style={{ minHeight: '150px' }}
                                />
                            </div>
                            <style>{`
                                .pd-quill .ql-toolbar.ql-snow {
                                    border: 1px solid #e5e7eb;
                                    border-bottom: none;
                                    border-radius: 10px 10px 0 0;
                                    background: #fafafa;
                                    padding: 8px 10px;
                                }
                                .pd-quill .ql-container.ql-snow {
                                    border: 1px solid #e5e7eb;
                                    border-radius: 0 0 10px 10px;
                                    font-family: inherit;
                                    font-size: 13.5px;
                                }
                                .pd-quill .ql-editor { min-height: 150px; color: #111827; line-height: 1.6; }
                                .pd-quill .ql-editor.ql-blank::before { color: #9ca3af; font-style: normal; }
                                .pd-quill .ql-snow .ql-stroke { stroke: #6b7280; }
                                .pd-quill .ql-snow .ql-fill { fill: #6b7280; }
                            `}</style>
                        </Field>

                        <Field label="Catégories" required>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2.5 border border-ink-200 rounded-lg">
                                {categoriesList.map((item) => (
                                    <button
                                        key={item._id}
                                        type="button"
                                        onClick={() => toggleCategory(item.name)}
                                        className={`px-3 py-1.5 rounded-full text-sm transition ${
                                            selectedCategories.includes(item.name)
                                                ? 'bg-ink-900 text-white'
                                                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                                        }`}
                                    >
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        </Field>
                    </div>
                </Section>

                {/* Médias */}
                <Section icon={ImagePlus} title="Médias" subtitle={verrouilleParPlateforme ? 'Fournis par la plateforme' : 'Photos et vidéo de présentation'}>
                    <div className="space-y-5">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-ink-800">Photos, dans l'ordre d'affichage</span>
                                <span className="text-[11px] text-ink-400">Carré 1:1</span>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                                {existingImages.map((url, index) => (
                                    <div key={`existing-${index}`} className="relative group aspect-square">
                                        <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-ink-200" />
                                        {index === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-ink-900/80 text-white px-1.5 py-0.5 rounded">Couverture</span>}
                                        {!verrouilleParPlateforme && (
                                        <button type="button" onClick={() => removeExistingImage(index)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-ink-200 shadow-sm flex items-center justify-center text-ink-500 hover:text-ramses-600 transition opacity-0 group-hover:opacity-100">
                                            <X size={12} />
                                        </button>
                                        )}
                                    </div>
                                ))}
                                {newPreviews.map((src, index) => (
                                    <div key={`new-${index}`} className="relative group aspect-square">
                                        <img src={src} alt="" className="w-full h-full object-cover rounded-xl border border-ink-200" />
                                        <button type="button" onClick={() => removeImage(index)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-ink-200 shadow-sm flex items-center justify-center text-ink-500 hover:text-ramses-600 transition opacity-0 group-hover:opacity-100">
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                {!verrouilleParPlateforme && (existingImages.length + newPreviews.length) < 5 && (
                                    <label className="aspect-square border-2 border-dashed border-ink-200 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-ink-400 hover:bg-ink-50 transition">
                                        <input onChange={handleImageSelect} type="file" accept="image/*" className="hidden" />
                                        <Plus size={18} className="text-ink-400" />
                                        <span className="text-[11px] text-ink-400">Ajouter</span>
                                    </label>
                                )}
                            </div>
                            {isConverting && <p className="text-xs text-ink-600">🔄 Optimisation en cours...</p>}
                        </div>

                        {verrouilleParPlateforme ? (
                            <Hint>
                                Les photos et la vidéo de cet article sont fournies par la plateforme et
                                ne peuvent pas être remplacées ici.
                            </Hint>
                        ) : (
                        <div>
                            <span className="text-sm font-medium text-ink-800">Vidéo (optionnel)</span>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                <label className="flex items-center gap-2 px-3.5 py-2.5 border-2 border-dashed border-ink-200 rounded-xl cursor-pointer hover:border-ink-400 hover:bg-ink-50 transition">
                                    <input onChange={handleVideoSelect} type="file" accept="video/*" className="hidden" />
                                    <Video size={16} className="text-ink-400" />
                                    <span className="text-sm text-ink-500">Choisir une vidéo</span>
                                </label>
                                {videoPreview && (
                                    <div className="relative">
                                        <video src={videoPreview} className="w-16 h-16 object-cover rounded-xl border border-ink-200" controls muted />
                                        <button type="button" onClick={removeVideo}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-ink-200 shadow-sm flex items-center justify-center text-ink-500 hover:text-ramses-600 transition">
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <Hint>Format MP4, WebM ou MOV, 100 Mo maximum.</Hint>
                        </div>
                        )}
                    </div>
                </Section>

                {/* Tarification */}
                <Section icon={Tag} title="Tarification" subtitle={verrouilleParPlateforme ? 'Fixée par la plateforme' : 'Prix appliqués par défaut à tout le produit'}>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Prix" required={!verrouilleParPlateforme}>
                            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                                required={!verrouilleParPlateforme} min="0" disabled={verrouilleParPlateforme}
                                className={`${inputClass} disabled:bg-ink-100 disabled:text-ink-500 disabled:cursor-not-allowed`}
                                placeholder="0" />
                        </Field>
                        <Field label="Prix promo" hint={verrouilleParPlateforme ? '' : 'Vide = pas de promo'}>
                            <input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} min="0"
                                disabled={verrouilleParPlateforme}
                                className={`${inputClass} disabled:bg-ink-100 disabled:text-ink-500 disabled:cursor-not-allowed`}
                                placeholder="Optionnel" />
                        </Field>
                    </div>
                    <Hint>
                        {verrouilleParPlateforme
                            ? "Cet article a été créé par la plateforme : son prix est fixé en amont. Vous en gérez les quantités et les caractéristiques."
                            : 'Une variante peut avoir son propre prix ; à défaut, elle utilise ceux-ci.'}
                    </Hint>
                </Section>

                {/* Stock & variantes */}
                <Section icon={Layers} title="Stock & variantes">
                    <SegmentedControl
                        value={productMode}
                        onChange={setProductMode}
                        options={[
                            { value: 'simple', label: 'Simple', icon: Box },
                            { value: 'multi-sizes', label: 'Tailles', icon: Ruler },
                            { value: 'variants', label: 'Couleurs + tailles', icon: Palette },
                        ]}
                    />

                    {/* Mode SIMPLE */}
                    {productMode === 'simple' && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <Field label="Stock (optionnel)">
                                <input type="number" value={simpleStock} onChange={(e) => setSimpleStock(e.target.value)} min="0"
                                    className={inputClass} placeholder="Quantité" />
                            </Field>
                            <Field label="Taille (optionnel)">
                                <input type="text" value={simpleSize} onChange={(e) => setSimpleSize(e.target.value)}
                                    className={inputClass} placeholder="S, M, L..." />
                            </Field>
                        </div>
                    )}

                    {/* Mode MULTI-TAILLES */}
                    {productMode === 'multi-sizes' && (
                        <div className="flex flex-col gap-4 mt-4">
                            <div className="border border-ink-200 rounded-xl p-3.5 bg-ink-50">
                                <p className="text-sm font-medium text-ink-800 mb-1">Type de libellé</p>
                                <SegmentedControl
                                    value={labelType}
                                    onChange={setLabelType}
                                    options={[
                                        { value: 'size', label: 'Taille', icon: Ruler },
                                        { value: 'variant', label: 'Variante', icon: Box },
                                    ]}
                                />
                            </div>

                            <div className="border border-ink-200 rounded-xl overflow-hidden">
                                <button type="button" onClick={() => setOpenSizesPanel(!openSizesPanel)}
                                    className="w-full flex items-center justify-between px-3.5 py-3 bg-ink-50 hover:bg-ink-100 transition">
                                    <span className="font-medium text-sm text-ink-900">
                                        {labelType === 'size' ? 'Tailles' : 'Variantes'} disponibles ({sizesList.length})
                                    </span>
                                    <ChevronDown size={16} className={`text-ink-400 transition-transform ${openSizesPanel ? 'rotate-180' : ''}`} />
                                </button>
                                {openSizesPanel && (
                                    <div className="px-3.5 py-3.5 border-t border-ink-200 space-y-3">
                                        {sizesList.map((size, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2.5 bg-ink-50 rounded-lg">
                                                <div className="text-sm">
                                                    <span className="font-medium text-ink-800">{size.size}</span>
                                                    <span className="text-xs text-ink-500 ml-2">Stock: {size.stock}</span>
                                                    {size.price && <span className="text-xs text-ink-400 ml-2">{size.price} FCFA</span>}
                                                </div>
                                                <div className="flex gap-0.5">
                                                    <IconButton onClick={() => editSize(idx)}><Pencil size={13} /></IconButton>
                                                    <IconButton variant="danger" onClick={() => removeSize(idx)}><X size={14} /></IconButton>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="grid grid-cols-3 gap-2">
                                            <input value={sizeInput} onChange={e => setSizeInput(e.target.value)} type="text" placeholder={labelType === 'size' ? "Taille" : "Variante"} className={`${inputClass} col-span-2`} />
                                            <input value={stockInput} onChange={e => setStockInput(e.target.value)} type="number" placeholder="Stock" className={inputClass} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input value={sizePriceInput} onChange={e => setSizePriceInput(e.target.value)} type="number" placeholder="Prix (optionnel)" className={inputClass} />
                                            <input value={sizeOfferPriceInput} onChange={e => setSizeOfferPriceInput(e.target.value)} type="number" placeholder="Promo" className={inputClass} />
                                        </div>
                                        <button type="button" onClick={addSize} className="w-full py-2 bg-ink-900 text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
                                            {editingSizeIndex !== null ? 'Mettre à jour' : 'Ajouter'}
                                        </button>
                                        {editingSizeIndex !== null && (
                                            <button type="button" onClick={resetSizeForm} className="text-sm text-ink-500 hover:text-ink-700">Annuler</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Mode VARIANTS */}
                    {productMode === 'variants' && (
                        <div className="flex flex-col gap-4 mt-4">
                            <div>
                                <p className="text-sm font-medium text-ink-800 mb-2">Couleurs</p>
                                {variantColors.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {variantColors.map(c => (
                                            <span key={c.name} className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-ink-100 rounded-full text-sm">
                                                <span className="w-3.5 h-3.5 rounded-full border border-ink-300" style={{ backgroundColor: c.colorCode }} />
                                                {c.name}
                                                <button type="button" onClick={() => removeColorTag(c.name)} className="text-ink-400 hover:text-ramses-600"><X size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input value={colorTagInput} onChange={(e) => setColorTagInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColorTag(); } }}
                                        type="text" placeholder="Ex: Rouge" className={`${inputClass} flex-1`} />
                                    <input value={colorCodeTagInput} onChange={(e) => setColorCodeTagInput(e.target.value)} type="color" className="w-11 h-10 rounded-lg border border-ink-200 cursor-pointer shrink-0" />
                                    <button type="button" onClick={addColorTag} className="shrink-0 px-3.5 py-2.5 bg-ink-900 text-white rounded-lg text-sm font-medium hover:opacity-90 transition">Ajouter</button>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-ink-800 mb-2">Tailles <span className="text-ink-400 font-normal">(optionnel)</span></p>
                                {variantSizes.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {variantSizes.map(s => (
                                            <span key={s} className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 bg-ink-100 rounded-full text-sm">
                                                {s}
                                                <button type="button" onClick={() => removeSizeTag(s)} className="text-ink-400 hover:text-ramses-600"><X size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input value={sizeTagInput} onChange={(e) => setSizeTagInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSizeTag(); } }}
                                        type="text" placeholder="Ex: S, M, L" className={`${inputClass} flex-1`} />
                                    <button type="button" onClick={addSizeTag} className="shrink-0 px-3.5 py-2.5 bg-ink-900 text-white rounded-lg text-sm font-medium hover:opacity-90 transition">Ajouter</button>
                                </div>
                            </div>

                            {variantColors.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-ink-800">Stock & prix par variante</p>
                                        <span className="text-xs text-ink-400">{variantColors.length} couleur(s) × {variantSizes.length || 1} taille(s)</span>
                                    </div>
                                    {variantColors.map(col => {
                                        const sizes = variantSizes.length > 0 ? variantSizes : [null];
                                        const collapsed = !!collapsedColorGroups[col.name];
                                        return (
                                            <div key={col.name} className="border border-ink-200 rounded-xl overflow-hidden mb-2">
                                                <button type="button" onClick={() => toggleColorGroup(col.name)} className="w-full flex items-center justify-between px-3.5 py-3 bg-ink-50 hover:bg-ink-100 transition">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-3.5 h-3.5 rounded-full border border-ink-300" style={{ backgroundColor: col.colorCode }} />
                                                        <span className="font-medium text-sm text-ink-900">{col.name}</span>
                                                        <span className="text-xs text-ink-500">Stock: {colorGroupStockTotal(col.name)}</span>
                                                    </div>
                                                    <ChevronDown size={16} className={`text-ink-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
                                                </button>
                                                {!collapsed && (
                                                    <div className="border-t border-ink-200 bg-white">
                                                        <div className="px-3.5 py-2.5 border-b border-ink-100 flex items-center gap-2.5">
                                                            <span className="text-xs text-ink-500">Départ photos:</span>
                                                            <input value={col.startImageIndex} onChange={(e) => updateColorMeta(col.name, 'startImageIndex', Number(e.target.value))} type="number" min="0" className={`${inputClass} w-20 py-1.5`} />
                                                        </div>
                                                        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 px-3.5 pt-2.5 text-[11px] font-medium text-ink-400 uppercase tracking-wide">
                                                            <span>{variantSizes.length > 0 ? 'Taille' : ''}</span>
                                                            <span>Stock *</span>
                                                            <span>Prix</span>
                                                            <span>Promo</span>
                                                        </div>
                                                        {sizes.map(sz => {
                                                            const cell = variantCells[cellKey(col.name, sz)] || {};
                                                            return (
                                                                <div key={sz ?? '_'} className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 items-center px-3.5 py-2">
                                                                    <span className="text-sm font-medium text-ink-700">{sz || 'Toutes'}</span>
                                                                    <input value={cell.stock ?? ''} onChange={(e) => updateCell(col.name, sz, 'stock', e.target.value)} type="number" min="0" placeholder="0" className={`${inputClass} py-1.5`} />
                                                                    <input value={cell.price ?? ''} onChange={(e) => updateCell(col.name, sz, 'price', e.target.value)} type="number" placeholder="Défaut" className={`${inputClass} py-1.5`} />
                                                                    <input value={cell.offerPrice ?? ''} onChange={(e) => updateCell(col.name, sz, 'offerPrice', e.target.value)} type="number" placeholder="Défaut" className={`${inputClass} py-1.5`} />
                                                                </div>
                                                            );
                                                        })}
                                                        <div className="px-3.5 py-2 border-t border-ink-100">
                                                            <button type="button" onClick={() => removeColorTag(col.name)} className="text-xs font-medium text-ramses-600 hover:text-ramses-700">Supprimer « {col.name} »</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </Section>

                {/* Rappel */}
                {selectedCategories.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-ink-400 px-1">
                        <AlertCircle size={13} /> Une catégorie est requise pour publier ce produit.
                    </div>
                )}
            </form>

            {/* Barre d'action collante */}
            <div className="sticky bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-ink-200 px-4 md:px-8 py-3">
                <div className="max-w-3xl mx-auto flex justify-end gap-3">
                    <Link to="/commercant/produits" className="px-6 py-2.5 bg-ink-100 text-ink-700 text-sm font-medium rounded-xl hover:bg-ink-200 transition">
                        Annuler
                    </Link>
                    <button type="submit" form="add-product-form" disabled={submitting} className="px-6 py-2.5 bg-ink-900 text-white text-sm font-medium rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2">
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isEdition ? 'Enregistrer' : 'Publier'}
                    </button>
                </div>
            </div>

            {showCropper && (
                <ImageCropper
                    imageFile={tempImageFile}
                    onCropComplete={handleCropComplete}
                    onCancel={() => { setShowCropper(false); setTempImageFile(null); }}
                    aspectRatio={1}
                    cropShape="rect"
                    lockAspectRatio
                />
            )}

            {previewIndex !== null && newPreviews[previewIndex] && (
                <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-6" onClick={() => setPreviewIndex(null)}>
                    <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-sm font-medium text-white">Aperçu</span>
                            <button type="button" onClick={() => setPreviewIndex(null)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"><X size={16} /></button>
                        </div>
                        <div className="w-full bg-[#f7f5f2] rounded-none overflow-hidden" style={{ aspectRatio: '1/1' }}>
                            <img src={newPreviews[previewIndex]} alt="Aperçu" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProduitForm;