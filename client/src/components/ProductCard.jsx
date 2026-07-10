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

      <style>{`
        /* ✅ STYLES MODERNES POUR LES VARIANTES */
        .sc-variants-info {
          display: flex;
          align-items: center;
          margin-top: 6px;
          padding-top: 4px;
          border-top: 1px solid rgba(0,0,0,0.04);
        }

        /* Couleurs */
        .sc-colors {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .sc-colors-dots {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .sc-color-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1.5px solid rgba(0,0,0,0.06);
          display: inline-block;
          flex-shrink: 0;
          transition: all 0.2s ease;
          cursor: default;
        }

        .sc-color-dot:hover {
          transform: scale(1.15);
          border-color: rgba(0,0,0,0.2);
          z-index: 2;
        }

        .sc-color-dot:not(:first-child) {
          margin-left: -2px;
        }

        /* Tailles */
        .sc-sizes {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }

        .sc-size-tag {
          font-size: 10px;
          font-weight: 600;
          color: #555;
          background: #f0f0f0;
          padding: 1px 6px;
          border-radius: 3px;
          letter-spacing: 0.3px;
          transition: all 0.2s;
        }

        .sc-size-tag:hover {
          background: #e0e0e0;
          color: #111;
        }

        /* Compteur "+X" */
        .sc-variant-count {
          font-size: 10px;
          font-weight: 500;
          color: #888;
          background: #f5f5f5;
          border-radius: 10px;
          padding: 1px 8px;
          transition: all 0.2s;
          margin-left: 2px;
        }

        .sc-variant-count:hover {
          background: #eee;
          color: #555;
        }

        .sc-card-out .sc-variants-info {
          opacity: 0.4;
        }

        .sc-card-out .sc-size-tag {
          background: #e8e8e8;
          color: #aaa;
        }
      `}</style>

      {/* Vos styles existants - inchangés */}
      <style>{`
        .sc-card {
          position: relative;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.2s;
        }

        .sc-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .sc-card-img-wrap {
          position: relative;
          display: block;
          aspect-ratio: 1/1;
          overflow: hidden;
          background: #f5f5f5;
        }

        .sc-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: opacity 0.3s;
          opacity: 0;
        }

        .sc-img.loaded {
          opacity: 1;
        }

        .sc-skeleton {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .sc-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          z-index: 2;
        }

        .sc-promo {
          background: #e53935;
          color: white;
        }

        .sc-low {
          background: #ff9800;
          color: white;
        }

        .sc-wishlist {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.9);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          transition: all 0.2s;
          backdrop-filter: blur(4px);
        }

        .sc-wishlist:hover {
          background: white;
          transform: scale(1.05);
        }

        .sc-wishlist.active {
          background: #fff0f0;
        }

        .sc-out-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
        }

        .sc-out-ribbon {
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 16px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sc-info {
          display: block;
          padding: 8px 6px;
          text-decoration: none;
          color: inherit;
        }

        .sc-name {
          font-size: 13px;
          font-weight: 500;
          color: #111;
          margin: 0 0 2px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .sc-prices {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .sc-price {
          font-size: 14px;
          font-weight: 700;
          color: #111;
        }

        .sc-old {
          font-size: 12px;
          color: #bbb;
          text-decoration: line-through;
        }

        .sc-card-out .sc-name {
          color: #999;
        }

        .sc-card-out .sc-price {
          color: #999;
        }

        .sc-card-out .sc-old {
          color: #ccc;
        }

        .sc-no-img {
          width: 100%;
          height: 100%;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ccc;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default ProductCard;