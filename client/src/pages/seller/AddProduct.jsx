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
    Wand2,
    Link as LinkIcon,
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

// Barre d'outils épurée pour la description produit — inspirée de celle de Shopify :
// juste ce qu'il faut (titres, gras/italique/souligné, couleur, liste, lien, image),
// pas la totalité des options par défaut de Quill qui alourdit l'interface.
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
    const [sku, setSku] = useState('');
    const [generationSku, setGenerationSku] = useState(false);
    const [description, setDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [price, setPrice] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [externalLink, setExternalLink] = useState('');
    const [categoriesList, setCategoriesList] = useState([]);
    // Boutique à laquelle rattacher l'article. Vide = catalogue principal
    // (comportement historique). Renseignée, l'article appartient au
    // commerçant : il apparaît dans son espace, il en gère les quantités et
    // ses ventes créditent son portefeuille.
    const [boutiquesList, setBoutiquesList] = useState([]);
    const [boutiqueId, setBoutiqueId] = useState('');

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

    // Mode "Couleurs + tailles" — modèle matriciel façon Shopify : deux listes de
    // valeurs (couleurs, tailles) combinées automatiquement en tableau de variantes,
    // plutôt que des formulaires imbriqués à remplir un par un.
    const [variantColors, setVariantColors] = useState([]); // [{ name, colorCode, startImageIndex }]
    const [variantSizes, setVariantSizes] = useState([]);   // ["S", "M", ...]
    const [variantCells, setVariantCells] = useState({});   // { "Rouge__S": { stock, price, offerPrice } }
    const [colorTagInput, setColorTagInput] = useState('');
    const [colorCodeTagInput, setColorCodeTagInput] = useState('#000000');
    const [sizeTagInput, setSizeTagInput] = useState('');
    const [collapsedColorGroups, setCollapsedColorGroups] = useState({});

    const [showCropper, setShowCropper] = useState(false);
    const [tempImageFile, setTempImageFile] = useState(null);
    const [previewIndex, setPreviewIndex] = useState(null);
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

    const fetchBoutiques = async () => {
        try {
            const { data } = await axios.get('/api/boutiques/options');
            if (data.success) setBoutiquesList(data.boutiques || []);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchCategories();
        fetchBoutiques();
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

    // Clé unique pour une cellule du tableau (une combinaison couleur × taille)
    const cellKey = (colorName, size) => `${colorName}__${size ?? ''}`;

    const updateCell = (colorName, size, field, value) => {
        const key = cellKey(colorName, size);
        setVariantCells(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    };

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

    // Total de stock saisi pour une couleur, toutes tailles confondues — affiché
    // dans l'en-tête du groupe pour un aperçu rapide, comme sur Shopify.
    const colorGroupStockTotal = (colorName) => {
        const sizes = variantSizes.length > 0 ? variantSizes : [null];
        return sizes.reduce((sum, sz) => sum + (Number(variantCells[cellKey(colorName, sz)]?.stock) || 0), 0);
    };

    const convertVariantsToApi = () => {
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

    // Demande un code libre au serveur. Le tirage se fait côté serveur parce
    // que lui seul voit les codes déjà pris — un tirage local pourrait tomber
    // sur un doublon et l'enregistrement échouerait au dernier moment.
    const genererCode = async () => {
        try {
            setGenerationSku(true);
            const { data } = await axios.get('/api/product/generate-sku');
            if (data.success) setSku(data.sku);
            else toast.error(data.message || 'Génération impossible');
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setGenerationSku(false);
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
            if (variantColors.length === 0) {
                toast.error('Ajoutez au moins une couleur');
                return;
            }
            let hasStock = false;
            const sizesForCheck = variantSizes.length > 0 ? variantSizes : [null];
            variantColors.forEach(col => {
                sizesForCheck.forEach(sz => {
                    if (Number(variantCells[cellKey(col.name, sz)]?.stock) > 0) hasStock = true;
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
            // Chaîne vide = « débrouille-toi » : le serveur génère le code.
            sku: sku.trim(),
            description,
            categories: selectedCategories,
            price: price ? Number(price) : 0,
            offerPrice: offerPrice ? Number(offerPrice) : Number(price) || 0,
            purchasePrice: purchasePrice ? Number(purchasePrice) : 0,
            externalLink: externalLink.trim() || null,
            variants,
            labelType: labelType,
            // Chaîne vide = catalogue principal : le serveur la traite
            // comme « aucune boutique ».
            boutiqueId: boutiqueId || null,
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

        // [FIX UX] Vercel plafonne le corps des Serverless Functions à 4.5MB,
        // quelle que soit la limite Express configurée — au-delà, l'appel échoue
        // en 403 sans message clair. On prévient avant l'envoi plutôt que de
        // laisser l'utilisateur face à une erreur muette.
        const totalBytes = files.reduce((sum, f) => sum + f.size, 0) + (videoFile ? videoFile.size : 0);
        const VERCEL_BODY_LIMIT = 4.4 * 1024 * 1024;
        if (totalBytes > VERCEL_BODY_LIMIT) {
            console.warn(`⚠️ Taille totale: ${(totalBytes / 1024 / 1024).toFixed(2)}MB > ${(VERCEL_BODY_LIMIT / 1024 / 1024).toFixed(2)}MB`);
            toast.error(
                videoFile
                    ? "Trop volumineux pour être envoyé en une fois. Retirez la vidéo ou réduisez le nombre de photos."
                    : "Trop de photos pour être envoyées en une fois. Réduisez-en le nombre et réessayez."
            );
            return;
        }


        try {
            const { data } = await axios.post('/api/product/add', formData, {
                withCredentials: true,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });


            if (data.success) {
                toast.success(data.message);
                setName('');
                setSku('');
                setDescription('');
                setSelectedCategories([]);
                setPrice('');
                setOfferPrice('');
                setPurchasePrice('');
                setExternalLink('');
                setFiles([]);
                setVideoFile(null);
                setVideoPreview('');
                setSimpleStock('');
                setSimpleSize('');
                setSizesList([]);
                setVariantColors([]);
                setVariantSizes([]);
                setVariantCells({});
                setColorTagInput('');
                setColorCodeTagInput('#000000');
                setSizeTagInput('');
                setCollapsedColorGroups({});
                setProductMode('simple');
                setLabelType('size');
                resetSizeForm();
            } else {
                console.error('❌ Erreur serveur (data.success = false):', data.message);
                toast.error(data.message);
            }
        } catch (error) {
            console.error('❌ ERREUR COMPLÈTE:', error);
            console.error('❌ Message:', error.message);
            console.error('❌ Response:', error.response);
            console.error('❌ Response data:', error.response?.data);
            console.error('❌ Response status:', error.response?.status);
            console.error('❌ Response headers:', error.response?.headers);
            toast.error(error.response?.data?.message || error.message);
        }

    };

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll bg-gray-50">
            <form id="add-product-form" onSubmit={onSubmitHandler} className="max-w-3xl mx-auto p-4 md:p-8 pb-28 space-y-4">

                <div className="mb-2">
                    <h1 className="text-xl font-semibold text-gray-900">Nouveau produit</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Renseignez les informations ci-dessous pour publier un article.</p>
                </div>

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

                        <Field
                            label="Code article"
                            hint="Sert à retrouver l'article dans la recherche, sur une facture ou au téléphone. Laissez vide et il sera généré tout seul à l'enregistrement."
                        >
                            <div className="flex gap-2">
                                <input
                                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                                    value={sku}
                                    type="text"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    spellCheck="false"
                                    maxLength={24}
                                    placeholder="RMC-7K4M2X"
                                    className={`${inputClass} flex-1 font-mono tracking-wide uppercase`}
                                />
                                {/* Le code vient du serveur, pas du navigateur :
                                    lui seul peut garantir qu'il est encore libre. */}
                                <button
                                    type="button"
                                    onClick={genererCode}
                                    disabled={generationSku}
                                    className="shrink-0 inline-flex items-center gap-2 px-3.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition"
                                >
                                    {generationSku
                                        ? <Loader2 aria-hidden="true" size={15} className="animate-spin" />
                                        : <Wand2 aria-hidden="true" size={15} />}
                                    Générer
                                </button>
                            </div>
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
                                .pd-quill .ql-container.ql-snow:has(.ql-editor:focus) {
                                    border-color: #9ca3af;
                                }
                                .pd-quill .ql-editor { min-height: 150px; color: #111827; line-height: 1.6; }
                                .pd-quill .ql-editor.ql-blank::before { color: #9ca3af; font-style: normal; }
                                .pd-quill .ql-snow .ql-stroke { stroke: #6b7280; }
                                .pd-quill .ql-snow .ql-fill { fill: #6b7280; }
                                .pd-quill .ql-picker-label { color: #6b7280; }
                                .pd-quill .ql-toolbar.ql-snow .ql-formats { margin-right: 10px; }
                                .pd-quill button.ql-active, .pd-quill .ql-picker-label.ql-active {
                                    background: #e5e7eb;
                                    border-radius: 6px;
                                }
                                .pd-quill button:hover, .pd-quill .ql-picker-label:hover {
                                    background: #f0f0f0;
                                    border-radius: 6px;
                                }
                                .pd-quill .ql-picker-options {
                                    border-radius: 8px;
                                    border-color: #e5e7eb;
                                    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
                                }
                            `}</style>
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

                        <Field label="Boutique">
                            <select
                                value={boutiqueId}
                                onChange={(e) => setBoutiqueId(e.target.value)}
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-gray-900 transition"
                            >
                                <option value="">Catalogue principal (aucune boutique)</option>
                                {boutiquesList.map((b) => (
                                    <option key={b._id} value={b._id}>
                                        {b.nom}{b.ownerId?.nom ? ` — ${b.ownerId.nom}` : ''}
                                        {b.statut === 'suspendue' ? ' (suspendue)' : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1.5">
                                Attribuer l'article à une boutique : le commerçant le retrouve dans son
                                espace, gère ses quantités, et les ventes créditent son portefeuille.
                            </p>
                        </Field>
                    </div>
                </Section>

                {/* Médias */}
                <Section icon={ImageIcon} title="Médias" subtitle="Photos et vidéo de présentation">
                    <div className="space-y-5">
                        {/* Photos */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-800">Photos, dans l'ordre d'affichage</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400">Carré 1:1 — identique à la fiche produit</span>
                                    <IconButton onClick={() => setShowCropper(false)}>
                                        <RotateCcw size={14} />
                                    </IconButton>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                                {files.map((file, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => setPreviewIndex(index)}
                                        className="relative group aspect-square"
                                    >
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
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); const newFiles = [...files]; newFiles.splice(index, 1); setFiles(newFiles); }}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-200 transition opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={12} />
                                        </span>
                                    </button>
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

                {/* Tarification */}
                <Section icon={Tag} title="Prix de vente client" subtitle="Prix finaux affichés et payés par le client">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Prix de vente client" required>
                            <input
                                onChange={(e) => setPrice(e.target.value)}
                                value={price}
                                type="number"
                                placeholder="0"
                                className={inputClass}
                                required
                            />
                        </Field>
                        <Field label="Prix promotionnel client" hint="Vide = pas de promotion ; le prix de vente normal s'applique.">
                            <input
                                onChange={(e) => setOfferPrice(e.target.value)}
                                value={offerPrice}
                                type="number"
                                placeholder="Optionnel"
                                className={inputClass}
                            />
                        </Field>
                    </div>
                    <Hint>Le prix saisi ici est déjà le prix final client. Aucune commission de 10 % ne sera ajoutée après la saisie. Une variante peut avoir son propre prix final.</Hint>

                    <div className="mt-4">
                        <Field label="Prix d'achat" hint="Donnée interne uniquement ; jamais affichée au client et indépendante du prix de vente.">
                            <input
                                onChange={(e) => setPurchasePrice(e.target.value)}
                                value={purchasePrice}
                                type="number"
                                placeholder="Optionnel"
                                className={inputClass}
                            />
                        </Field>
                    </div>
                </Section>

                {/* Lien supplémentaire */}
                <Section icon={LinkIcon} title="Lien supplémentaire" subtitle="Optionnel — visible uniquement dans le récap Airtable">
                    <Field label="Lien" hint="Fiche fournisseur, annonce d'origine, etc. Laissez vide si non pertinent.">
                        <input
                            onChange={(e) => setExternalLink(e.target.value)}
                            value={externalLink}
                            type="url"
                            placeholder="https://…"
                            className={inputClass}
                        />
                    </Field>
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

                    {/* Mode VARIANTS (Couleurs + Tailles) — modèle matriciel façon Shopify :
                        on saisit les valeurs une fois, le tableau se génère tout seul. */}
                    {productMode === 'variants' && (
                        <div className="flex flex-col gap-4 mt-4">
                            {/* Étape 1 — couleurs */}
                            <div>
                                <p className="text-sm font-medium text-gray-800 mb-2">Couleurs</p>
                                {variantColors.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {variantColors.map((c) => (
                                            <span key={c.name} className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-gray-100 rounded-full text-sm">
                                                <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: c.colorCode }} />
                                                {c.name}
                                                <button type="button" onClick={() => removeColorTag(c.name)} className="text-gray-400 hover:text-red-600">
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input
                                        value={colorTagInput}
                                        onChange={(e) => setColorTagInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColorTag(); } }}
                                        type="text"
                                        placeholder="Ex : Rouge — puis Entrée"
                                        className={`${inputClass} flex-1`}
                                    />
                                    <input
                                        value={colorCodeTagInput}
                                        onChange={(e) => setColorCodeTagInput(e.target.value)}
                                        type="color"
                                        className="w-11 h-10 rounded-lg border border-gray-200 cursor-pointer shrink-0"
                                    />
                                    <button type="button" onClick={addColorTag} className="shrink-0 px-3.5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
                                        Ajouter
                                    </button>
                                </div>
                            </div>

                            {/* Étape 2 — tailles (optionnel) */}
                            <div>
                                <p className="text-sm font-medium text-gray-800 mb-2">
                                    Tailles <span className="text-gray-400 font-normal">(optionnel)</span>
                                </p>
                                {variantSizes.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {variantSizes.map((s) => (
                                            <span key={s} className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 bg-gray-100 rounded-full text-sm">
                                                {s}
                                                <button type="button" onClick={() => removeSizeTag(s)} className="text-gray-400 hover:text-red-600">
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input
                                        value={sizeTagInput}
                                        onChange={(e) => setSizeTagInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSizeTag(); } }}
                                        type="text"
                                        placeholder="Ex : S, M, L — puis Entrée"
                                        className={`${inputClass} flex-1`}
                                    />
                                    <button type="button" onClick={addSizeTag} className="shrink-0 px-3.5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
                                        Ajouter
                                    </button>
                                </div>
                                <Hint>Sans taille, chaque couleur n'a qu'une seule ligne de stock.</Hint>
                            </div>

                            {/* Étape 3 — tableau généré automatiquement (couleurs × tailles), édition directe */}
                            {variantColors.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-gray-800">Stock &amp; prix par variante</p>
                                        <span className="text-xs text-gray-400">
                                            {variantColors.length} couleur(s) × {variantSizes.length || 1} taille(s)
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {variantColors.map((col) => {
                                            const sizesForRows = variantSizes.length > 0 ? variantSizes : [null];
                                            const collapsed = !!collapsedColorGroups[col.name];
                                            return (
                                                <div key={col.name} className="border border-gray-200 rounded-xl overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleColorGroup(col.name)}
                                                        className="w-full flex items-center justify-between px-3.5 py-3 bg-gray-50 hover:bg-gray-100 transition"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: col.colorCode }} />
                                                            <span className="font-medium text-sm text-gray-900">{col.name}</span>
                                                            <span className="text-xs text-gray-500">Stock total : {colorGroupStockTotal(col.name)}</span>
                                                        </div>
                                                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
                                                    </button>
                                                    {!collapsed && (
                                                        <div className="border-t border-gray-200 bg-white">
                                                            <div className="px-3.5 py-2.5 border-b border-gray-100 flex items-center gap-2.5">
                                                                <span className="text-xs text-gray-500 shrink-0">Départ photos :</span>
                                                                <input
                                                                    value={col.startImageIndex}
                                                                    onChange={(e) => updateColorMeta(col.name, 'startImageIndex', Number(e.target.value))}
                                                                    type="number"
                                                                    min="0"
                                                                    className={`${inputClass} w-20 py-1.5`}
                                                                />
                                                                <span className="text-xs text-gray-400">0 = premières photos, 3 = à partir de la 4ᵉ…</span>
                                                            </div>
                                                            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 px-3.5 pt-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                                                                <span>{variantSizes.length > 0 ? 'Taille' : ''}</span>
                                                                <span>Stock *</span>
                                                                <span>Prix</span>
                                                                <span>Promo</span>
                                                            </div>
                                                            <div className="divide-y divide-gray-100">
                                                                {sizesForRows.map((sz) => {
                                                                    const cell = variantCells[cellKey(col.name, sz)] || {};
                                                                    return (
                                                                        <div key={sz ?? '_'} className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 items-center px-3.5 py-2">
                                                                            <span className="text-sm font-medium text-gray-700">{sz || 'Toutes tailles'}</span>
                                                                            <input
                                                                                value={cell.stock ?? ''}
                                                                                onChange={(e) => updateCell(col.name, sz, 'stock', e.target.value)}
                                                                                type="number" min="0" placeholder="0"
                                                                                className={`${inputClass} py-1.5`}
                                                                            />
                                                                            <input
                                                                                value={cell.price ?? ''}
                                                                                onChange={(e) => updateCell(col.name, sz, 'price', e.target.value)}
                                                                                type="number" placeholder="Défaut"
                                                                                className={`${inputClass} py-1.5`}
                                                                            />
                                                                            <input
                                                                                value={cell.offerPrice ?? ''}
                                                                                onChange={(e) => updateCell(col.name, sz, 'offerPrice', e.target.value)}
                                                                                type="number" placeholder="Défaut"
                                                                                className={`${inputClass} py-1.5`}
                                                                            />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div className="px-3.5 py-2 border-t border-gray-100">
                                                                <button type="button" onClick={() => removeColorTag(col.name)} className="text-xs font-medium text-red-600 hover:text-red-700">
                                                                    Supprimer la couleur « {col.name} »
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <Hint>Les prix de variantes sont eux aussi des prix finaux client. Vides → le produit utilise le prix par défaut défini plus haut.</Hint>
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
                    aspectRatio={1}
                    cropShape="rect"
                    lockAspectRatio
                />
            )}

            {/* Aperçu fidèle — reproduit exactement le conteneur d'image de la fiche
                produit (aspect-ratio 1/1, object-fit cover) pour vérifier le rendu
                final avant de publier. */}
            {previewIndex !== null && files[previewIndex] && (
                <div
                    className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-6"
                    onClick={() => setPreviewIndex(null)}
                >
                    <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-sm font-medium text-white">Aperçu — fiche produit</span>
                            <button
                                type="button"
                                onClick={() => setPreviewIndex(null)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="w-full bg-[#f7f5f2] rounded-none overflow-hidden" style={{ aspectRatio: '1/1' }}>
                            <img
                                src={URL.createObjectURL(files[previewIndex])}
                                alt="Aperçu"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <p className="text-center text-xs text-white/50 mt-2.5">
                            C'est exactement ce que verra le client sur la fiche produit.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AddProduct