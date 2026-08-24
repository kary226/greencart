import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import toast from 'react-hot-toast';
import {
    Search, Pencil, Trash2, X, Plus, ImagePlus, Upload, ChevronDown,
    ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Loader2,
    Info, Box, Ruler, Palette, AlertTriangle, CheckCircle2, XCircle,
    Tag, ArrowUp, ArrowDown, Package, Link as LinkIcon, RefreshCw, Archive,
} from 'lucide-react';

const Products = () => {
    const { currency, axios, fetchProducts: refreshStorefrontProducts } = useAppContext();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState('all');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');

    const [categoriesList, setCategoriesList] = useState([]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/api/product/admin-list');
            if (data.success) {
                setProducts(data.products);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/category/list');
            if (data.success) setCategoriesList(data.categories);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        loadProducts();
        fetchCategories();
    }, []);

    const filteredProducts = useMemo(() => {
        let filtered = [...products];

        if (searchTerm) {
            const q = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q)
            );
        }

        if (selectedCategoryFilter !== 'all') {
            filtered = filtered.filter(p =>
                p.categories?.includes(selectedCategoryFilter)
            );
        }

        if (stockFilter === 'archived') {
            filtered = filtered.filter(p => p.isArchived);
        } else {
            filtered = filtered.filter(p => !p.isArchived);
            if (stockFilter === 'inStock') {
                filtered = filtered.filter(p => {
                    if (p.variants?.length > 0) return p.variants.some(v => v.stock > 0);
                    return p.stock > 0;
                });
            } else if (stockFilter === 'outOfStock') {
                filtered = filtered.filter(p => {
                    if (p.variants?.length > 0) return p.variants.every(v => v.stock === 0);
                    return p.stock === 0;
                });
            } else if (stockFilter === 'lowStock') {
                filtered = filtered.filter(p => {
                    if (p.variants?.length > 0) return p.variants.some(v => v.stock > 0 && v.stock <= 5);
                    return p.stock > 0 && p.stock <= 5;
                });
            } else if (stockFilter === 'onSale') {
                filtered = filtered.filter(p => p.offerPrice && p.offerPrice < p.price);
            }
        }

        filtered.sort((a, b) => {
            let aVal, bVal;
            switch (sortBy) {
                case 'name': aVal = a.name; bVal = b.name; break;
                case 'price': aVal = a.offerPrice || a.price; bVal = b.offerPrice || b.price; break;
                case 'stock':
                    if (a.variants?.length > 0) aVal = a.variants.reduce((sum, v) => sum + v.stock, 0);
                    else aVal = a.stock || 0;
                    if (b.variants?.length > 0) bVal = b.variants.reduce((sum, v) => sum + v.stock, 0);
                    else bVal = b.stock || 0;
                    break;
                case 'date': aVal = new Date(a.createdAt); bVal = new Date(b.createdAt); break;
                default: aVal = a.name; bVal = b.name;
            }
            if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
            return aVal < bVal ? 1 : -1;
        });

        return filtered;
    }, [products, searchTerm, stockFilter, selectedCategoryFilter, sortBy, sortOrder]);

    const totalProducts = filteredProducts.length;
    const totalPages = Math.ceil(totalProducts / itemsPerPage);
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, stockFilter, selectedCategoryFilter, sortBy, sortOrder]);

    const activeProducts = products.filter(p => !p.isArchived);
    const stats = {
        total: activeProducts.length,
        inStock: activeProducts.filter(p => {
            if (p.variants?.length > 0) return p.variants.some(v => v.stock > 0);
            return p.stock > 0;
        }).length,
        outOfStock: activeProducts.filter(p => {
            if (p.variants?.length > 0) return p.variants.every(v => v.stock === 0);
            return p.stock === 0;
        }).length,
        lowStock: activeProducts.filter(p => {
            if (p.variants?.length > 0) return p.variants.some(v => v.stock > 0 && v.stock <= 5);
            return p.stock > 0 && p.stock <= 5;
        }).length,
        onSale: activeProducts.filter(p => p.offerPrice && p.offerPrice < p.price).length,
        archived: products.filter(p => p.isArchived).length,
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer ce produit ?')) return;
        try {
            const { data } = await axios.post('/api/product/delete', { id });
            if (data.success) {
                toast.success(data.message);
                loadProducts();
                refreshStorefrontProducts();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleUnarchive = async (id) => {
        try {
            const { data } = await axios.post('/api/product/unarchive', { id });
            if (data.success) {
                toast.success(data.message);
                loadProducts();
                refreshStorefrontProducts();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const toggleStock = async (id, inStock) => {
        try {
            const { data } = await axios.post('/api/product/stock', { id, inStock });
            if (data.success) {
                toast.success(data.message);
                loadProducts();
                refreshStorefrontProducts();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const StatCard = ({ icon: Icon, label, value, tone = 'default' }) => {
        const tones = {
            default: 'text-gray-900',
            green: 'text-green-600',
            red: 'text-red-500',
            orange: 'text-orange-500',
            amber: 'text-amber-600',
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

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
                {/* En-tête */}
                <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">Gestion des produits</h1>
                        <p className="text-sm text-gray-400 mt-0.5">Gérez tout le catalogue</p>
                    </div>
                    <Link to="/admin/products/add" className="inline-flex items-center gap-2 px-3.5 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">
                        <Plus size={15} />
                        Ajouter un produit
                    </Link>
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                    <StatCard icon={Package} label="Total" value={stats.total} />
                    <StatCard icon={CheckCircle2} label="En stock" value={stats.inStock} tone="green" />
                    <StatCard icon={XCircle} label="Rupture" value={stats.outOfStock} tone="red" />
                    <StatCard icon={Archive} label="Archivés" value={stats.archived} tone="amber" />
                    <StatCard icon={AlertTriangle} label="Stock faible" value={stats.lowStock} tone="orange" />
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par nom ou code article…"
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
                            <option value="archived">Archivés</option>
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
                    </div>
                </div>

                {/* Tableau */}
                {loading ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                        <RefreshCw className="w-8 h-8 mx-auto text-gray-300 mb-3 animate-spin" strokeWidth={1.5} />
                        <p className="text-gray-400 text-sm">Chargement des produits…</p>
                    </div>
                ) : products.length === 0 ? (
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
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Produit</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Catégorie(s)</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Prix</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stock</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Variantes</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">En vente</th>
                                            <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedProducts.map((product) => (
                                            <tr key={product._id} className="hover:bg-gray-50 transition">
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-11 h-11 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                                            <img src={getPresetImageUrl(product.image?.[0], "thumbnail")} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="flex items-center gap-1.5 font-medium text-sm text-gray-900">
                                                                {product.name}
                                                                {product.isArchived && (
                                                                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Archivé</span>
                                                                )}
                                                            </span>
                                                            {product.sku && (
                                                                <span className="block font-mono text-[11px] tracking-wide text-gray-400">{product.sku}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {product.categories?.length > 0 ? (
                                                            product.categories.map((cat, idx) => (
                                                                <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{cat}</span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-300 text-sm">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-sm font-medium text-gray-900">
                                                    {product.offerPrice || product.price} {currency}
                                                    {product.offerPrice && product.offerPrice < product.price && (
                                                        <span className="ml-1 text-xs text-gray-400 line-through">{product.price}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-sm">
                                                    {product.variants?.length === 0 ? (
                                                        <span className={`font-medium ${product.stock === 0 ? 'text-red-500' : product.stock <= 5 ? 'text-orange-500' : 'text-green-600'}`}>
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
                                                                    <span className={`font-medium ${v.stock === 0 ? 'text-red-500' : v.stock <= 5 ? 'text-orange-500' : 'text-green-600'}`}>: {v.stock}</span>
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
                                                        <Link to={`/admin/products/edit/${product._id}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                                                            <Pencil size={12} /> Modifier
                                                        </Link>
                                                        {product.isArchived ? (
                                                            <button onClick={() => handleUnarchive(product._id)} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition">
                                                                <RefreshCw size={12} /> Restaurer
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handleDelete(product._id)} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
                                                                <Trash2 size={12} /> Supprimer
                                                            </button>
                                                        )}
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
                                    <button onClick={() => setCurrentPage(1)} className={`p-2 rounded-lg hover:bg-gray-100 transition ${currentPage === 1 ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <ChevronsLeft size={15} />
                                    </button>
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={`p-2 rounded-lg hover:bg-gray-100 transition ${currentPage === 1 ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <ChevronLeft size={15} />
                                    </button>
                                    <span className="px-3 py-1.5 text-sm text-gray-600">Page {currentPage} / {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={`p-2 rounded-lg hover:bg-gray-100 transition ${currentPage === totalPages ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <ChevronRight size={15} />
                                    </button>
                                    <button onClick={() => setCurrentPage(totalPages)} className={`p-2 rounded-lg hover:bg-gray-100 transition ${currentPage === totalPages ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <ChevronsRight size={15} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Products;