import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const LOW_STOCK_THRESHOLD = 5;

const ProductCard = ({ product }) => {
  const { addToWishlist, currency, isInWishlist } = useAppContext();
  const [imgIdx, setImgIdx] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!product) return null;

  const { _id, name, price, offerPrice, image, variants, category } = product;
  const isWishlisted = isInWishlist ? isInWishlist(_id) : false;
  const images = image || [];
  const mainImg = images[imgIdx] || images[0];

  // Calculs optimisés
  const { displayPrice, discount, totalStock, isOutOfStock, isLowStock } = useMemo(() => {
    const disc = offerPrice && price ? Math.round(((price - offerPrice) / price) * 100) : null;
    const total = variants?.length > 0
      ? variants.reduce((acc, v) => acc + (v.stock || 0), 0)
      : (product.inStock ? 1 : 0);
    const outOfStock = total === 0;
    const hasRealStock = variants?.length > 0;
    const lowStock = hasRealStock && !outOfStock && total <= LOW_STOCK_THRESHOLD;

    return {
      displayPrice: offerPrice || price,
      discount: disc,
      totalStock: total,
      isOutOfStock: outOfStock,
      isLowStock: lowStock,
    };
  }, [price, offerPrice, variants, product.inStock]);

  const categorySlug = category?.slug || product.categorySlug || "all";

  return (
    <div className={`sc-card${isOutOfStock ? ' sc-card-out' : ''}`}>
      <Link 
        to={`/products/${categorySlug}/${_id}`} 
        className={`sc-card-img-wrap${isOutOfStock ? ' sc-out-of-stock' : ''}`}
        onMouseEnter={() => images[1] && setImgIdx(1)}
        onMouseLeave={() => setImgIdx(0)}
      >
        {!imgLoaded && mainImg && <div className="sc-skeleton" />}
        
        {mainImg ? (
          <img
            src={mainImg}
            alt={name}
            className={`sc-img${imgLoaded ? ' loaded' : ''}`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className="sc-no-img" />
        )}

        {/* Badges */}
        {discount && !isOutOfStock && (
          <span className="sc-badge sc-promo">-{discount}%</span>
        )}
        {isLowStock && !discount && (
          <span className="sc-badge sc-low">+ que {totalStock}</span>
        )}

        {/* [FIX] Rupture de stock : avant, un simple petit badge en coin
            (facile à manquer). Maintenant : image assombrie/grisée +
            bandeau centré bien visible, comme sur les gros sites e-commerce. */}
        {isOutOfStock && (
          <div className="sc-out-overlay">
            <span className="sc-out-ribbon">Épuisé</span>
          </div>
        )}

        {/* Wishlist */}
        <button
          className={`sc-wishlist${isWishlisted ? " active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addToWishlist?.(_id);
          }}
          aria-label="Ajouter aux favoris"
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={isWishlisted ? "#e53935" : "none"}
            stroke={isWishlisted ? "#e53935" : "#333"}
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </Link>

      {/* Infos produit */}
      <Link to={`/products/${categorySlug}/${_id}`} className={`sc-info${isOutOfStock ? ' sc-info-out' : ''}`}>
        <p className="sc-name">{name}</p>
        <div className="sc-prices">
          <span className="sc-price">
            {Number(displayPrice).toLocaleString("fr-FR")} {currency}
          </span>
          {offerPrice && price > offerPrice && (
            <span className="sc-old">
              {Number(price).toLocaleString("fr-FR")} {currency}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
};

export default ProductCard;