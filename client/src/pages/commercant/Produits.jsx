import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import { Package, Plus, Edit, Trash2, Loader2, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

const Produits = () => {
    const { axios } = useAppContext();
    const { boutique } = useOutletContext();

    const [loading, setLoading] = useState(true);
    const [produits, setProduits] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [categories, setCategories] = useState([]);

    const loadProduits = async () => {
        if (!boutique) { setLoading(false); return; }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', page);
            params.append('limit', 12);
            // ✅ Scope obligatoire : sans ça, la liste renvoyée est le
            // catalogue entier (tous les autres vendeurs inclus).
            params.append('boutiqueId', boutique._id);
            if (searchTerm) params.append('search', searchTerm);
            if (filterCategory) params.append('category', filterCategory);

            const { data } = await axios.get(`/api/product/list?${params.toString()}`);
            if (data.success) {
                setProduits(data.products);
                setTotalItems(data.pagination?.totalProducts ?? data.products.length);
                setTotalPages(data.pagination?.totalPages || 1);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadProduits(); }, [page, searchTerm, filterCategory, boutique]);

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
        if (!window.confirm(`Supprimer "${name}" ?`)) return;
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-display text-2xl font-semibold text-gray-900">Mes produits</h1>
                    <p className="text-sm text-gray-400">{totalItems} article{totalItems > 1 ? 's' : ''}</p>
                </div>
                <Link to="/commercant/produits/ajouter" className="flex items-center gap-2 bg-burgundy-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-burgundy-700 transition">
                    <Plus size={16} /> Ajouter un article
                </Link>
            </div>

            <div className="bg-white rounded-2xl border border-blush-200 p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text" placeholder="Rechercher un produit..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-3 py-2.5 border border-blush-200 rounded-xl text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500"
                        />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                        className="px-3 py-2.5 border border-blush-200 rounded-xl text-sm outline-none focus:border-burgundy-500 focus:ring-1 focus:ring-burgundy-500"
                    >
                        <option value="">Toutes les catégories</option>
                        {categories.map((cat) => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
                    </select>
                    {(searchTerm || filterCategory) && (
                        <button onClick={clearFilters} className="p-2.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-ivory-300 transition"><X size={18} /></button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-burgundy-600" size={32} /></div>
            ) : !boutique ? (
                <div className="bg-white rounded-2xl border border-blush-200 p-14 text-center">
                    <Package className="mx-auto text-blush-400 mb-3" size={40} />
                    <h3 className="text-base font-medium text-gray-800">Aucune boutique associée</h3>
                    <p className="text-sm text-gray-400 mt-1">Contactez l'administrateur pour qu'il vous en attribue une.</p>
                </div>
            ) : produits.length === 0 ? (
                <div className="bg-white rounded-2xl border border-blush-200 p-14 text-center">
                    <Package className="mx-auto text-blush-400 mb-3" size={40} />
                    <h3 className="text-base font-medium text-gray-800">Aucun produit</h3>
                    <p className="text-sm text-gray-400 mt-1">Commencez par ajouter votre premier article</p>
                    <Link to="/commercant/produits/ajouter" className="mt-4 inline-flex items-center gap-2 bg-burgundy-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-burgundy-700 transition">
                        <Plus size={16} /> Ajouter un article
                    </Link>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {produits.map((product) => (
                            <div key={product._id} className="bg-white rounded-2xl border border-blush-200 overflow-hidden hover:shadow-md transition group">
                                <div className="relative aspect-square bg-blush-100">
                                    {product.image?.[0] ? (
                                        <img src={getPresetImageUrl(product.image[0], "thumbnail")} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-blush-400"><Package size={30} /></div>
                                    )}
                                    {!product.inStock && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <span className="text-white font-semibold text-xs px-3 py-1 bg-burgundy-700 rounded-full">Rupture</span>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                        <Link to={`/commercant/produits/editer/${product._id}`} className="p-1.5 bg-white rounded-lg shadow-md hover:bg-blush-100 transition"><Edit size={14} className="text-gray-700" /></Link>
                                        <button onClick={() => handleDelete(product._id, product.name)} className="p-1.5 bg-white rounded-lg shadow-md hover:bg-red-50 transition"><Trash2 size={14} className="text-red-500" /></button>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <div>
                                            <span className="text-sm font-bold text-burgundy-700">{product.offerPrice?.toLocaleString()} FCFA</span>
                                            {product.price > product.offerPrice && <span className="text-xs text-gray-400 line-through ml-2">{product.price.toLocaleString()}</span>}
                                        </div>
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${product.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {product.inStock ? 'En stock' : 'Rupture'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 truncate">{product.categories?.join(', ') || 'Sans catégorie'}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                            <p className="text-sm text-gray-400">Page {page} sur {totalPages}</p>
                            <div className="flex gap-1">
                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-xl border border-blush-200 hover:bg-blush-100 disabled:opacity-50 transition"><ChevronLeft size={18} /></button>
                                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-xl border border-blush-200 hover:bg-blush-100 disabled:opacity-50 transition"><ChevronRight size={18} /></button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Produits;