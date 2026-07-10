import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const VariantSelector = ({ product, onClose }) => {
    const { addToCartWithQuantity } = useAppContext();
    const [selectedColor, setSelectedColor] = useState(null);
    const [selectedSize, setSelectedSize] = useState(null);
    const [quantity, setQuantity] = useState(1);

    if (!product || !product.variants?.length) {
        return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
                <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <p>Ce produit n'a pas de variantes.</p>
                    <button 
                        onClick={() => {
                            addToCartWithQuantity(product._id, 1, null, null);
                            onClose();
                        }} 
                        className="mt-4 bg-primary text-white px-4 py-2 rounded"
                    >
                        Ajouter quand même
                    </button>
                    <button onClick={onClose} className="mt-2 ml-2 text-gray-500">Annuler</button>
                </div>
            </div>
        );
    }

    // Couleurs et tailles uniques disponibles
    const colors = [...new Set(product.variants.map(v => v.color).filter(Boolean))];
    const sizes = [...new Set(product.variants.map(v => v.size).filter(Boolean))];

    const hasColors = colors.length > 0;
    const hasSizes = sizes.length > 0;

    // ✅ Fonction pour obtenir le stock d'une taille spécifique
    const getStockForSize = (size) => {
        if (selectedColor) {
            const variant = product.variants.find(v => 
                v.color === selectedColor && v.size === size
            );
            return variant ? variant.stock : 0;
        }
        const variantsWithSize = product.variants.filter(v => v.size === size);
        return variantsWithSize.reduce((sum, v) => sum + v.stock, 0);
    };

    // Trouver le stock de la variante sélectionnée
    const getCurrentStock = () => {
        // Cas 1 : ni couleur ni taille
        if (!hasColors && !hasSizes) {
            return product.variants[0]?.stock || 0;
        }
        // Cas 2 : seulement des couleurs
        if (hasColors && !hasSizes) {
            const variant = product.variants.find(v => v.color === selectedColor);
            return variant ? variant.stock : 0;
        }
        // Cas 3 : seulement des tailles
        if (!hasColors && hasSizes) {
            const variant = product.variants.find(v => v.size === selectedSize);
            return variant ? variant.stock : 0;
        }
        // Cas 4 : couleurs ET tailles
        if (selectedColor && selectedSize) {
            const variant = product.variants.find(v => v.color === selectedColor && v.size === selectedSize);
            return variant ? variant.stock : 0;
        }
        return null;
    };

    // Vérifier si la sélection est complète
    const isSelectionComplete = () => {
        if (hasColors && !selectedColor) return false;
        if (hasSizes && !selectedSize) return false;
        return true;
    };

    const currentStock = getCurrentStock();
    const maxQuantity = currentStock || 0;
    const selectionComplete = isSelectionComplete();

    const handleConfirm = () => {
        if (hasColors && !selectedColor) {
            toast.error('Veuillez choisir une couleur');
            return;
        }
        if (hasSizes && !selectedSize) {
            toast.error('Veuillez choisir une taille');
            return;
        }
        if (maxQuantity === 0) {
            toast.error('Cette variante est épuisée');
            return;
        }
        if (quantity > maxQuantity) {
            toast.error(`Stock limité à ${maxQuantity} unités`);
            return;
        }
        
        addToCartWithQuantity(product._id, quantity, selectedColor, selectedSize);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">{product.name}</h3>

                {/* Couleurs */}
                {hasColors && (
                    <div className="mb-4">
                        <p className="text-sm font-medium mb-2">Couleur</p>
                        <div className="flex flex-wrap gap-2">
                            {colors.map(color => {
                                const hasStock = product.variants.some(v => v.color === color && v.stock > 0);
                                return (
                                    <button
                                        key={color}
                                        onClick={() => setSelectedColor(color)}
                                        disabled={!hasStock}
                                        className={`px-3 py-1 rounded-full border text-sm transition ${
                                            selectedColor === color
                                                ? 'border-primary bg-primary text-white'
                                                : !hasStock
                                                ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                                                : 'border-gray-300 hover:border-primary'
                                        }`}
                                    >
                                        {color}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ✅ TAILLES - Stock affiché uniquement dans le label quand sélectionné */}
                {hasSizes && (
                    <div className="mb-4">
                        <p className="text-sm font-medium mb-2">
                            Taille {selectedSize && <span>— {selectedSize}</span>}
                            {selectedSize && (
                                <span className="text-sm font-normal text-gray-500 ml-1">
                                    {(() => {
                                        const stock = getStockForSize(selectedSize);
                                        return stock > 0 ? `(${stock} disponible${stock > 1 ? 's' : ''})` : '(Rupture)';
                                    })()}
                                </span>
                            )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {sizes.map(size => {
                                const stock = getStockForSize(size);
                                const hasStock = stock > 0;
                                
                                return (
                                    <button
                                        key={size}
                                        onClick={() => setSelectedSize(size)}
                                        disabled={!hasStock}
                                        className={`px-3 py-1.5 rounded border text-sm transition ${
                                            selectedSize === size
                                                ? 'border-primary bg-primary text-white'
                                                : !hasStock
                                                ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                                                : 'border-gray-300 hover:border-primary'
                                        }`}
                                    >
                                        {size}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Stock */}
                {selectionComplete && currentStock !== null && (
                    <div className={`text-sm mb-3 ${currentStock === 0 ? 'text-red-500' : currentStock <= 5 ? 'text-orange-500' : 'text-green-600'}`}>
                        {currentStock === 0 ? '❌ Rupture de stock' : `✅ Stock : ${currentStock} disponible(s)`}
                    </div>
                )}

                {/* Message d'attente */}
                {!selectionComplete && (
                    <div className="text-sm text-gray-400 mb-3">
                        ⚠️ Veuillez sélectionner {hasColors && !selectedColor ? 'une couleur' : ''}
                        {hasColors && !selectedColor && hasSizes && !selectedSize ? ' et ' : ''}
                        {hasSizes && !selectedSize ? 'une taille' : ''}
                    </div>
                )}

                {/* Quantité */}
                {selectionComplete && maxQuantity > 0 && (
                    <div className="mb-4">
                        <p className="text-sm font-medium mb-2">Quantité</p>
                        <select
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="border border-gray-300 rounded px-3 py-2 w-full"
                        >
                            {Array.from({ length: Math.min(maxQuantity, 10) }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex gap-2 mt-4">
                    <button 
                        onClick={handleConfirm} 
                        disabled={!selectionComplete || maxQuantity === 0} 
                        className={`flex-1 py-2 rounded transition ${
                            !selectionComplete || maxQuantity === 0 
                                ? 'bg-gray-300 cursor-not-allowed' 
                                : 'bg-primary text-white hover:opacity-90'
                        }`}
                    >
                        Ajouter au panier
                    </button>
                    <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-50 transition">
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VariantSelector;