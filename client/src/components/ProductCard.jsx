import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const ProductCard = ({ product }) => {
  const { addToWishlist, addToCart, currency, isInWishlist } = useAppContext();
  const [imgIdx, setImgIdx] = useState(0);

  if (!product) return null;

  const { _id, name, price, offerPrice, image, variants, category, tags } = product;
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
    <>
      <div className="gc-card">
        {/* ── Image ── */}
        <Link
          to={`/products/${categorySlug}/${_id}`}
          className="gc-img-wrap"
          onMouseEnter={() => images[1] && setImgIdx(1)}
          onMouseLeave={() => setImgIdx(0)}
          tabIndex={-1}
        >
          {mainImg
            ? <img src={mainImg} alt={name} className="gc-img" loading="lazy" />
            : <div className="gc-no-img" />
          }

          {discount && !isOutOfStock && (
            <span className="gc-badge gc-badge-promo">-{discount}%</span>
          )}
          {isOutOfStock && (
            <span className="gc-badge gc-badge-sold">Épuisé</span>
          )}

          <button
            className={`gc-wish${isWishlisted ? " active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToWishlist && addToWishlist(_id);
            }}
            aria-label={isWishlisted ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24"
              fill={isWishlisted ? "#E24B4A" : "none"}
              stroke={isWishlisted ? "#E24B4A" : "currentColor"}
              strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </Link>

        {/* ── Body ── */}
        <div className="gc-body">
          <Link to={`/products/${categorySlug}/${_id}`} className="gc-name-link">
            <p className="gc-name">{name}</p>
          </Link>

          {/* Tags optionnels */}
          {tags?.length > 0 && (
            <div className="gc-tag-row">
              {tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="gc-tag">{tag}</span>
              ))}
            </div>
          )}

          {/* Bloc prix : prix actuel en premier, barré en dessous */}
          <div className="gc-price-block">
            <span className="gc-current">
              {Number(displayPrice).toLocaleString("fr-FR")} {currency}
            </span>
            {offerPrice && price && price > offerPrice && (
              <span className="gc-old">
                {Number(price).toLocaleString("fr-FR")} {currency}
              </span>
            )}
          </div>

          <hr className="gc-divider" />

          <button
            className={`gc-btn${isOutOfStock ? " gc-btn-disabled" : " gc-btn-primary"}`}
            disabled={isOutOfStock}
            onClick={() => !isOutOfStock && addToCart(_id)}
            aria-label={isOutOfStock ? "Produit indisponible" : `Ajouter ${name} au panier`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {isOutOfStock ? "Indisponible" : "Ajouter au panier"}
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        .gc-card {
          font-family: 'Inter', sans-serif;
          background: #fff;
          display: flex;
          flex-direction: column;
          border-radius: 16px;
          border: 0.5px solid rgba(0,0,0,0.10);
          overflow: hidden;
          transition: transform .25s ease;
        }
        .gc-card:hover { transform: translateY(-4px); }

        /* Image */
        .gc-img-wrap {
          position: relative;
          display: block;
          aspect-ratio: 4/5;
          overflow: hidden;
          background: #f5f3f0;
          text-decoration: none;
        }
        .gc-img {
          width: 100%; height: 100%;
          object-fit: cover;
          transition: transform .45s ease;
        }
        .gc-img-wrap:hover .gc-img { transform: scale(1.06); }
        .gc-no-img { width: 100%; height: 100%; background: #ede8e0; }

        /* Badges */
        .gc-badge {
          position: absolute;
          top: 10px; left: 10px;
          font-size: 11px; font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
          z-index: 2;
          letter-spacing: .02em;
        }
        .gc-badge-promo { background: #E24B4A; color: #FCEBEB; }
        .gc-badge-sold  { background: rgba(0,0,0,.5); color: #fff; }

        /* Wishlist */
        .gc-wish {
          position: absolute;
          top: 10px; right: 10px;
          width: 34px; height: 34px;
          border-radius: 50%;
          background: rgba(255,255,255,.92);
          border: 0.5px solid rgba(0,0,0,.10);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          z-index: 2;
          color: #555;
          transition: transform .2s;
        }
        .gc-wish:hover { transform: scale(1.12); }
        .gc-wish.active { background: #fff5f5; }

        /* Body */
        .gc-body {
          padding: 12px 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .gc-name-link { text-decoration: none; }
        .gc-name {
          font-size: 13px; font-weight: 500;
          color: #111;
          margin: 0; line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Tags */
        .gc-tag-row { display: flex; gap: 5px; flex-wrap: wrap; }
        .gc-tag {
          font-size: 10px; font-weight: 500;
          padding: 2px 8px;
          border-radius: 20px;
          border: 0.5px solid rgba(0,0,0,.12);
          color: #666;
          background: #f5f5f5;
        }

        /* Prix */
        .gc-price-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .gc-current {
          font-size: 16px; font-weight: 600;
          color: #111;
        }
        .gc-old {
          font-size: 12px;
          color: #aaa;
          text-decoration: line-through;
        }

        .gc-divider {
          border: none;
          border-top: 0.5px solid rgba(0,0,0,.08);
          margin: 0;
        }

        /* Bouton */
        .gc-btn {
          width: 100%;
          padding: 9px 0;
          border-radius: 10px;
          border: 0.5px solid rgba(0,0,0,.15);
          background: transparent;
          font-family: 'Inter', sans-serif;
          font-size: 13px; font-weight: 500;
          color: #111;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          transition: background .18s, opacity .18s;
        }
        .gc-btn-primary {
          background: #111;
          color: #fff;
          border-color: transparent;
        }
        .gc-btn-primary:hover { opacity: .85; }
        .gc-btn-disabled {
          opacity: .45;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
};

export default ProductCard;