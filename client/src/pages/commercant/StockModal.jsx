import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { Boxes, Loader2, Save, X } from 'lucide-react';

// Ajustement des quantités d'un article, sans passer par le formulaire
// produit complet.
//
// C'est le geste quotidien du commerçant (réassort, rupture), et c'est aussi
// le seul dont il a besoin sur un article créé par le vendeur puis attribué
// à sa boutique : il en règle les quantités sans risquer d'écraser le prix,
// les images ou les variantes saisis en amont.
const StockModal = ({ product, onClose, onSaved }) => {
    const { axios } = useAppContext();

    const aDesVariantes = (product.variants?.length || 0) > 0;

    const [quantites, setQuantites] = useState(() =>
        (product.variants || []).map((v) => String(v.stock ?? 0))
    );
    const [stockSimple, setStockSimple] = useState(String(product.stock ?? 0));
    // Retrait manuel de la vente : utile quand il reste du stock théorique
    // mais que l'article ne peut pas être expédié.
    const [enRupture, setEnRupture] = useState(!product.inStock);
    const [enregistrement, setEnregistrement] = useState(false);

    const total = useMemo(() => {
        if (aDesVariantes) {
            return quantites.reduce((somme, q) => somme + (Number(q) || 0), 0);
        }
        return Number(stockSimple) || 0;
    }, [aDesVariantes, quantites, stockSimple]);

    const majQuantite = (index, valeur) => {
        setQuantites((prev) => prev.map((q, i) => (i === index ? valeur : q)));
    };

    const enregistrer = async () => {
        setEnregistrement(true);
        try {
            const corps = { id: product._id, inStock: enRupture ? false : undefined };

            if (aDesVariantes) {
                corps.variants = product.variants.map((v, i) => ({
                    color: v.color,
                    size: v.size,
                    stock: Math.max(0, Number(quantites[i]) || 0),
                }));
            } else {
                corps.stock = Math.max(0, Number(stockSimple) || 0);
            }

            const { data } = await axios.post('/api/product/staff/stock', corps);
            if (data.success) {
                toast.success(data.message);
                onSaved?.();
                onClose();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setEnregistrement(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col">
                <div className="p-5 border-b border-ink-50 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-ink-900 flex items-center gap-2">
                            <Boxes size={18} className="text-ramses-600" /> Gérer le stock
                        </h3>
                        <p className="text-xs text-ink-400 mt-0.5 truncate">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 transition">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-4">
                    {aDesVariantes ? (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-ink-700">Quantité par variante</p>
                            {product.variants.map((v, i) => (
                                <div key={`${v.color ?? ''}-${v.size ?? ''}-${i}`} className="flex items-center gap-3">
                                    <span
                                        className="w-3 h-3 rounded-full shrink-0 border border-ink-200"
                                        style={{ backgroundColor: v.colorCode || '#000' }}
                                    />
                                    <span className="text-sm text-ink-700 flex-1 truncate">
                                        {v.color || '—'}{v.size ? ` / ${v.size}` : ''}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={quantites[i]}
                                        onChange={(e) => majQuantite(i, e.target.value)}
                                        className="w-24 px-3 py-2 rounded-xl border border-ink-200 text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-ink-700 mb-1">Quantité en stock</label>
                            <input
                                type="number"
                                min="0"
                                value={stockSimple}
                                onChange={(e) => setStockSimple(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-ink-200 text-sm outline-none focus:border-ramses-500 focus:ring-1 focus:ring-ramses-500"
                            />
                        </div>
                    )}

                    <div className="bg-ink-100 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                        <span className="text-ink-600">Total</span>
                        <span className="font-semibold text-ink-900">{total} article{total > 1 ? 's' : ''}</span>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={enRupture}
                            onChange={(e) => setEnRupture(e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded accent-ramses-600"
                        />
                        <span className="text-sm text-ink-700">
                            Retirer de la vente
                            <span className="block text-xs text-ink-400">
                                À cocher pour suspendre les commandes même s'il reste du stock.
                                Décoché, la disponibilité suit les quantités ci-dessus.
                            </span>
                        </span>
                    </label>
                </div>

                <div className="p-5 border-t border-ink-50 flex gap-2">
                    <button
                        onClick={enregistrer}
                        disabled={enregistrement}
                        className="flex-1 flex items-center justify-center gap-2 bg-ramses-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-ramses-700 transition disabled:opacity-50"
                    >
                        {enregistrement ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Enregistrer
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-ink-100 text-ink-600 hover:bg-ink-200 transition"
                    >
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StockModal;
