import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import toast from 'react-hot-toast'
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
    Search,
    Pencil,
    Trash2,
    X,
    Plus,
    ImagePlus,
    Upload,
    ChevronDown,
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
    Loader2,
    Info,
    Box,
    Ruler,
    Palette,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Tag,
    ArrowUp,
    ArrowDown,
    Package,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Petits composants de mise en page réutilisés dans la page (mêmes conventions
// visuelles que AddProduct.jsx : cartes, segmented control, pas d'emoji)
// ---------------------------------------------------------------------------

const Section = ({ icon: Icon, title, subtitle, children }) => (
    <div className="border border-gray-200 rounded-2xl p-4">
        <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-gray-700" />
            </div>
            <div>
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
        </div>
        {children}
    </div>
);

const Hint = ({ children }) => (
    <p className="flex items-start gap-1.5 text-xs text-gray-400 mt-2">
        <Info size={13} className="mt-[1px] shrink-0" />
        <span>{children}</span>
    </p>
);

const Field = ({ label, children, hint }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-800">{label}</label>
        {children}
        {hint && <Hint>{hint}</Hint>}
    </div>
);

const inputClass =
    "outline-none py-2.5 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 transition w-full";

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
                    onClick={opt.onClick}
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

const StatCard = ({ icon: Icon, label, value, tone = 'default' }) => {
    const tones = {
        default: 'text-gray-900',
        green: 'text-green-600',
        red: 'text-red-500',
        orange: 'text-orange-500',
    };
    return (
        <div className="bg-white rounded-xl p-3.5 border border-gray-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-gray-500" />
            </div>
            <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-lg font-bold ${tones[tone]}`}>{value}</p>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------

const ProductList = () => {
    const { products, currency, axios, fetchProducts } = useAppContext()
    const [searchParams] = useSearchParams()
    const [editProduct, setEditProduct] = useState(null)

    // États pour la gestion des variantes (alignés avec AddProduct)
    const [productMode, setProductMode] = useState('simple') // 'simple' | 'multi-sizes' | 'variants'

    // Type de libellé pour le mode multi-tailles
    const [labelType, setLabelType] = useState('size')

    // États pour le mode multi-sizes
    const [sizesList, setSizesList] = useState([])
    const [sizeInput, setSizeInput] = useState('')
    const [stockInput, setStockInput] = useState('')
    const [sizePriceInput, setSizePriceInput] = useState('')
    const [sizeOfferPriceInput, setSizeOfferPriceInput] = useState('')
    const [editingSizeIndex, setEditingSizeIndex] = useState(null)
    const [openSizesPanel, setOpenSizesPanel] = useState(true)

    // États pour le mode variants (couleurs + tailles)
    const [colors, setColors] = useState([])
    const [colorInput, setColorInput] = useState('')
    const [colorCodeInput, setColorCodeInput] = useState('#000000')
    const [startImageIndexInput, setStartImageIndexInput] = useState(0)
    const [editingColorIndex, setEditingColorIndex] = useState(null)
    const [openColorIndex, setOpenColorIndex] = useState(null)
    const [showColorForm, setShowColorForm] = useState(false)

    // États pour les tailles dans les couleurs
    const [variantSizeInput, setVariantSizeInput] = useState('')
    const [variantStockInput, setVariantStockInput] = useState('')
    const [variantPriceInput, setVariantPriceInput] = useState('')
    const [variantOfferPriceInput, setVariantOfferPriceInput] = useState('')
    const [editingSizeIndexInColor, setEditingSizeIndexInColor] = useState(null)
    const [editingColorForSize, setEditingColorForSize] = useState(null)

    // États existants
    const [categoriesList, setCategoriesList] = useState([])
    const [selectedCategories, setSelectedCategories] = useState([])

    const [searchTerm, setSearchTerm] = useState('')
    const [stockFilter, setStockFilter] = useState('all')
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [sortBy, setSortBy] = useState('name')
    const [sortOrder, setSortOrder] = useState('asc')

    const [newImages, setNewImages] = useState([])
    const [uploadingImages, setUploadingImages] = useState(false)
    const [showImageUpload, setShowImageUpload] = useState(false)

    const [selectedIds, setSelectedIds] = useState([])
    const [deletingMultiple, setDeletingMultiple] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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

    useEffect(() => {
        const categoryParam = searchParams.get('category');
        if (categoryParam) {
            setSelectedCategoryFilter(categoryParam);
        }
    }, []);

    // ============ FONCTIONS DE CONVERSION (alignées avec AddProduct) ============

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

    const convertVariantsToSizes = (variants) => {
        return variants.map(v => ({
            size: v.size,
            stock: v.stock,
            price: v.price,
            offerPrice: v.offerPrice
        }));
    };

    const convertVariantsToColors = (variants) => {
        const colorMap = {};
        variants.forEach(v => {
            const colorKey = v.color || 'Sans couleur';
            if (!colorMap[colorKey]) {
                colorMap[colorKey] = {
                    color: colorKey,
                    colorCode: v.colorCode || '#000000',
                    startImageIndex: v.startImageIndex || 0,
                    sizes: []
                };
            }
            colorMap[colorKey].sizes.push({
                size: v.size,
                stock: v.stock,
                price: v.price,
                offerPrice: v.offerPrice
            });
        });
        return Object.values(colorMap);
    };

    const detectProductMode = (variants) => {
        if (!variants || variants.length === 0) return 'simple';
        const hasColors = variants.some(v => v.color !== null && v.color !== '');
        const hasSizes = variants.some(v => v.size !== null && v.size !== '');

        if (hasColors) return 'variants';
        if (hasSizes) return 'multi-sizes';
        return 'simple';
    };

    // ============ FONCTIONS DE GESTION DES TAILLES (alignées avec AddProduct) ============

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
            setEditingSizeIndex(null);
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

    // ============ FONCTIONS DE GESTION DES COULEURS (alignées avec AddProduct) ============

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

    const handleCategoryToggle = (categorySlug) => {
        if (selectedCategories.includes(categorySlug)) {
            setSelectedCategories(selectedCategories.filter(c => c !== categorySlug));
        } else {
            setSelectedCategories([...selectedCategories, categorySlug]);
        }
    };

    // ============ FILTRES ET PAGINATION (inchangés) ============

    const filteredProducts = useMemo(() => {
        let filtered = [...products]

        if (searchTerm) {
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        if (selectedCategoryFilter !== 'all') {
            filtered = filtered.filter(p =>
                p.categories?.includes(selectedCategoryFilter)
            )
        }

        if (stockFilter === 'inStock') {
            filtered = filtered.filter(p => {
                if (p.variants?.length > 0) return p.variants.some(v => v.stock > 0)
                return p.stock > 0
            })
        } else if (stockFilter === 'outOfStock') {
            filtered = filtered.filter(p => {
                if (p.variants?.length > 0) return p.variants.every(v => v.stock === 0)
                return p.stock === 0
            })
        } else if (stockFilter === 'lowStock') {
            filtered = filtered.filter(p => {
                if (p.variants?.length > 0) return p.variants.some(v => v.stock > 0 && v.stock <= 5)
                return p.stock > 0 && p.stock <= 5
            })
        } else if (stockFilter === 'onSale') {
            filtered = filtered.filter(p => p.offerPrice && p.offerPrice < p.price)
        }

        filtered.sort((a, b) => {
            let aVal, bVal
            switch (sortBy) {
                case 'name':
                    aVal = a.name
                    bVal = b.name
                    break
                case 'price':
                    aVal = a.offerPrice || a.price
                    bVal = b.offerPrice || b.price
                    break
                case 'stock':
                    if (a.variants?.length > 0) {
                        aVal = a.variants.reduce((sum, v) => sum + v.stock, 0)
                        bVal = b.variants.reduce((sum, v) => sum + v.stock, 0)
                    } else {
                        aVal = a.stock || 0
                        bVal = b.stock || 0
                    }
                    break
                case 'date':
                    aVal = new Date(a.createdAt)
                    bVal = new Date(b.createdAt)
                    break
                default:
                    aVal = a.name
                    bVal = b.name
            }
            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1
            } else {
                return aVal < bVal ? 1 : -1
            }
        })

        return filtered
    }, [products, searchTerm, stockFilter, selectedCategoryFilter, sortBy, sortOrder])

    const totalProducts = filteredProducts.length
    const totalPages = Math.ceil(totalProducts / itemsPerPage)
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    useEffect(() => {
        setCurrentPage(1)
        setSelectedIds([])
    }, [searchTerm, stockFilter, selectedCategoryFilter, sortBy, sortOrder])

    const stats = {
        total: products.length,
        inStock: products.filter(p => {
            if (p.variants?.length > 0) return p.variants.some(v => v.stock > 0)
            return p.stock > 0
        }).length,
        outOfStock: products.filter(p => {
            if (p.variants?.length > 0) return p.variants.every(v => v.stock === 0)
            return p.stock === 0
        }).length,
        lowStock: products.filter(p => {
            if (p.variants?.length > 0) return p.variants.some(v => v.stock > 0 && v.stock <= 5)
            return p.stock > 0 && p.stock <= 5
        }).length,
        onSale: products.filter(p => p.offerPrice && p.offerPrice < p.price).length
    }

    const allPageSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.includes(p._id))
    const somePageSelected = paginatedProducts.some(p => selectedIds.includes(p._id))

    const toggleSelectAll = () => {
        if (allPageSelected) {
            setSelectedIds(selectedIds.filter(id => !paginatedProducts.find(p => p._id === id)))
        } else {
            const newIds = paginatedProducts.map(p => p._id).filter(id => !selectedIds.includes(id))
            setSelectedIds([...selectedIds, ...newIds])
        }
    }

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleDeleteSelected = async () => {
        setDeletingMultiple(true)
        try {
            const results = await Promise.allSettled(
                selectedIds.map(id => axios.post('/api/product/delete', { id }))
            )
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.data?.success).length
            const failed = results.length - succeeded
            await fetchProducts()
            setSelectedIds([])
            setShowDeleteConfirm(false)
            if (succeeded > 0) toast.success(`${succeeded} produit(s) supprimé(s)`)
            if (failed > 0) toast.error(`${failed} suppression(s) échouée(s)`)
        } catch (error) {
            toast.error(error.message)
        } finally {
            setDeletingMultiple(false)
        }
    }

    const toggleStock = async (id, inStock) => {
        try {
            const { data } = await axios.post('/api/product/stock', { id, inStock });
            if (data.success) {
                await fetchProducts();
                toast.success(data.message)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // ============ HANDLE EDIT ============
    const handleEdit = (product) => {
        const variants = product.variants || [];
        const mode = detectProductMode(variants);

        setProductMode(mode);
        setLabelType(product.labelType || 'size');
        setEditProduct({
            ...product,
            description: Array.isArray(product.description)
                ? product.description.join('\n')
                : (product.description || ''),
            variants: variants,
            categories: product.categories || [],
            size: product.size || null,
            stock: product.stock || 0
        });
        setSelectedCategories(product.categories || []);

        // Réinitialiser les états
        setSizesList([]);
        setColors([]);
        setColorInput('');
        setColorCodeInput('#000000');
        setSizeInput('');
        setStockInput('');
        setVariantSizeInput('');
        setVariantStockInput('');
        setVariantPriceInput('');
        setVariantOfferPriceInput('');
        setStartImageIndexInput(0);
        setEditingSizeIndex(null);
        setEditingColorIndex(null);
        setEditingSizeIndexInColor(null);
        setEditingColorForSize(null);
        setOpenColorIndex(null);
        setShowColorForm(false);
        setNewImages([]);
        setShowImageUpload(false);

        // Initialiser selon le mode
        if (mode === 'multi-sizes') {
            setSizesList(convertVariantsToSizes(variants));
        } else if (mode === 'variants') {
            setColors(convertVariantsToColors(variants));
        }
    };

    // ============ SUPPRESSION D'UNE IMAGE EXISTANTE ============
    const handleRemoveExistingImage = (idx) => {
        setEditProduct(prev => ({
            ...prev,
            image: prev.image.filter((_, i) => i !== idx)
        }));
    };

    // ============ HANDLE UPDATE (aligné avec AddProduct) ============
    const handleUpdate = async () => {
        try {
            let productData = {
                id: editProduct._id,
                name: editProduct.name,
                description: editProduct.description,
                categories: selectedCategories,
                price: editProduct.price ? Number(editProduct.price) : 0,
                offerPrice: editProduct.offerPrice ? Number(editProduct.offerPrice) : 0,
                labelType: labelType,
                image: editProduct.image || [],
            };

            // Logique alignée avec AddProduct
            if (productMode === 'simple') {
                productData.variants = [];
                productData.stock = editProduct.stock ? Number(editProduct.stock) : 0;
                productData.size = editProduct.size || null;
            } else if (productMode === 'multi-sizes') {
                if (sizesList.length === 0) {
                    toast.error('Ajoutez au moins une taille');
                    return;
                }
                productData.variants = convertSizesToVariants();
                productData.stock = 0;
                productData.size = null;
            } else if (productMode === 'variants') {
                if (colors.length === 0) {
                    toast.error('Ajoutez au moins une couleur');
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
                productData.variants = convertVariantsToApi();
                productData.stock = 0;
                productData.size = null;
            }

            const { data } = await axios.post('/api/product/update', productData);

            if (data.success) {
                toast.success(data.message);
                await fetchProducts();
                setEditProduct(null);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error('Erreur :', error);
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce produit ?')) return
        try {
            const { data } = await axios.post('/api/product/delete', { id })
            if (data.success) {
                toast.success(data.message)
                await fetchProducts()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleAddImages = async () => {
        if (newImages.length === 0) {
            toast.error("Sélectionnez au moins une image")
            return
        }

        setUploadingImages(true)
        const formData = new FormData()
        formData.append('productId', editProduct._id)
        for (let i = 0; i < newImages.length; i++) {
            formData.append('images', newImages[i])
        }

        try {
            const { data } = await axios.post('/api/product/add-images', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            if (data.success) {
                toast.success(data.message)
                setNewImages([])
                setShowImageUpload(false)
                await fetchProducts()
                setEditProduct(data.product)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setUploadingImages(false)
        }
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 md:p-6 max-w-7xl mx-auto">

                {/* En-tête */}
                <div className="mb-5">
                    <h1 className="text-xl font-semibold text-gray-900">Liste des produits</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Gérez tous vos produits</p>
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                    <StatCard icon={Package} label="Total" value={stats.total} />
                    <StatCard icon={CheckCircle2} label="En stock" value={stats.inStock} tone="green" />
                    <StatCard icon={XCircle} label="Rupture" value={stats.outOfStock} tone="red" />
                    <StatCard icon={AlertTriangle} label="Stock faible" value={stats.lowStock} tone="orange" />
                    <StatCard icon={Tag} label="En promo" value={stats.onSale} tone="red" />
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher un produit…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-gray-400 outline-none text-sm"
                            />
                        </div>

                        <select
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white"
                        >
                            <option value="all">Toutes les catégories</option>
                            {categoriesList.map(cat => (
                                <option key={cat._id} value={cat.slug}>{cat.name}</option>
                            ))}
                        </select>

                        <select
                            value={stockFilter}
                            onChange={(e) => setStockFilter(e.target.value)}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white"
                        >
                            <option value="all">Tous les stocks</option>
                            <option value="inStock">En stock</option>
                            <option value="outOfStock">Rupture</option>
                            <option value="lowStock">Stock faible (≤5)</option>
                            <option value="onSale">En promotion</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none bg-white"
                        >
                            <option value="name">Trier par nom</option>
                            <option value="price">Trier par prix</option>
                            <option value="stock">Trier par stock</option>
                            <option value="date">Trier par date</option>
                        </select>

                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition flex items-center gap-1.5 text-gray-600"
                        >
                            {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                            {sortOrder === 'asc' ? 'Croissant' : 'Décroissant'}
                        </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-gray-400">{totalProducts} produit(s) trouvé(s)</span>

                        {selectedIds.length > 0 && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="inline-flex items-center gap-2 px-3.5 py-2 bg-red-500 text-white text-xs font-medium rounded-xl hover:bg-red-600 transition"
                            >
                                <Trash2 size={13} />
                                Supprimer {selectedIds.length} produit(s)
                            </button>
                        )}
                    </div>
                </div>

                {/* Tableau des produits */}
                {products.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                        <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" strokeWidth={1.5} />
                        <p className="text-gray-400 text-sm">Aucun produit trouvé</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-4 py-3.5 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={allPageSelected}
                                                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 accent-gray-900 cursor-pointer"
                                                />
                                            </th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Produit</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Catégorie(s)</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Prix</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Taille</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stock</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Variantes</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">En vente</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedProducts.map((product) => (
                                            <tr
                                                key={product._id}
                                                className={`hover:bg-gray-50 transition ${selectedIds.includes(product._id) ? 'bg-gray-50' : ''}`}
                                            >
                                                <td className="px-4 py-3.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(product._id)}
                                                        onChange={() => toggleSelectOne(product._id)}
                                                        className="w-4 h-4 accent-gray-900 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-11 h-11 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                                            <img src={product.image?.[0]} alt={product.name} className="w-full h-full object-cover" />
                                                        </div>
                                                        <span className="font-medium text-sm text-gray-900">{product.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {product.categories?.length > 0 ? (
                                                            product.categories.map((cat, idx) => (
                                                                <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                    {cat}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-300 text-sm">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-sm font-medium text-gray-900">
                                                    {product.offerPrice || product.price} {currency}
                                                    {product.offerPrice && product.offerPrice < product.price && (
                                                        <span className="ml-1 text-xs text-gray-400 line-through">
                                                            {product.price}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-sm">
                                                    {product.variants?.length === 0 ? (
                                                        <span className="text-gray-700">{product.size || '—'}</span>
                                                    ) : (
                                                        <span className="text-gray-300">via variantes</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-sm">
                                                    {product.variants?.length === 0 ? (
                                                        <span className={`font-medium ${
                                                            product.stock === 0 ? 'text-red-500' :
                                                            product.stock <= 5 ? 'text-orange-500' :
                                                            'text-green-600'
                                                        }`}>
                                                            {product.stock === 0 ? 'Épuisé' : `${product.stock} en stock`}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">via variantes</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {product.variants?.length > 0 ? (
                                                        <div className="space-y-1 max-h-24 overflow-y-auto">
                                                            {product.variants.slice(0, 3).map((v, i) => (
                                                                <div key={i} className="flex items-center gap-2 text-xs">
                                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: v.colorCode || '#000' }}></span>
                                                                    <span className="font-medium text-gray-700">{v.color}</span>
                                                                    {v.size && <span className="text-gray-400">/{v.size}</span>}
                                                                    <span className={`font-medium ${
                                                                        v.stock === 0 ? 'text-red-500' :
                                                                        v.stock <= 5 ? 'text-orange-500' :
                                                                        'text-green-600'
                                                                    }`}>
                                                                        : {v.stock}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {product.variants.length > 3 && (
                                                                <span className="text-xs text-gray-400">+{product.variants.length - 3}</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 text-sm">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            onClick={() => toggleStock(product._id, !product.inStock)}
                                                            checked={product.inStock}
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            readOnly
                                                        />
                                                        <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-gray-900 transition-colors duration-200"></div>
                                                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-5"></div>
                                                    </label>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            onClick={() => handleEdit(product)}
                                                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                                                        >
                                                            <Pencil size={12} />
                                                            Modifier
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(product._id)}
                                                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                                                        >
                                                            <Trash2 size={12} />
                                                            Supprimer
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-between items-center mt-5">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-400">Lignes par page :</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-gray-400 outline-none"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>

                                <div className="flex gap-1.5">
                                    <IconButton onClick={() => setCurrentPage(1)} className={currentPage === 1 ? 'opacity-30 pointer-events-none' : ''}>
                                        <ChevronsLeft size={15} />
                                    </IconButton>
                                    <IconButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={currentPage === 1 ? 'opacity-30 pointer-events-none' : ''}>
                                        <ChevronLeft size={15} />
                                    </IconButton>
                                    <span className="px-3 py-1.5 text-sm text-gray-600">
                                        Page {currentPage} / {totalPages}
                                    </span>
                                    <IconButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={currentPage === totalPages ? 'opacity-30 pointer-events-none' : ''}>
                                        <ChevronRight size={15} />
                                    </IconButton>
                                    <IconButton onClick={() => setCurrentPage(totalPages)} className={currentPage === totalPages ? 'opacity-30 pointer-events-none' : ''}>
                                        <ChevronsRight size={15} />
                                    </IconButton>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal confirmation suppression multiple */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                                <Trash2 size={18} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Confirmer la suppression</h3>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    {selectedIds.length} produit(s) seront définitivement supprimés.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deletingMultiple}
                                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={deletingMultiple}
                                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deletingMultiple ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        Suppression…
                                    </>
                                ) : 'Supprimer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal édition produit */}
            {editProduct && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditProduct(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                            <h3 className="text-base font-semibold text-gray-900">Modifier le produit</h3>
                            <IconButton onClick={() => setEditProduct(null)}>
                                <X size={17} />
                            </IconButton>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">

                            {/* Images */}
                            <Section icon={ImagePlus} title={`Images (${editProduct.image?.length || 0})`}>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {editProduct.image?.map((img, idx) => (
                                        <div key={idx} className="relative">
                                            <img src={img} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveExistingImage(idx)}
                                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-red-600"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {!showImageUpload ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowImageUpload(true)}
                                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                                    >
                                        <Plus size={13} /> Ajouter des images
                                    </button>
                                ) : (
                                    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => setNewImages([...newImages, ...Array.from(e.target.files)])}
                                            className="w-full text-xs"
                                        />
                                        {newImages.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {newImages.map((file, idx) => (
                                                    <div key={idx} className="relative">
                                                        <img src={URL.createObjectURL(file)} alt="" className="w-12 h-12 object-cover rounded-lg" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewImages(newImages.filter((_, i) => i !== idx))}
                                                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-red-600"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleAddImages}
                                                disabled={uploadingImages}
                                                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
                                            >
                                                {uploadingImages ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                                                {uploadingImages ? 'Envoi…' : `Envoyer (${newImages.length})`}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowImageUpload(false); setNewImages([]); }}
                                                className="text-xs px-3 py-1.5 text-gray-400 hover:text-gray-600"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Section>

                            {/* Informations générales */}
                            <Section icon={Box} title="Informations générales">
                                <div className="space-y-4">
                                    <Field label="Nom">
                                        <input
                                            value={editProduct.name}
                                            onChange={e => setEditProduct({ ...editProduct, name: e.target.value })}
                                            className={inputClass}
                                        />
                                    </Field>

                                    <Field label="Description">
                                        <ReactQuill
                                            value={editProduct.description}
                                            onChange={(value) => setEditProduct({ ...editProduct, description: value })}
                                            theme="snow"
                                            className="bg-white rounded-lg"
                                            style={{ minHeight: '150px' }}
                                        />
                                    </Field>

                                    <Field label="Catégories" hint={`${selectedCategories.length} catégorie(s) sélectionnée(s)`}>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-xl bg-gray-50">
                                            {categoriesList.map((cat) => (
                                                <button
                                                    key={cat._id}
                                                    type="button"
                                                    onClick={() => handleCategoryToggle(cat.slug)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                                        selectedCategories.includes(cat.slug)
                                                            ? 'bg-gray-900 text-white'
                                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {cat.name}
                                                </button>
                                            ))}
                                        </div>
                                    </Field>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Prix original">
                                            <input
                                                type="number"
                                                value={editProduct.price}
                                                onChange={e => setEditProduct({ ...editProduct, price: e.target.value })}
                                                className={inputClass}
                                            />
                                        </Field>
                                        <Field label="Prix promo">
                                            <input
                                                type="number"
                                                value={editProduct.offerPrice}
                                                onChange={e => setEditProduct({ ...editProduct, offerPrice: e.target.value })}
                                                className={inputClass}
                                            />
                                        </Field>
                                    </div>
                                </div>
                            </Section>

                            {/* Stock & variantes */}
                            <Section icon={Ruler} title="Stock & variantes">
                                <SegmentedControl
                                    value={productMode}
                                    options={[
                                        {
                                            value: 'simple', label: 'Simple', icon: Box,
                                            onClick: () => {
                                                setProductMode('simple');
                                                setSizesList([]);
                                                setColors([]);
                                                setEditProduct({ ...editProduct, variants: [], size: editProduct.size || null, stock: editProduct.stock || 0 });
                                            }
                                        },
                                        {
                                            value: 'multi-sizes', label: 'Tailles', icon: Ruler,
                                            onClick: () => {
                                                setProductMode('multi-sizes');
                                                setColors([]);
                                                if (editProduct.variants?.length > 0 && detectProductMode(editProduct.variants) === 'multi-sizes') {
                                                    setSizesList(convertVariantsToSizes(editProduct.variants));
                                                } else {
                                                    setSizesList([]);
                                                }
                                                setEditProduct({ ...editProduct, variants: [], size: null, stock: 0 });
                                            }
                                        },
                                        {
                                            value: 'variants', label: 'Couleurs + tailles', icon: Palette,
                                            onClick: () => {
                                                setProductMode('variants');
                                                setSizesList([]);
                                                if (editProduct.variants?.length > 0 && detectProductMode(editProduct.variants) === 'variants') {
                                                    setColors(convertVariantsToColors(editProduct.variants));
                                                } else {
                                                    setColors([]);
                                                }
                                                setEditProduct({ ...editProduct, variants: [], size: null, stock: 0 });
                                            }
                                        },
                                    ]}
                                />
                                <p className="text-xs text-gray-400 mt-2.5">
                                    {productMode === 'simple' && "Un seul prix, un seul stock, une taille optionnelle."}
                                    {productMode === 'multi-sizes' && "Plusieurs tailles, chacune avec son propre stock, sans couleurs."}
                                    {productMode === 'variants' && "Plusieurs couleurs (optionnel), chacune avec ses propres tailles et stocks."}
                                </p>

                                {/* Type de libellé (mode multi-tailles) */}
                                {productMode === 'multi-sizes' && (
                                    <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50 mt-4">
                                        <p className="text-sm font-medium text-gray-800 mb-1">Type de libellé</p>
                                        <p className="text-xs text-gray-400 mb-2.5">Détermine le texte affiché pour chaque option côté client.</p>
                                        <SegmentedControl
                                            value={labelType}
                                            options={[
                                                { value: 'size', label: 'Taille', icon: Ruler, onClick: () => setLabelType('size') },
                                                { value: 'variant', label: 'Variante', icon: Box, onClick: () => setLabelType('variant') },
                                            ]}
                                        />
                                        <p className="text-xs text-gray-400 mt-2">
                                            {labelType === 'size'
                                                ? 'Affiche « Taille » (S, M, L…)'
                                                : 'Affiche « Variante » (Pastèque, Orange, Aloe vera…)'}
                                        </p>
                                    </div>
                                )}

                                {/* Mode SIMPLE */}
                                {productMode === 'simple' && (
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <Field label="Taille (optionnel)" hint="Laissez vide si ce produit n'a pas de taille spécifique.">
                                            <input
                                                type="text"
                                                value={editProduct.size || ''}
                                                onChange={e => setEditProduct({ ...editProduct, size: e.target.value || null })}
                                                className={inputClass}
                                                placeholder="S, M, L, XL…"
                                            />
                                        </Field>
                                        <Field label="Stock">
                                            <input
                                                type="number"
                                                value={editProduct.stock || 0}
                                                onChange={e => setEditProduct({ ...editProduct, stock: parseInt(e.target.value) || 0 })}
                                                className={inputClass}
                                                min="0"
                                            />
                                        </Field>
                                    </div>
                                )}

                                {/* Mode MULTI-TAILLES */}
                                {productMode === 'multi-sizes' && (
                                    <div className="flex flex-col gap-4 mt-4">
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
                        </div>

                        <div className="p-5 border-t border-gray-100 flex gap-3 bg-gray-50 shrink-0">
                            <button
                                onClick={() => setEditProduct(null)}
                                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-100 transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:opacity-90 transition"
                            >
                                Sauvegarder
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ProductList