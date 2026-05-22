import React, { useState } from "react";
import { assets } from "../assets/assets";
import { useAppContext } from "../context/AppContext";
import VariantSelector from "./VariantSelector";

const ProductCard = ({ product }) => {

    const {
        currency,
        addToCartWithQuantity,
        removeFromCart,
        cartItems,
        navigate,
        addToWishlist,
        removeFromWishlist,
        isInWishlist
    } = useAppContext();

    const [showVariantSelector, setShowVariantSelector] =
        useState(false);

    const getTotalStock = () => {
        if (!product.variants?.length) return null;
        return product.variants.reduce((acc, variant) => acc + variant.stock, 0);
    };

    const totalStock = getTotalStock();

    const isInCart = () => {
        for (const key in cartItems) {
            if (key.startsWith(product._id)) return true;
        }
        return false;
    };

    const getTotalQty = () => {
        let total = 0;
        for (const key in cartItems) {
            if (key.startsWith(product._id)) total += cartItems[key];
        }
        return total;
    };

    const inCart = isInCart();
    const currentQty = getTotalQty();
    const isOutOfStock = totalStock !== null && totalStock === 0;
    const isMaxReached = totalStock !== null && currentQty >= totalStock;

    const handleWishlistClick = (e) => {
        e.stopPropagation();
        if (isInWishlist(product._id)) {
            removeFromWishlist(product._id);
        } else {
            addToWishlist(product._id);
        }
    };

    return product && (
        <>
            <div
                onClick={() => {
                    navigate(`/products/${product.category.toLowerCase()}/${product._id}`);
                    scrollTo(0, 0);
                }}
                className="border border-gray-200 rounded-2xl bg-white overflow-hidden w-full hover:shadow-lg transition-all duration-300 cursor-pointer relative flex flex-col h-full"
            >
                {/* Bouton favori */}
                <button
                    onClick={handleWishlistClick}
                    className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-white transition"
                >
                    <svg 
                        className={`w-5 h-5 transition ${isInWishlist(product._id) ? 'text-red-500 fill-red-500' : 'text-gray-500 fill-none hover:text-red-400'}`} 
                        fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </button>

                {/* Image */}
                <div className="h-[200px] overflow-hidden bg-white flex items-center justify-center p-4">
                    <img
                        className="w-full h-full object-contain hover:scale-105 transition duration-300"
                        src={product.image[0]}
                        alt={product.name}
                    />
                </div>

                {/* Contenu */}
                <div className="p-4 flex flex-col flex-1">
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{product.category}</p>
                    <p className="text-gray-800 font-semibold text-base leading-5 line-clamp-2 min-h-[40px]">{product.name}</p>

                    {/* Étoiles */}
                    <div className="flex items-center gap-1 mt-2">
                        {Array(5).fill("").map((_, i) => (
                            <img key={i} className="w-3.5 h-3.5" src={i < 4 ? assets.star_icon : assets.star_dull_icon} alt="" />
                        ))}
                        <p className="text-xs text-gray-400 ml-1">(4)</p>
                    </div>

                    {/* Variantes */}
                    {product.variants?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {[...new Set(product.variants.map(v => v.color).filter(Boolean))].slice(0, 2).map((color, i) => (
                                <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{color}</span>
                            ))}
                            {[...new Set(product.variants.map(v => v.size).filter(Boolean))].slice(0, 2).map((size, i) => (
                                <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{size}</span>
                            ))}
                        </div>
                    )}

                    {/* Stock */}
                    {isOutOfStock && <p className="text-xs text-red-500 mt-2 font-medium">❌ Épuisé</p>}
                    {!isOutOfStock && totalStock !== null && totalStock <= 5 && (
                        <p className="text-xs text-orange-500 mt-2 font-medium">⚠️ Plus que {totalStock}</p>
                    )}

                    {/* Prix et bouton */}
                    <div className="flex items-center justify-between mt-4 pt-2 border-t border-gray-100">
                        <div>
                            <p className="text-xs text-gray-400 line-through mt-0.5">{product.price} {currency}</p>
                            <p className="text-xs font-bold text-primary leading-none">{product.offerPrice} {currency}</p>   
                        </div>

                        <div onClick={(e) => e.stopPropagation()}>
                            {isOutOfStock ? (
                                <button disabled className="bg-gray-100 border border-gray-200 h-[34px] px-3 rounded-full text-gray-400 text-xs">Épuisé</button>
                            ) : !inCart ? (
                                <button
                                    onClick={() => setShowVariantSelector(true)}
                                    className="flex items-center justify-center gap-1.5 bg-primary text-white h-[34px] px-4 rounded-full hover:opacity-90 transition text-xs font-medium"
                                >
                                    <img src={assets.cart_icon} alt="cart_icon" className="w-3.5 h-3.5 brightness-0 invert" />
                                    Ajouter
                                </button>
                            ) : (
                                <div className="flex items-center justify-between w-[90px] h-[34px] bg-primary/10 rounded-full overflow-hidden">
                                    <button onClick={() => { for (const key in cartItems) { if (key.startsWith(product._id)) { removeFromCart(key); break; } } }} className="w-8 h-full flex items-center justify-center text-primary text-base font-bold hover:bg-primary/10">-</button>
                                    <span className="text-xs font-semibold text-primary">{currentQty}</span>
                                    <button onClick={() => !isMaxReached && setShowVariantSelector(true)} className={`w-8 h-full flex items-center justify-center text-primary text-base font-bold hover:bg-primary/10 ${isMaxReached ? 'opacity-30 cursor-not-allowed' : ''}`}>+</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showVariantSelector && (
                <VariantSelector product={product} onClose={() => setShowVariantSelector(false)} />
            )}
        </>
    );
};

export default ProductCard;