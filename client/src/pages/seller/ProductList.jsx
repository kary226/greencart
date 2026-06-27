import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import toast from 'react-hot-toast'
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const ProductList = () => {
    const { products, currency, axios, fetchProducts } = useAppContext()
    const [searchParams] = useSearchParams()
    const [editProduct, setEditProduct] = useState(null)
    const [colorInput, setColorInput] = useState('')
    const [colorCodeInput, setColorCodeInput] = useState('#000000')
    const [sizeInput, setSizeInput] = useState('')
    const [stockInput, setStockInput] = useState('')
    const [variantPriceInput, setVariantPriceInput] = useState('')
    const [variantOfferPriceInput, setVariantOfferPriceInput] = useState('')
    const [startImageIndexInput, setStartImageIndexInput] = useState(0)
    const [categoriesList, setCategoriesList] = useState([])
    const [selectedCategories, setSelectedCategories] = useState([])
    const [editingVariantIndex, setEditingVariantIndex] = useState(null)

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

    // --- Sélection multiple ---
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

    // --- Sélection ---
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

    const handleEdit = (product) => {
        setEditProduct({
            ...product,
            description: Array.isArray(product.description)
                ? product.description.join('\n')
                : (product.description || ''),
            variants: product.variants || [],
            categories: product.categories || [],
        })
        setSelectedCategories(product.categories || [])
        setColorInput('')
        setColorCodeInput('#000000')
        setSizeInput('')
        setStockInput('')
        setVariantPriceInput('')
        setVariantOfferPriceInput('')
        setStartImageIndexInput(0)
        setEditingVariantIndex(null)
        setNewImages([])
        setShowImageUpload(false)
    }

    const handleCategoryToggle = (categorySlug) => {
        if (selectedCategories.includes(categorySlug)) {
            setSelectedCategories(selectedCategories.filter(c => c !== categorySlug));
        } else {
            setSelectedCategories([...selectedCategories, categorySlug]);
        }
    };

    const handleUpdate = async () => {
        try {
            const { data } = await axios.post('/api/product/update', {
                id: editProduct._id,
                name: editProduct.name,
                description: editProduct.description,
                categories: selectedCategories,
                price: editProduct.price,
                offerPrice: editProduct.offerPrice,
                variants: editProduct.variants,
                stock: editProduct.stock,
                size: editProduct.size,
            })
            if (data.success) {
                toast.success(data.message)
                await fetchProducts()
                setEditProduct(null)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

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

    const addVariant = () => {
        if (!colorInput.trim()) {
            toast.error('Entrez une couleur')
            return
        }
        if (!stockInput || Number(stockInput) < 0) {
            toast.error('Entrez un stock valide')
            return
        }

        const newVariant = {
            color: colorInput.trim(),
            colorCode: colorCodeInput,
            size: sizeInput.trim().toUpperCase() || null,
            stock: Number(stockInput),
            price: variantPriceInput ? Number(variantPriceInput) : 0,
            offerPrice: variantOfferPriceInput ? Number(variantOfferPriceInput) : 0,
            startImageIndex: Number(startImageIndexInput)
        }

        if (editingVariantIndex !== null) {
            const updatedVariants = [...editProduct.variants]
            updatedVariants[editingVariantIndex] = newVariant
            setEditProduct({ ...editProduct, variants: updatedVariants })
            setEditingVariantIndex(null)
        } else {
            setEditProduct({ ...editProduct, variants: [...editProduct.variants, newVariant] })
        }

        setColorInput('')
        setColorCodeInput('#000000')
        setSizeInput('')
        setStockInput('')
        setVariantPriceInput('')
        setVariantOfferPriceInput('')
        setStartImageIndexInput(0)
    }

    const editVariant = (index) => {
        const variant = editProduct.variants[index]
        setColorInput(variant.color)
        setColorCodeInput(variant.colorCode || '#000000')
        setSizeInput(variant.size || '')
        setStockInput(variant.stock.toString())
        setVariantPriceInput(variant.price?.toString() || '')
        setVariantOfferPriceInput(variant.offerPrice?.toString() || '')
        setStartImageIndexInput(variant.startImageIndex || 0)
        setEditingVariantIndex(index)
    }

    const removeVariant = (index) => {
        const updatedVariants = editProduct.variants.filter((_, i) => i !== index)
        setEditProduct({ ...editProduct, variants: updatedVariants })
        if (editingVariantIndex === index) {
            setEditingVariantIndex(null)
            setColorInput('')
            setColorCodeInput('#000000')
            setSizeInput('')
            setStockInput('')
            setVariantPriceInput('')
            setVariantOfferPriceInput('')
            setStartImageIndexInput(0)
        }
    }

    const updateVariantStock = (index, stock) => {
        const updated = [...editProduct.variants]
        updated[index].stock = Number(stock)
        setEditProduct({ ...editProduct, variants: updated })
    }

    const updateVariantPrice = (index, price, isOfferPrice = false) => {
        const updated = [...editProduct.variants]
        if (isOfferPrice) {
            updated[index].offerPrice = Number(price)
        } else {
            updated[index].price = Number(price)
        }
        setEditProduct({ ...editProduct, variants: updated })
    }

    const updateVariantStartIndex = (index, startIndex) => {
        const updated = [...editProduct.variants]
        updated[index].startImageIndex = Number(startIndex)
        setEditProduct({ ...editProduct, variants: updated })
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Liste des produits</h1>
                    <p className="text-sm text-gray-500 mt-1">Gérez tous vos produits</p>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">En stock</p>
                            <p className="text-xl font-bold text-green-600">{stats.inStock}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Rupture</p>
                            <p className="text-xl font-bold text-red-500">{stats.outOfStock}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">Stock faible</p>
                            <p className="text-xl font-bold text-orange-500">{stats.lowStock}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500">En promo</p>
                            <p className="text-xl font-bold text-red-500">{stats.onSale}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Rechercher un produit..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm"
                                />
                            </div>
                        </div>

                        <select
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="all">Toutes les catégories</option>
                            {categoriesList.map(cat => (
                                <option key={cat._id} value={cat.slug}>{cat.name}</option>
                            ))}
                        </select>

                        <select
                            value={stockFilter}
                            onChange={(e) => setStockFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
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
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-500 outline-none bg-white"
                        >
                            <option value="name">Trier par nom</option>
                            <option value="price">Trier par prix</option>
                            <option value="stock">Trier par stock</option>
                            <option value="date">Trier par date</option>
                        </select>

                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition flex items-center gap-2"
                        >
                            {sortOrder === 'asc' ? '↑ Croissant' : '↓ Décroissant'}
                        </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-gray-500">{totalProducts} produit(s) trouvé(s)</span>

                        {selectedIds.length > 0 && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6l-1 14H6L5 6"/>
                                    <path d="M10 11v6M14 11v6"/>
                                    <path d="M9 6V4h6v2"/>
                                </svg>
                                Supprimer {selectedIds.length} produit(s)
                            </button>
                        )}
                    </div>
                </div>

                {products.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                        <p className="text-gray-500">Aucun produit trouvé</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-4 py-4 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={allPageSelected}
                                                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 accent-red-500 cursor-pointer"
                                                />
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Produit</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Catégorie(s)</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Taille</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Variantes</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">En vente</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedProducts.map((product) => (
                                            <tr
                                                key={product._id}
                                                className={`hover:bg-gray-50 transition ${selectedIds.includes(product._id) ? 'bg-red-50' : ''}`}
                                            >
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(product._id)}
                                                        onChange={() => toggleSelectOne(product._id)}
                                                        className="w-4 h-4 accent-red-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                                            <img src={product.image?.[0]} alt={product.name} className="w-full h-full object-cover" />
                                                        </div>
                                                        <span className="font-medium text-gray-900">{product.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {product.categories?.length > 0 ? (
                                                            product.categories.map((cat, idx) => (
                                                                <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                    {cat}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {product.offerPrice || product.price} {currency}
                                                    {product.offerPrice && product.offerPrice < product.price && (
                                                        <span className="ml-1 text-xs text-red-500 line-through">
                                                            {product.price}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {product.variants?.length === 0 ? (
                                                        <span className="text-gray-700">{product.size || '—'}</span>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">via variantes</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {product.variants?.length === 0 ? (
                                                        <span className={`font-medium ${
                                                            product.stock === 0 ? 'text-red-500' :
                                                            product.stock <= 5 ? 'text-orange-500' :
                                                            'text-green-600'
                                                        }`}>
                                                            {product.stock === 0 ? 'Épuisé' : `${product.stock} en stock`}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">via variantes</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {product.variants?.length > 0 ? (
                                                        <div className="space-y-1 max-h-24 overflow-y-auto">
                                                            {product.variants.slice(0, 3).map((v, i) => (
                                                                <div key={i} className="flex items-center gap-2 text-xs">
                                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.colorCode || '#000' }}></div>
                                                                    <span className="font-medium">{v.color}</span>
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
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            onClick={() => toggleStock(product._id, !product.inStock)}
                                                            checked={product.inStock}
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            readOnly
                                                        />
                                                        <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-red-500 transition-colors duration-200"></div>
                                                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-5"></div>
                                                    </label>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEdit(product)}
                                                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M17 3l4 4-7 7H10v-4l7-7z"/>
                                                                <path d="M4 20h16"/>
                                                            </svg>
                                                            Modifier
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(product._id)}
                                                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <line x1="18" y1="6" x2="6" y2="18"/>
                                                                <line x1="6" y1="6" x2="18" y2="18"/>
                                                            </svg>
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
                            <div className="flex justify-between items-center mt-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">Lignes par page :</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-red-500 outline-none"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
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

            {/* Modal confirmation suppression multiple */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6l-1 14H6L5 6"/>
                                    <path d="M10 11v6M14 11v6"/>
                                    <path d="M9 6V4h6v2"/>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Confirmer la suppression</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
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
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                        </svg>
                                        Suppression...
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
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
                            <h3 className="text-lg font-semibold text-gray-900">Modifier le produit</h3>
                            <button
                                onClick={() => setEditProduct(null)}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Images ({editProduct.image?.length || 0})
                                </label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {editProduct.image?.map((img, idx) => (
                                        <img key={idx} src={img} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                                    ))}
                                </div>

                                {!showImageUpload ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowImageUpload(true)}
                                        className="text-xs px-3 py-1.5 text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                                    >
                                        + Ajouter des images
                                    </button>
                                ) : (
                                    <div className="border border-purple-200 rounded-xl p-3 bg-purple-50 space-y-2">
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
                                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center"
                                                        >✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleAddImages}
                                                disabled={uploadingImages}
                                                className="text-xs px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:opacity-50"
                                            >
                                                {uploadingImages ? 'Upload...' : `Uploader (${newImages.length})`}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowImageUpload(false); setNewImages([]); }}
                                                className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                                <input
                                    value={editProduct.name}
                                    onChange={e => setEditProduct({ ...editProduct, name: e.target.value })}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <ReactQuill
                                    value={editProduct.description}
                                    onChange={(value) => setEditProduct({ ...editProduct, description: value })}
                                    theme="snow"
                                    className="bg-white rounded-lg"
                                    style={{ minHeight: '150px' }}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Catégories</label>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-xl bg-gray-50">
                                    {categoriesList.map((cat) => (
                                        <button
                                            key={cat._id}
                                            type="button"
                                            onClick={() => handleCategoryToggle(cat.slug)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                                selectedCategories.includes(cat.slug)
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    {selectedCategories.length} catégorie(s) sélectionnée(s)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix original</label>
                                    <input
                                        type="number"
                                        value={editProduct.price}
                                        onChange={e => setEditProduct({ ...editProduct, price: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix promo</label>
                                    <input
                                        type="number"
                                        value={editProduct.offerPrice}
                                        onChange={e => setEditProduct({ ...editProduct, offerPrice: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                    />
                                </div>
                            </div>

                            {editProduct.variants?.length === 0 && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Taille (optionnel)</label>
                                        <input
                                            type="text"
                                            value={editProduct.size || ''}
                                            onChange={e => setEditProduct({ ...editProduct, size: e.target.value || null })}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            placeholder="Ex: S, M, L, XL"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                                        <input
                                            type="number"
                                            value={editProduct.stock || 0}
                                            onChange={e => setEditProduct({ ...editProduct, stock: parseInt(e.target.value) || 0 })}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                            min="0"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Variantes par couleur</label>
                                <div className="bg-gray-50 p-3 rounded-xl space-y-3 mb-3">
                                    <div className="flex gap-2 items-center">
                                        <input
                                            value={colorInput}
                                            onChange={e => setColorInput(e.target.value)}
                                            type="text"
                                            placeholder="Couleur (ex: Rouge)"
                                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        />
                                        <input
                                            value={colorCodeInput}
                                            onChange={e => setColorCodeInput(e.target.value)}
                                            type="color"
                                            className="w-12 h-10 rounded-xl border border-gray-200 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={sizeInput}
                                            onChange={e => setSizeInput(e.target.value)}
                                            type="text"
                                            placeholder="Taille (optionnel)"
                                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        />
                                        <input
                                            value={stockInput}
                                            onChange={e => setStockInput(e.target.value)}
                                            type="number"
                                            placeholder="Stock"
                                            className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={variantPriceInput}
                                            onChange={e => setVariantPriceInput(e.target.value)}
                                            type="number"
                                            placeholder="Prix (optionnel)"
                                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        />
                                        <input
                                            value={variantOfferPriceInput}
                                            onChange={e => setVariantOfferPriceInput(e.target.value)}
                                            type="number"
                                            placeholder="Prix promo (optionnel)"
                                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">Position de départ (0 = première photo)</label>
                                        <input
                                            value={startImageIndexInput}
                                            onChange={e => setStartImageIndexInput(Number(e.target.value))}
                                            type="number"
                                            min="0"
                                            placeholder="Ex: 0 pour Rouge, 3 pour Bleu"
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addVariant}
                                        className="w-full py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                                    >
                                        {editingVariantIndex !== null ? 'Mettre à jour la variante' : '+ Ajouter cette couleur'}
                                    </button>
                                </div>

                                {editProduct.variants.length > 0 && (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Couleur</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Taille</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Prix</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Stock</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Départ</th>
                                                    <th className="px-3 py-2 w-20"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {editProduct.variants.map((v, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: v.colorCode || '#000' }}></div>
                                                                <span className="text-sm text-gray-600">{v.color}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-gray-600">{v.size || '—'}</td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex gap-1">
                                                                <input
                                                                    type="number"
                                                                    value={v.price || ''}
                                                                    onChange={e => updateVariantPrice(i, e.target.value, false)}
                                                                    placeholder="Prix"
                                                                    className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:border-red-500 outline-none"
                                                                />
                                                                <input
                                                                    type="number"
                                                                    value={v.offerPrice || ''}
                                                                    onChange={e => updateVariantPrice(i, e.target.value, true)}
                                                                    placeholder="Promo"
                                                                    className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:border-red-500 outline-none"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="number"
                                                                value={v.stock}
                                                                onChange={e => updateVariantStock(i, e.target.value)}
                                                                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:border-red-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="number"
                                                                value={v.startImageIndex || 0}
                                                                onChange={e => updateVariantStartIndex(i, e.target.value)}
                                                                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:border-red-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => editVariant(i)}
                                                                    className="text-blue-400 hover:text-blue-600 transition"
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M17 3l4 4-7 7H10v-4l7-7z"/>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeVariant(i)}
                                                                    className="text-red-400 hover:text-red-600 transition"
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 flex gap-3 bg-gray-50">
                            <button
                                onClick={() => setEditProduct(null)}
                                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-100 transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
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