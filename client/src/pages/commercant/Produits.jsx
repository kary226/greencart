import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Package, Plus, Edit, Trash2, Loader2, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

const Produits = () => {
    const { axios } = useAppContext();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [produits, setProduits] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [categories, setCategories] = useState([]);

    const loadProduits = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', page);
            params.append('limit', 12);
            if (searchTerm) params.append('search', searchTerm);
            if (filterCategory) params.append('category', filterCategory);

            const { data } = await axios.get(`/api/product/list?${params.toString()}`);
            if (data.success) {
                setProduits(data.products);
                setTotalItems(data.pagination?.totalProducts || 0);
                setTotalPages(data.pagination?.totalPages || 1);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadProduits(); }, [page, searchTerm, filterCategory]);

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const { data } = await axios.get('/api/category/list');
                if (data.success) setCategories(data.categories || []);
            } catch (error) { console.error('Erreur chargement catégories:', error); }
        };
        loadCategories();
    }, [axios]);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Confirmer la suppression de "${name}" ?`)) return;
        try {
            const { data } = await axios.post('/api/product/staff/delete', { id });
            if (data.success) { toast.success('Produit supprimé'); loadProduits(); }
            else toast.error(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const clearFilters = () => { setSearchTerm(''); setFilterCategory(''); setPage(1); };

    return (
        <div className="min-h-screen bg-ivory-200">
            <div className="bg-burgundy-600 text-ivory-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Package size={24} />
                            <div><h1 className="text-lg font-bold">Mes produits</h1><p className="text-sm text-blush-300">{totalItems} produit{totalItems > 1 ? 's' : ''}</p></div>
                        </div>
                        <button onClick={() => navigate('/commercant/produits/ajouter')} className="flex items-center gap-2 bg-blush-200 text-burgundy-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blush-300 transition">
                            <Plus size={16} /> Ajouter
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Rechercher un produit..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} className="w-full pl-9 pr-3 py-2 border border-blush-300 rounded-lg text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500" />
                        </div>
                        <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }} className="px-3 py-2 border border-blush-300 rounded-lg text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500">
                            <option value="">Toutes les catégories</option>
                            {categories.map((cat) => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
                        </select>
                        {(searchTerm || filterCategory) && (
                            <button onClick={clearFilters} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"><X size={18} /></button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-burgundy-600" size={40} /></div>
                ) : produits.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-blush-300 p-12 text-center">
                        <Package className="mx-auto text-gray-400 mb-3" size={48} />
                        <h3 className="text-lg font-medium text-gray-800">Aucun produit</h3>
                        <p className="text-sm text-gray-500 mt-1">Commencez par ajouter votre premier produit</p>
                        <button onClick={() => navigate('/commercant/produits/ajouter')} className="mt-4 inline-flex items-center gap-2 bg-burgundy-600 text-ivory-200 px-6 py-2.5 rounded-lg font-medium hover:bg-burgundy-700 transition">
                            <Plus size={16} /> Ajouter un produit
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {produits.map((product) => (
                                <div key={product._id} className="bg-white rounded-xl shadow-sm border border-blush-300 overflow-hidden hover:shadow-md transition group">
                                    <div className="relative aspect-square bg-blush-200">
                                        {product.image?.[0] ? (
                                            <img src={product.image[0]} alt={product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400"><Package size={32} /></div>
                                        )}
                                        {!product.inStock && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <span className="text-white font-bold text-sm px-3 py-1 bg-red-600 rounded-full">Rupture</span>
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                            <button onClick={() => navigate(`/commercant/produits/editer/${product._id}`)} className="p-1.5 bg-white rounded-lg shadow-md hover:bg-blush-200 transition"><Edit size={14} className="text-gray-700" /></button>
                                            <button onClick={() => handleDelete(product._id, product.name)} className="p-1.5 bg-white rounded-lg shadow-md hover:bg-red-50 transition"><Trash2 size={14} className="text-red-500" /></button>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <div>
                                                <span className="text-sm font-bold text-burgundy-600">{product.offerPrice?.toLocaleString()} FCFA</span>
                                                {product.price > product.offerPrice && <span className="text-xs text-gray-400 line-through ml-2">{product.price.toLocaleString()} FCFA</span>}
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${product.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {product.inStock ? 'En stock' : 'Rupture'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">{product.categories?.join(', ') || 'Sans catégorie'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6">
                                <p className="text-sm text-gray-500">Page {page} sur {totalPages}</p>
                                <div className="flex gap-1">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-blush-300 hover:bg-blush-200 disabled:opacity-50 transition"><ChevronLeft size={18} /></button>
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-blush-300 hover:bg-blush-200 disabled:opacity-50 transition"><ChevronRight size={18} /></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Produits;