import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getPresetImageUrl } from "../utils/cloudinaryImage";

const LOW_STOCK_THRESHOLD = 5;

const ProductCard = ({ product }) => {
  const { addToWishlist, removeFromWishlist, currency, isInWishlist } = useAppContext();
  const [imgIdx, setImgIdx] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!product) return null;

  const { _id, name, price, offerPrice, image, variants, category } = product;
  const isWishlisted = isInWishlist ? isInWishlist(_id) : false;
  const images = image || [];
  const mainImg = images[imgIdx] || images[0];

  // ✅ Extraire les couleurs et tailles uniques
  const uniqueColors = variants?.length > 0 
      ? [...new Set(variants.map(v => v.color).filter(Boolean))] 
      : [];

  const uniqueSizes = variants?.length > 0 
      ? [...new Set(variants.map(v => v.size).filter(Boolean))] 
      : [];

  // Limiter à 3 couleurs affichées
  const displayColors = uniqueColors.slice(0, 3);
  const hasMoreColors = uniqueColors.length > 3;

  // Limiter à 3 tailles affichées
  const displaySizes = uniqueSizes.slice(0, 3);
  const hasMoreSizes = uniqueSizes.length > 3;

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

  // ✅ Déterminer quoi afficher
  const hasColors = uniqueColors.length > 0;
  const hasSizes = uniqueSizes.length > 0;

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
            src={getPresetImageUrl(mainImg, "card")}
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

        {/* Rupture de stock */}
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
            isWishlisted ? removeFromWishlist?.(_id) : addToWishlist?.(_id);
          }}
          aria-label={isWishlisted ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`}
          aria-pressed={isWishlisted}
        >
          {/* Couleurs pilotées par la CSS via currentColor : la règle
              .sc-wishlist.active suffit, plus de hex en dur dans le JSX. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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

        {/* ✅ AFFICHAGE DES COULEURS OU TAILLES */}
        {!isOutOfStock && (
          <div className="sc-variants-info">
            {/* Cas 1 : Couleurs disponibles */}
            {hasColors && (
              <div className="sc-colors">
                <div className="sc-colors-dots">
                  {displayColors.map((color, idx) => {
                    const variant = product.variants.find(v => v.color === color);
                    const colorCode = variant?.colorCode || '#ccc';
                    return (
                      <span 
                        key={idx} 
                        className="sc-color-dot"
                        style={{ backgroundColor: colorCode }}
                        title={color}
                      />
                    );
                  })}
                </div>
                {hasMoreColors && (
                  <span className="sc-variant-count">+{uniqueColors.length - 3}</span>
                )}
              </div>
            )}

            {/* Cas 2 : Pas de couleurs mais des tailles */}
            {!hasColors && hasSizes && (
              <div className="sc-sizes">
                {displaySizes.map((size, idx) => (
                  <span key={idx} className="sc-size-tag">{size}</span>
                ))}
                {hasMoreSizes && (
                  <span className="sc-variant-count">+{uniqueSizes.length - 3}</span>
                )}
              </div>
            )}
          </div>
        )}
      </Link>
    </div>
  );
};

export default ProductCard;