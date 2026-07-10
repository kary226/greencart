import React, { useState, useEffect } from 'react'
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import ImageCropper from '../../components/ImageCropper';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { resizeAndConvertToWebP } from '../../utils/resizeImage';
import {
    Image as ImageIcon,
    Video,
    FileText,
    Tag,
    Layers,
    Plus,
    X,
    Pencil,
    ChevronDown,
    Loader2,
    RotateCcw,
    Box,
    Ruler,
    Palette,
    Info,
    AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Petits composants de mise en page réutilisés dans la page
// ---------------------------------------------------------------------------

const Section = ({ icon: Icon, title, subtitle, children }) => (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
        <div className="flex items-start gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-gray-700" />
            </div>
            <div>
                <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
                {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
        </div>
        {children}
    </section>
);

const Hint = ({ children }) => (
    <p className="flex items-start gap-1.5 text-xs text-gray-400 mt-2">
        <Info size={13} className="mt-[1px] shrink-0" />
        <span>{children}</span>
    </p>
);

const Field = ({ label, required, children, hint }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-800">
            {label} {required && <span className="text-gray-400">*</span>}
        </label>
        {children}
        {hint && <Hint>{hint}</Hint>}
    </div>
);

const inputClass =
    "outline-none py-2.5 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 transition";

// Segmented control générique (remplace les boutons "stickers")
const SegmentedControl = ({ options, value, onChange, columns = options.length }) => (
    <div
        className="grid gap-1.5 p-1 bg-gray-100 rounded-xl"
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
                        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
        default: 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
        danger: 'text-gray-400 hover:text-red-600 hover:bg-red-50',
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

const AddProduct = () => {

    const [files, setFiles] = useState([]);
    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [price, setPrice] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [categoriesList, setCategoriesList] = useState([]);

    const [productMode, setProductMode] = useState('simple');

    const [simpleStock, setSimpleStock] = useState('');
    const [simpleSize, setSimpleSize] = useState('');

    const [sizesList, setSizesList] = useState([]);
    const [sizeInput, setSizeInput] = useState('');
    const [stockInput, setStockInput] = useState('');
    const [sizePriceInput, setSizePriceInput] = useState('');
    const [sizeOfferPriceInput, setSizeOfferPriceInput] = useState('');
    const [editingSizeIndex, setEditingSizeIndex] = useState(null);
    const [openSizesPanel, setOpenSizesPanel] = useState(true);

    const [colors, setColors] = useState([]);
    const [colorInput, setColorInput] = useState('');
    const [colorCodeInput, setColorCodeInput] = useState('#000000');
    const [startImageIndexInput, setStartImageIndexInput] = useState(0);
    const [editingColorIndex, setEditingColorIndex] = useState(null);
    const [openColorIndex, setOpenColorIndex] = useState(null);
    const [showColorForm, setShowColorForm] = useState(false);

    const [variantSizeInput, setVariantSizeInput] = useState('');
    const [variantStockInput, setVariantStockInput] = useState('');
    const [variantPriceInput, setVariantPriceInput] = useState('');
    const [variantOfferPriceInput, setVariantOfferPriceInput] = useState('');
    const [editingSizeIndexInColor, setEditingSizeIndexInColor] = useState(null);
    const [editingColorForSize, setEditingColorForSize] = useState(null);

    const [showCropper, setShowCropper] = useState(false);
    const [tempImageFile, setTempImageFile] = useState(null);
    const [cropAspectRatio, setCropAspectRatio] = useState(16 / 9);
    const [cropShape, setCropShape] = useState('rect');
    const [isConverting, setIsConverting] = useState(false);

    const [labelType, setLabelType] = useState('size');

    const { axios } = useAppContext()

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/category/list');
            if (data.success) {
                setCategoriesList(data.categories);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

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
        if (editingSizeIndex === index) {
            resetSizeForm();
        }
    };

    const convertSizesToVariants = () => {
        return sizesList.map(size => ({
            color: null,
            colorCode: null,
            size: size.size,
            stock: size.stock,
            price: size.price,
            offerPrice: size.offerPrice,
            startImageIndex: 0
        }));
    };

    const resetColorForm = () => {
        setColorInput('');
        setColorCodeInput('#000000');
        setStartImageIndexInput(0);
        setEditingColorIndex(null);
    };

    const resetVariantSizeForm = () => {
        setVariantSizeInput('');
        setVariantStockInput('');
        setVariantPriceInput('');
        setVariantOfferPriceInput('');
        setEditingSizeIndexInColor(null);
        setEditingColorForSize(null);
    };

    const addColor = () => {
        const colorName = colorInput.trim() || 'Sans couleur';

        if (colorInput.trim()) {
            const existingColor = colors.find(c => c.color.toLowerCase() === colorInput.trim().toLowerCase());
            if (existingColor) {
                toast.error('Cette couleur existe déjà');
                return;
            }
        }

        const newColor = {
            color: colorName,
            colorCode: colorCodeInput,
            startImageIndex: Number(startImageIndexInput) || 0,
            sizes: []
        };

        if (editingColorIndex !== null) {
            const updatedColors = [...colors];
            updatedColors[editingColorIndex] = { ...updatedColors[editingColorIndex], ...newColor, sizes: updatedColors[editingColorIndex].sizes };
            setColors(updatedColors);
        } else {
            setColors([...colors, newColor]);
        }

        resetColorForm();
        setShowColorForm(false);
    };

    const addSizeToColor = (colorIndex) => {
        if (!variantStockInput || Number(variantStockInput) < 0) {
            toast.error('Entrez un stock valide');
            return;
        }

        const newSize = {
            size: variantSizeInput.trim().toUpperCase() || null,
            stock: Number(variantStockInput),
            price: variantPriceInput !== '' ? Number(variantPriceInput) : null,
            offerPrice: variantOfferPriceInput !== '' ? Number(variantOfferPriceInput) : null
        };

        const updatedColors = [...colors];
        if (editingSizeIndexInColor !== null && editingColorForSize === colorIndex) {
            updatedColors[colorIndex].sizes[editingSizeIndexInColor] = newSize;
        } else {
            updatedColors[colorIndex].sizes.push(newSize);
        }
        setColors(updatedColors);
        resetVariantSizeForm();
    };

    const editSizeInColor = (colorIndex, sizeIndex) => {
        const size = colors[colorIndex].sizes[sizeIndex];
        setVariantSizeInput(size.size || '');
        setVariantStockInput(size.stock.toString());
        setVariantPriceInput(size.price !== null ? size.price.toString() : '');
        setVariantOfferPriceInput(size.offerPrice !== null ? size.offerPrice.toString() : '');
        setEditingSizeIndexInColor(sizeIndex);
        setEditingColorForSize(colorIndex);
    };

    const removeSizeFromColor = (colorIndex, sizeIndex) => {
        const updatedColors = [...colors];
        updatedColors[colorIndex].sizes = updatedColors[colorIndex].sizes.filter((_, i) => i !== sizeIndex);
        setColors(updatedColors);
        if (editingSizeIndexInColor === sizeIndex && editingColorForSize === colorIndex) {
            resetVariantSizeForm();
        }
    };

    const removeColor = (index) => {
        setColors(colors.filter((_, i) => i !== index));
        if (editingColorIndex === index) {
            resetColorForm();
            setShowColorForm(false);
        }
        if (openColorIndex === index) {
            setOpenColorIndex(null);
        }
    };

    const editColor = (index) => {
        const color = colors[index];
        setColorInput(color.color !== 'Sans couleur' ? color.color : '');
        setColorCodeInput(color.colorCode || '#000000');
        setStartImageIndexInput(color.startImageIndex || 0);
        setEditingColorIndex(index);
        setShowColorForm(true);
        setOpenColorIndex(null);
    };

    const cancelColorForm = () => {
        resetColorForm();
        setShowColorForm(false);
    };

    const convertVariantsToApi = () => {
        const variants = [];
        colors.forEach(color => {
            color.sizes.forEach(size => {
                variants.push({
                    color: color.color !== 'Sans couleur' ? color.color : null,
                    colorCode: color.colorCode || null,
                    size: size.size,
                    stock: size.stock,
                    price: size.price,
                    offerPrice: size.offerPrice,
                    startImageIndex: color.startImageIndex || 0
                });
            });
        });
        return variants;
    };

    const handleCategoryToggle = (categorySlug) => {
        if (selectedCategories.includes(categorySlug)) {
            setSelectedCategories(selectedCategories.filter(c => c !== categorySlug));
        } else {
            setSelectedCategories([...selectedCategories, categorySlug]);
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setTempImageFile(file);
            setShowCropper(true);
        }
    };

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

    const handleCropComplete = async (croppedFile) => {
        setIsConverting(true);
        try {
            const webpFile = await resizeAndConvertToWebP(croppedFile);
            setFiles(prevFiles => [...prevFiles, webpFile]);
            toast.success('Image optimisée');
        } catch (error) {
            console.error("Erreur lors de la conversion en WebP :", error);
            toast.error("Erreur lors de l'optimisation de l'image");
            setFiles(prevFiles => [...prevFiles, croppedFile]);
        } finally {
            setIsConverting(false);
            setShowCropper(false);
            setTempImageFile(null);
        }
    };

    const onSubmitHandler = async (event) => {
        event.preventDefault();

        if (selectedCategories.length === 0) {
            toast.error('Veuillez sélectionner au moins une catégorie');
            return;
        }

        if (!name.trim()) {
            toast.error('Veuillez entrer un nom de produit');
            return;
        }

        let variants = [];

        if (productMode === 'simple') {
            variants = [];
        } else if (productMode === 'multi-sizes') {
            if (sizesList.length === 0) {
                toast.error('Ajoutez au moins une taille');
                return;
            }
            variants = convertSizesToVariants();
        } else if (productMode === 'variants') {
            if (colors.length === 0) {
                toast.error('Ajoutez au moins une couleur (ou laissez vide pour "Sans couleur")');
                return;
            }
            let hasStock = false;
            colors.forEach(color => {
                color.sizes.forEach(size => {
                    if (size.stock > 0) hasStock = true;
                });
            });
            if (!hasStock) {
                toast.error('Ajoutez au moins un stock pour une variante');
                return;
            }
            variants = convertVariantsToApi();
        }

        const productData = {
            name,
            description,
            categories: selectedCategories,
            price: price ? Number(price) : 0,
            offerPrice: offerPrice ? Number(offerPrice) : 0,
            variants,
            labelType: labelType,
        };

        if (productMode === 'simple') {
            if (simpleStock) {
                productData.stock = Number(simpleStock);
            }
            if (simpleSize) {
                productData.size = simpleSize;
            }
        }

        const formData = new FormData();
        formData.append('productData', JSON.stringify(productData));

        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i])
        }

        if (videoFile) {
            formData.append('video', videoFile);
        }

        try {
            const { data } = await axios.post('/api/product/add', formData)

            if (data.success) {
                toast.success(data.message);
                setName('');
                setDescription('');
                setSelectedCategories([]);
                setPrice('');
                setOfferPrice('');
                setFiles([]);
                setVideoFile(null);
                setVideoPreview('');
                setSimpleStock('');
                setSimpleSize('');
                setSizesList([]);
                setColors([]);
                setProductMode('simple');
                setLabelType('size');
                resetSizeForm();
                resetColorForm();
                resetVariantSizeForm();
                setShowColorForm(false);
                setOpenColorIndex(null);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const cropPresets = [
        { label: '16:9', ratio: 16 / 9 },
        { label: '1:1', ratio: 1 },
        { label: '4:3', ratio: 4 / 3 },
    ];

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll bg-gray-50">
            <form id="add-product-form" onSubmit={onSubmitHandler} className="max-w-3xl mx-auto p-4 md:p-8 pb-28 space-y-4">

                <div className="mb-2">
                    <h1 className="text-xl font-semibold text-gray-900">Nouveau produit</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Renseignez les informations ci-dessous pour publier un article.</p>
                </div>

                {/* Médias */}
                <Section icon={ImageIcon} title="Médias" subtitle="Photos et vidéo de présentation">
                    <div className="space-y-5">
                        {/* Photos */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-800">Photos, dans l'ordre d'affichage</span>
                                <div className="flex items-center gap-1">
                                    {cropPresets.map((p) => (
                                        <button
                                            key={p.label}
                                            type="button"
                                            onClick={() => { setCropAspectRatio(p.ratio); setCropShape('rect'); }}
                                            className={`text-xs px-2.5 py-1 rounded-md transition ${
                                                cropAspectRatio === p.ratio ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                    <IconButton onClick={() => setShowCropper(false)}>
                                        <RotateCcw size={14} />
                                    </IconButton>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                                {files.map((file, index) => (
                                    <div key={index} className="relative group aspect-square">
                                        <img
                                            className="w-full h-full object-cover rounded-xl border border-gray-200"
                                            src={URL.createObjectURL(file)}
                                            alt={`Produit ${index + 1}`}
                                        />
                                        {index === 0 && (
                                            <span className="absolute bottom-1 left-1 text-[10px] bg-gray-900/80 text-white px-1.5 py-0.5 rounded">
                                                Couverture
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => { const newFiles = [...files]; newFiles.splice(index, 1); setFiles(newFiles); }}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-200 transition opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                <label className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition">
                                    <input onChange={handleImageSelect} type="file" accept="image/*" className="hidden" />
                                    <Plus size={18} className="text-gray-400" />
                                    <span className="text-[11px] text-gray-400">Ajouter</span>
                                </label>
                            </div>

                            <Hint>
                                Les images sont automatiquement optimisées en WebP (poids réduit d'environ 70%, qualité conservée).
                                {isConverting && (
                                    <span className="inline-flex items-center gap-1 text-gray-600 ml-1">
                                        <Loader2 size={12} className="animate-spin" /> Conversion en cours…
                                    </span>
                                )}
                            </Hint>
                        </div>

                        {/* Vidéo */}
                        <div>
                            <span className="text-sm font-medium text-gray-800">Vidéo (optionnel)</span>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                <label className="flex items-center gap-2 px-3.5 py-2.5 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition">
                                    <input onChange={handleVideoSelect} type="file" accept="video/*" className="hidden" />
                                    <Video size={16} className="text-gray-400" />
                                    <span className="text-sm text-gray-500">Choisir une vidéo</span>
                                </label>
                                {videoPreview && (
                                    <div className="relative">
                                        <video
                                            src={videoPreview}
                                            className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                                            controls
                                            muted
                                        />
                                        <button
                                            type="button"
                                            onClick={removeVideo}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-200 transition"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <Hint>Format MP4, WebM ou MOV, 100 Mo maximum. La vidéo s'affiche sur la fiche produit.</Hint>
                        </div>
                    </div>
                </Section>

                {/* Informations générales */}
                <Section icon={FileText} title="Informations générales">
                    <div className="space-y-4">
                        <Field label="Nom du produit" required>
                            <input
                                onChange={(e) => setName(e.target.value)}
                                value={name}
                                type="text"
                                placeholder="Ex : Riz basmati 5kg"
                                className={inputClass}
                                required
                            />
                        </Field>

                        <Field label="Description">
                            <ReactQuill
                                value={description}
                                onChange={setDescription}
                                theme="snow"
                                placeholder="Décrivez votre produit…"
                                className="bg-white rounded-lg"
                                style={{ minHeight: '150px' }}
                            />
                        </Field>

                        <Field label="Catégories" required>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2.5 border border-gray-200 rounded-lg">
                                {categoriesList.length === 0 && (
                                    <span className="text-xs text-gray-400 px-1 py-1">Aucune catégorie disponible</span>
                                )}
                                {categoriesList.map((item) => (
                                    <button
                                        key={item._id}
                                        type="button"
                                        onClick={() => handleCategoryToggle(item.slug)}
                                        className={`px-3 py-1.5 rounded-full text-sm transition ${
                                            selectedCategories.includes(item.slug)
                                                ? 'bg-gray-900 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        </Field>
                    </div>
                </Section>

                {/* Tarification */}
                <Section icon={Tag} title="Tarification" subtitle="Prix appliqués par défaut à tout le produit">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Prix par défaut" required>
                            <input
                                onChange={(e) => setPrice(e.target.value)}
                                value={price}
                                type="number"
                                placeholder="0"
                                className={inputClass}
                                required
                            />
                        </Field>
                        <Field label="Prix promotionnel" required>
                            <input
                                onChange={(e) => setOfferPrice(e.target.value)}
                                value={offerPrice}
                                type="number"
                                placeholder="0"
                                className={inputClass}
                                required
                            />
                        </Field>
                    </div>
                    <Hint>Une variante peut avoir son propre prix ; à défaut, elle utilise ceux-ci.</Hint>
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
                    <p className="text-xs text-gray-400 mt-2.5">
                        {productMode === 'simple' && "Un seul prix, un seul stock, une taille optionnelle."}
                        {productMode === 'multi-sizes' && "Plusieurs tailles, chacune avec son propre stock, sans couleurs."}
                        {productMode === 'variants' && "Plusieurs couleurs (optionnel), chacune avec ses propres tailles et stocks."}
                    </p>

                    {/* Mode SIMPLE */}
                    {productMode === 'simple' && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <Field label="Stock (optionnel)" hint="Laissez vide si vous ne voulez pas définir de stock.">
                                <input
                                    onChange={(e) => setSimpleStock(e.target.value)}
                                    value={simpleStock}
                                    type="number"
                                    min="0"
                                    placeholder="Quantité disponible"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Taille (optionnel)" hint="Laissez vide si ce produit n'a pas de taille spécifique.">
                                <input
                                    onChange={(e) => setSimpleSize(e.target.value)}
                                    value={simpleSize}
                                    type="text"
                                    placeholder="S, M, L, XL…"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    )}

                    {/* Mode MULTI-TAILLES */}
                    {productMode === 'multi-sizes' && (
                        <div className="flex flex-col gap-4 mt-4">
                            <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50">
                                <p className="text-sm font-medium text-gray-800 mb-1">Type de libellé</p>
                                <p className="text-xs text-gray-400 mb-2.5">Détermine le texte affiché pour chaque option côté client.</p>
                                <SegmentedControl
                                    value={labelType}
                                    onChange={setLabelType}
                                    options={[
                                        { value: 'size', label: 'Taille', icon: Ruler },
                                        { value: 'variant', label: 'Variante', icon: Box },
                                    ]}
                                />
                                <p className="text-xs text-gray-400 mt-2">
                                    {labelType === 'size'
                                        ? 'Affiche « Taille » (S, M, L…)'
                                        : 'Affiche « Variante » (Pastèque, Orange, Aloe vera…)'}
                                </p>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setOpenSizesPanel(!openSizesPanel)}
                                    className="w-full flex items-center justify-between px-3.5 py-3 bg-gray-50 hover:bg-gray-100 transition"
                                >
                                    <span className="font-medium text-sm text-gray-900">
                                        {labelType === 'size' ? 'Tailles' : 'Variantes'} disponibles ({sizesList.length})
                                    </span>
                                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${openSizesPanel ? 'rotate-180' : ''}`} />
                                </button>
                                {openSizesPanel && (
                                    <div className="px-3.5 py-3.5 border-t border-gray-200 space-y-3">
                                        {sizesList.length > 0 && (
                                            <div className="space-y-2">
                                                {sizesList.map((size, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                                                        <div className="text-sm">
                                                            <span className="font-medium text-gray-800">{size.size}</span>
                                                            <span className="text-xs text-gray-500 ml-2">Stock : {size.stock}</span>
                                                            {size.price && <span className="text-xs text-gray-400 ml-2">{size.price} FCFA</span>}
                                                        </div>
                                                        <div className="flex gap-0.5">
                                                            <IconButton onClick={() => editSize(idx)}><Pencil size={13} /></IconButton>
                                                            <IconButton variant="danger" onClick={() => removeSize(idx)}><X size={14} /></IconButton>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-3 gap-2">
                                            <input value={sizeInput} onChange={e => setSizeInput(e.target.value)} type="text" placeholder={labelType === 'size' ? "Taille" : "Variante"} className={`${inputClass} col-span-2`} />
                                            <input value={stockInput} onChange={e => setStockInput(e.target.value)} type="number" placeholder="Stock" className={inputClass} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input value={sizePriceInput} onChange={e => setSizePriceInput(e.target.value)} type="number" placeholder="Prix (optionnel)" className={inputClass} />
                                            <input value={sizeOfferPriceInput} onChange={e => setSizeOfferPriceInput(e.target.value)} type="number" placeholder="Promo (optionnel)" className={inputClass} />
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={addSize} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
                                                {editingSizeIndex !== null ? 'Mettre à jour' : 'Ajouter'}
                                            </button>
                                            {editingSizeIndex !== null && (
                                                <button type="button" onClick={resetSizeForm} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Annuler</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Mode VARIANTS (Couleurs + Tailles) */}
                    {productMode === 'variants' && (
                        <div className="flex flex-col gap-3 mt-4">
                            {colors.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    {colors.map((color, colorIndex) => {
                                        const isOpen = openColorIndex === colorIndex;
                                        const totalStock = color.sizes.reduce((sum, s) => sum + s.stock, 0);
                                        return (
                                            <div key={colorIndex} className="border border-gray-200 rounded-xl overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenColorIndex(isOpen ? null : colorIndex)}
                                                    className="w-full flex items-center justify-between px-3.5 py-3 bg-gray-50 hover:bg-gray-100 transition"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {color.color !== 'Sans couleur' && (
                                                            <span className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ backgroundColor: color.colorCode }}></span>
                                                        )}
                                                        <span className="font-medium text-sm text-gray-900">{color.color}</span>
                                                        <span className="text-xs text-gray-400">({color.sizes.length})</span>
                                                        <span className="text-xs text-gray-500">Stock total : {totalStock}</span>
                                                    </div>
                                                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                                {isOpen && (
                                                    <div className="px-3.5 py-3.5 border-t border-gray-200 bg-white space-y-3">
                                                        {color.sizes.length > 0 && (
                                                            <div className="space-y-2">
                                                                {color.sizes.map((size, sizeIndex) => (
                                                                    <div key={sizeIndex} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                                                                        <div className="text-sm">
                                                                            <span className="font-medium text-gray-800">{size.size || 'Sans taille'}</span>
                                                                            <span className="text-xs text-gray-500 ml-2">Stock : {size.stock}</span>
                                                                            {size.price && <span className="text-xs text-gray-400 ml-2">{size.price} FCFA</span>}
                                                                        </div>
                                                                        <div className="flex gap-0.5">
                                                                            <IconButton onClick={() => editSizeInColor(colorIndex, sizeIndex)}><Pencil size={13} /></IconButton>
                                                                            <IconButton variant="danger" onClick={() => removeSizeFromColor(colorIndex, sizeIndex)}><X size={14} /></IconButton>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <input
                                                                value={variantSizeInput}
                                                                onChange={e => setVariantSizeInput(e.target.value)}
                                                                type="text"
                                                                placeholder="Taille (optionnel)"
                                                                className={`${inputClass} col-span-2`}
                                                            />
                                                            <input
                                                                value={variantStockInput}
                                                                onChange={e => setVariantStockInput(e.target.value)}
                                                                type="number"
                                                                placeholder="Stock *"
                                                                className={inputClass}
                                                                required
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                value={variantPriceInput}
                                                                onChange={e => setVariantPriceInput(e.target.value)}
                                                                type="number"
                                                                placeholder="Prix (optionnel)"
                                                                className={inputClass}
                                                            />
                                                            <input
                                                                value={variantOfferPriceInput}
                                                                onChange={e => setVariantOfferPriceInput(e.target.value)}
                                                                type="number"
                                                                placeholder="Promo (optionnel)"
                                                                className={inputClass}
                                                            />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => addSizeToColor(colorIndex)}
                                                                className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
                                                            >
                                                                {editingSizeIndexInColor !== null && editingColorForSize === colorIndex ? 'Mettre à jour' : 'Ajouter une taille'}
                                                            </button>
                                                            {editingSizeIndexInColor !== null && editingColorForSize === colorIndex && (
                                                                <button type="button" onClick={resetVariantSizeForm} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Annuler</button>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                                                            <button type="button" onClick={() => editColor(colorIndex)} className="flex-1 py-2 text-gray-700 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200 transition">
                                                                Modifier la couleur
                                                            </button>
                                                            <button type="button" onClick={() => removeColor(colorIndex)} className="flex-1 py-2 text-red-600 bg-red-50 rounded-lg text-xs font-medium hover:bg-red-100 transition">
                                                                Supprimer la couleur
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {!showColorForm && (
                                <button
                                    type="button"
                                    onClick={() => setShowColorForm(true)}
                                    className="flex items-center justify-center gap-1.5 w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition"
                                >
                                    <Plus size={15} /> Ajouter une couleur (optionnel)
                                </button>
                            )}

                            {showColorForm && (
                                <div className="bg-gray-50 p-3.5 rounded-xl space-y-3 border border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900">
                                            {editingColorIndex !== null ? 'Modifier la couleur' : 'Nouvelle couleur (optionnel)'}
                                        </span>
                                        <button type="button" onClick={cancelColorForm} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            value={colorInput}
                                            onChange={e => setColorInput(e.target.value)}
                                            type="text"
                                            placeholder="Nom de la couleur (optionnel)"
                                            className={`${inputClass} flex-1`}
                                        />
                                        <input
                                            value={colorCodeInput}
                                            onChange={e => setColorCodeInput(e.target.value)}
                                            type="color"
                                            className="w-11 h-10 rounded-lg border border-gray-200 cursor-pointer"
                                        />
                                    </div>
                                    <Field label="Position de départ dans les photos">
                                        <input
                                            value={startImageIndexInput}
                                            onChange={e => setStartImageIndexInput(Number(e.target.value))}
                                            type="number"
                                            min="0"
                                            placeholder="Ex : 0 pour la première couleur, 3 pour la suivante…"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Hint>Permet d'afficher d'abord les photos correspondant à cette couleur.</Hint>
                                    <button type="button" onClick={addColor} className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
                                        {editingColorIndex !== null ? 'Mettre à jour la couleur' : 'Ajouter cette couleur'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </Section>

                {/* Rappel des champs requis avant soumission (visuel discret, pas de blocage) */}
                {selectedCategories.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                        <AlertCircle size={13} />
                        Une catégorie est requise pour publier ce produit.
                    </div>
                )}
            </form>

            {/* Barre d'action collante */}
            <div className="sticky bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-200 px-4 md:px-8 py-3">
                <div className="max-w-3xl mx-auto flex justify-end">
                    <button
                        type="submit"
                        form="add-product-form"
                        className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:opacity-90 transition"
                    >
                        Publier le produit
                    </button>
                </div>
            </div>

            {showCropper && (
                <ImageCropper
                    imageFile={tempImageFile}
                    onCropComplete={handleCropComplete}
                    onCancel={() => {
                        setShowCropper(false);
                        setTempImageFile(null);
                    }}
                    aspectRatio={cropAspectRatio}
                    cropShape={cropShape}
                />
            )}
        </div>
    )
}

export default AddProduct