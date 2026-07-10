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

  // ✅ NOUVEAU : Récupérer les tailles disponibles avec leurs stocks
  const { displayPrice, discount, isOutOfStock, hasVariants, sizeInfo } = useMemo(() => {
    const disc = offerPrice && price ? Math.round(((price - offerPrice) / price) * 100) : null;
    
    // ✅ Calcul du stock total (pour le badge "low stock" seulement)
    const totalStock = variants?.length > 0
      ? variants.reduce((acc, v) => acc + (v.stock || 0), 0)
      : (product.inStock ? 1 : 0);
    
    const outOfStock = totalStock === 0;
    const hasRealStock = variants?.length > 0;
    
    // ✅ Récupérer les tailles disponibles avec stock > 0
    const sizesWithStock = variants?.length > 0
      ? variants
          .filter(v => v.size && v.stock > 0)
          .map(v => ({ size: v.size, stock: v.stock }))
      : [];
    
    // ✅ Regrouper par taille (si plusieurs variantes ont la même taille)
    const sizeMap = new Map();
    sizesWithStock.forEach(({ size, stock }) => {
      if (sizeMap.has(size)) {
        sizeMap.set(size, sizeMap.get(size) + stock);
      } else {
        sizeMap.set(size, stock);
      }
    });
    
    // Convertir en tableau trié
    const sortedSizes = Array.from(sizeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([size, stock]) => ({ size, stock }));

    return {
      displayPrice: offerPrice || price,
      discount: disc,
      isOutOfStock: outOfStock,
      hasVariants: hasRealStock && variants.length > 0,
      sizeInfo: sortedSizes,
      totalStock,
    };
  }, [price, offerPrice, variants, product.inStock]);

  const categorySlug = category?.slug || product.categorySlug || "all";

  // ✅ Afficher le libellé de stock
  const renderStockLabel = () => {
    if (isOutOfStock) return null;
    
    if (sizeInfo.length > 0) {
      // ✅ Affichage des tailles avec leurs stocks
      return (
        <div className="sc-sizes">
          {sizeInfo.map(({ size, stock }) => (
            <span 
              key={size} 
              className={`sc-size ${stock > 0 ? 'in-stock' : 'out-of-stock'}`}
            >
              {size} {stock > 0 && `(${stock})`}
            </span>
          ))}
        </div>
      );
    }
    
    // ✅ Si pas de variants, afficher simplement "En stock"
    return <span className="sc-stock-label">En stock</span>;
  };

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
        
        {!isOutOfStock && sizeInfo.length > 0 && (
          <span className="sc-badge sc-multi">{sizeInfo.length} tailles</span>
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
        
        {/* ✅ AFFICHAGE DES TAILLES AVEC STOCKS */}
        {!isOutOfStock && (
          <div className="sc-stock-info">
            {renderStockLabel()}
          </div>
        )}
      </Link>

      {/* ✅ STYLES CSS pour l'affichage des tailles */}
      <style>{`
        .sc-stock-info {
          margin-top: 4px;
        }
        
        .sc-sizes {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 2px;
        }
        
        .sc-size {
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 3px;
          font-weight: 500;
          background: #f0f0f0;
          color: #666;
        }
        
        .sc-size.in-stock {
          background: #e8f5e9;
          color: #2e7d32;
        }
        
        .sc-size.out-of-stock {
          background: #fce4ec;
          color: #c62828;
          text-decoration: line-through;
        }
        
        .sc-stock-label {
          font-size: 11px;
          color: #2e7d32;
          font-weight: 500;
        }
        
        .sc-badge.sc-multi {
          background: #1565c0;
          color: white;
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 3px;
        }
        
        .sc-card-out .sc-info {
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
};

export default ProductCard;