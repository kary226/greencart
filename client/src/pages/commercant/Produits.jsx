import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import BoutiqueIndisponible from './BoutiqueIndisponible';
import StockModal from './StockModal';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import { Package, Loader2, Search, ChevronLeft, ChevronRight, X, Boxes } from 'lucide-react';

const Produits = () => {
    const { axios } = useAppContext();
    const { boutique, boutiqueEnCours, erreurBoutique, rechargerBoutique } = useOutletContext();

    const [loading, setLoading] = useState(true);
    const [produits, setProduits] = useState([]);
    // Article dont on ajuste les quantités (modale dédiée)
    const [produitStock, setProduitStock] = useState(null);
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

    const clearFilters = () => { setSearchTerm(''); setFilterCategory(''); setPage(1); };

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-display text-2xl font-semibold text-ink-900">Mes produits</h1>
                    <p className="text-sm text-ink-400">{totalItems} article{totalItems > 1 ? 's' : ''}</p>
                </div>
                <span
                    className="flex items-center gap-2 bg-ink-100 text-ink-500 px-4 py-2.5 rounded-xl text-sm font-medium"
                    title="Les produits et leurs prix sont gérés exclusivement par le Super Admin."
                >
                    Catalogue géré par le Super Admin
                </span>
            </div>

            {boutique && boutique.statut !== 'suspendue' && (
                <div className="mb-6 rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm">
                    <p className="font-medium text-ink-800">Produits gérés par le Super Admin</p>
                    <p className="text-ink-500 mt-0.5">
                        Vous pouvez consulter les articles de votre boutique et ajuster leurs quantités.
                        La création, le prix, les images et la suppression des produits sont gérés exclusivement par le Super Admin.
                    </p>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-ink-200 p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                            type="text" placeholder="Rechercher un produit..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-3 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500"
                        />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                        className="px-3 py-2.5 border border-ink-200 rounded-xl text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500"
                    >
                        <option value="">Toutes les catégories</option>
                        {categories.map((cat) => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
                    </select>
                    {(searchTerm || filterCategory) && (
                        <button onClick={clearFilters} className="p-2.5 text-ink-400 hover:text-ink-600 rounded-xl hover:bg-ink-100 transition"><X size={18} /></button>
                    )}
                </div>
            </div>

            {(loading || boutiqueEnCours) ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ramses-600" size={32} /></div>
            ) : !boutique ? (
                <BoutiqueIndisponible erreur={erreurBoutique} onRetry={rechargerBoutique} />
            ) : produits.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ink-200 p-14 text-center">
                    <Package className="mx-auto text-ink-300 mb-3" size={40} />
                    <h3 className="text-base font-medium text-ink-800">Aucun produit</h3>
                    <p className="text-sm text-ink-400 mt-1">Aucun article n'est actuellement affecté à votre boutique.</p>
                    <p className="text-xs text-ink-400 mt-2">Le Super Admin doit affecter les produits à votre boutique.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {produits.map((product) => (
                            <div key={product._id} className="bg-white rounded-2xl border border-ink-200 overflow-hidden hover:shadow-md transition group">
                                <div className="relative aspect-square bg-ink-50">
                                    {product.image?.[0] ? (
                                        <img src={getPresetImageUrl(product.image[0], "thumbnail")} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-ink-300"><Package size={30} /></div>
                                    )}
                                    {/* Repère visuel : cet article vient de la plateforme, son
                                        prix et ses photos ne sont pas modifiables ici. Mieux vaut
                                        le savoir avant d'ouvrir le formulaire. */}
                                    {product.origine === 'plateforme' && (
                                        <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide bg-ink-900/80 text-white px-1.5 py-0.5 rounded">
                                            Plateforme
                                        </span>
                                    )}
                                    {!product.inStock && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <span className="text-white font-semibold text-xs px-3 py-1 bg-ramses-700 rounded-full">Rupture</span>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={() => setProduitStock(product)} title="Gérer le stock" className="p-1.5 bg-white rounded-lg shadow-md hover:bg-ink-50 transition"><Boxes size={14} className="text-ink-700" /></button>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <p className="text-sm font-medium text-ink-800 truncate">{product.name}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <div>
                                            <span className="text-sm font-bold text-ramses-700">{product.offerPrice?.toLocaleString()} FCFA</span>
                                            {product.price > product.offerPrice && <span className="text-xs text-ink-400 line-through ml-2">{product.price.toLocaleString()}</span>}
                                        </div>
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${product.inStock ? 'bg-ok-50 text-ok-500' : 'bg-ramses-100 text-ramses-700'}`}>
                                            {product.inStock ? 'En stock' : 'Rupture'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-400 mt-1 truncate">{product.categories?.join(', ') || 'Sans catégorie'}</p>
                                    <button
                                        onClick={() => setProduitStock(product)}
                                        className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-ramses-700 bg-ink-50 hover:bg-ink-200 rounded-lg py-1.5 transition"
                                    >
                                        <Boxes size={13} />
                                        {(product.variants?.length || 0) > 0
                                            ? `${product.stock ?? 0} en stock · ${product.variants.length} variante${product.variants.length > 1 ? 's' : ''}`
                                            : `${product.stock ?? 0} en stock`}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                            <p className="text-sm text-ink-400">Page {page} sur {totalPages}</p>
                            <div className="flex gap-1">
                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-xl border border-ink-200 hover:bg-ink-50 disabled:opacity-50 transition"><ChevronLeft size={18} /></button>
                                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-xl border border-ink-200 hover:bg-ink-50 disabled:opacity-50 transition"><ChevronRight size={18} /></button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {produitStock && (
                <StockModal
                    product={produitStock}
                    onClose={() => setProduitStock(null)}
                    onSaved={loadProduits}
                />
            )}
        </div>
    );
};

export default Produits;