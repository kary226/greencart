import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { Heart, ShoppingBag } from "lucide-react";

const ProductCard = ({ product }) => {
  const { addToWishlist, currency, isInWishlist } = useAppContext();
  const [imgIdx, setImgIdx] = useState(0);

  if (!product) return null;

  const { _id, name, price, offerPrice, image, variants, category } = product;
  const isWishlisted = isInWishlist ? isInWishlist(_id) : false;
  const discount = offerPrice && price ? Math.round(((price - offerPrice) / price) * 100) : null;
  const displayPrice = offerPrice || price;
  const images = image || [];
  const mainImg = images[imgIdx] || images[0];

  const totalStock = variants?.length > 0
    ? variants.reduce((acc, v) => acc + (v.stock || 0), 0)
    : (product.inStock ? 1 : 0);
  const isOutOfStock = totalStock === 0;

  const categorySlug = category?.slug || product.categorySlug || "all";

  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl">
      {/* Image Container */}
      <Link to={`/products/${categorySlug}/${_id}`} className="block relative overflow-hidden aspect-[3/4] bg-gray-50">
        {mainImg ? (
          <img 
            src={mainImg} 
            alt={name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onMouseEnter={() => images[1] && setImgIdx(1)}
            onMouseLeave={() => setImgIdx(0)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <ShoppingBag size={32} className="text-gray-300" />
          </div>
        )}

        {/* Badge de réduction */}
        {discount && !isOutOfStock && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg z-10">
            -{discount}%
          </div>
        )}
        
        {/* Badge épuisé */}
        {isOutOfStock && (
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-lg z-10">
            Épuisé
          </div>
        )}

        {/* Bouton wishlist */}
        <button
          className={`absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 z-10 ${
            isWishlisted ? "text-red-500" : "text-gray-500 hover:text-red-500"
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addToWishlist && addToWishlist(_id);
          }}
          aria-label="Ajouter aux favoris"
        >
          <Heart size={16} fill={isWishlisted ? "#e53935" : "none"} />
        </button>
      </Link>

      {/* Informations produit */}
      <Link to={`/products/${categorySlug}/${_id}`} className="block p-4">
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 min-h-[40px]">
          {name}
        </h3>
        
        <div className="mt-2">
          {/* Prix barré (ancien prix) en haut */}
          {offerPrice && price && price > offerPrice && (
            <div className="text-xs text-gray-400 line-through">
              {Number(price).toLocaleString("fr-FR")} {currency}
            </div>
          )}
          {/* Prix réel (promo ou normal) en bas */}
          <div className="text-lg font-bold text-gray-900">
            {Number(displayPrice).toLocaleString("fr-FR")} {currency}
          </div>
        </div>
      </Link>
    </div>
  );
};

export default ProductCard;