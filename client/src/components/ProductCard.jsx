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
  
  // ⚡ Optimisation : calculer le discount une seule fois
  const discount = useMemo(() => {
    if (offerPrice && price && price > offerPrice) {
      return Math.round(((price - offerPrice) / price) * 100);
    }
    return null;
  }, [price, offerPrice]);

  const displayPrice = offerPrice || price;
  const images = image || [];
  const mainImg = images[imgIdx] || images[0];

  // ⚡ Optimisation : calculer le stock une seule fois avec useMemo
  const { totalStock, isOutOfStock, isLowStock, hasRealStockCount } = useMemo(() => {
    const total = variants?.length > 0
      ? variants.reduce((acc, v) => acc + (v.stock || 0), 0)
      : (product.inStock ? 1 : 0);
    const outOfStock = total === 0;
    const hasRealStock = variants?.length > 0;
    const lowStock = hasRealStock && !outOfStock && total <= LOW_STOCK_THRESHOLD;
    
    return {
      totalStock: total,
      isOutOfStock: outOfStock,
      isLowStock: lowStock,
      hasRealStockCount: hasRealStock
    };
  }, [variants, product.inStock]);

  const categorySlug = category?.slug || product.categorySlug || "all";

  // ⚡ Optimisation : images avec transformation Cloudinary pour le responsive
  const getOptimizedImage = (imgUrl, width = 400) => {
    if (!imgUrl) return null;
    // Si c'est déjà une URL Cloudinary, on ajoute les paramètres
    if (imgUrl.includes('cloudinary.com')) {
      return imgUrl.replace('/upload/', `/upload/c_fill,w_${width},q_auto,f_auto/`);
    }
    return imgUrl;
  };

  const optimizedMainImg = getOptimizedImage(mainImg);
  const optimizedSecondImg = images[1] ? getOptimizedImage(images[1]) : null;

  return (
    <>
      <div className="rc-card">
        <Link 
          to={`/products/${categorySlug}/${_id}`} 
          className="rc-card-img-wrap"
          onMouseEnter={() => images[1] && setImgIdx(1)}
          onMouseLeave={() => setImgIdx(0)}
          // ⚡ Préchargement au survol pour une transition plus rapide
          onMouseOver={() => {
            if (images[1] && !document.querySelector(`link[rel="prefetch"][href="${images[1]}"]`)) {
              const link = document.createElement('link');
              link.rel = 'prefetch';
              link.as = 'image';
              link.href = images[1];
              document.head.appendChild(link);
            }
          }}
        >
          {!imgLoaded && mainImg && (
            <div className="rc-card-skeleton" />
          )}
          {mainImg && (
            <img
              src={optimizedMainImg}
              alt={name}
              className={`rc-card-img${imgLoaded ? ' loaded' : ''}`}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              // ⚡ Dimensions explicites pour éviter le layout shift
              width="300"
              height="400"
            />
          )}

          {discount && !isOutOfStock && (
            <span className="rc-badge rc-badge-promo">-{discount}%</span>
          )}
          {isOutOfStock && (
            <span className="rc-badge rc-badge-sold">Épuisé</span>
          )}
          {isLowStock && !discount && (
            <span className="rc-badge rc-badge-low-stock">
              Plus que {totalStock} en stock
            </span>
          )}

          <button
            className={`rc-wishlist-btn${isWishlisted ? " active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToWishlist && addToWishlist(_id);
            }}
            aria-label="Ajouter aux favoris"
          >
            <svg width="16" height="16" viewBox="0 0 24 24"
              fill={isWishlisted ? "#e53935" : "none"}
              stroke={isWishlisted ? "#e53935" : "#333"}
              strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </Link>

        <Link to={`/products/${categorySlug}/${_id}`} className="rc-card-info">
          <p className="rc-card-name">{name}</p>
          <div className="rc-card-prices">
            <span className="rc-price">{Number(displayPrice).toLocaleString("fr-FR")} {currency}</span>
            {offerPrice && price && price > offerPrice && (
              <span className="rc-old-price">{Number(price).toLocaleString("fr-FR")} {currency}</span>
            )}
          </div>
        </Link>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

        .rc-card {
          background: #fff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 12px;
          /* ⚡ Optimisation : contenir le layout */
          contain: layout style paint;
        }

        .rc-card-img-wrap {
          position: relative;
          display: block;
          aspect-ratio: 3/4;
          overflow: hidden;
          background: #f5f3f0;
          border-radius: 12px;
          text-decoration: none;
          /* ⚡ Optimisation : forcer le GPU */
          will-change: transform;
        }

        @keyframes rc-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .rc-card-skeleton {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            #f5f2ec 25%,
            #fbe9e7 45%,
            #f5f2ec 65%
          );
          background-size: 200% 100%;
          animation: rc-shimmer 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .rc-card-skeleton { animation: none; }
        }

        .rc-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform .3s ease, opacity .3s ease;
          opacity: 0;
          /* ⚡ Optimisation : forcer le GPU */
          will-change: transform, opacity;
        }
        .rc-card-img.loaded {
          opacity: 1;
        }
        .rc-card-img-wrap:hover .rc-card-img {
          transform: scale(1.05);
        }

        .rc-card-no-img {
          width: 100%;
          height: 100%;
          background: #ede8e0;
        }

        .rc-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          z-index: 2;
        }
        .rc-badge-promo {
          background: #e53935;
          color: #fff;
          animation: rc-badge-pop .25s ease-out;
        }
        .rc-badge-sold {
          background: rgba(0,0,0,.55);
          color: #fff;
        }
        .rc-badge-low-stock {
          background: #111;
          color: #fff;
          font-size: 10px;
        }

        @keyframes rc-badge-pop {
          0%   { transform: scale(.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rc-badge-promo { animation: none; }
        }

        .rc-wishlist-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,.9);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          box-shadow: 0 1px 4px rgba(0,0,0,.12);
          transition: background .2s, transform .15s;
        }
        .rc-wishlist-btn:hover { transform: scale(1.1); }
        .rc-wishlist-btn.active { background: #fff5f5; }

        .rc-card-info {
          padding: 10px 4px 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-decoration: none;
        }

        .rc-card-name {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #333;
          margin: 0;
          line-height: 1.4;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .rc-card-prices {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .rc-price {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #111;
          transition: color .15s;
        }
        .rc-card:hover .rc-price {
          color: #e53935;
        }

        .rc-old-price {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          color: #bbb;
          text-decoration: line-through;
        }
      `}</style>
    </>
  );
};

export default ProductCard;