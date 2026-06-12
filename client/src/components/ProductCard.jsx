import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

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
    <>
      <div className="rc-card">
        <Link to={`/products/${categorySlug}/${_id}`} className="rc-card-img-wrap"
          onMouseEnter={() => images[1] && setImgIdx(1)}
          onMouseLeave={() => setImgIdx(0)}
        >
          {mainImg
            ? <img src={mainImg} alt={name} className="rc-card-img" loading="lazy" />
            : <div className="rc-card-no-img" />
          }

          {discount && !isOutOfStock && (
            <span className="rc-badge rc-badge-promo">-{discount}%</span>
          )}
          {isOutOfStock && (
            <span className="rc-badge rc-badge-sold">Épuisé</span>
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

        .rc-card {
          background: #fff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .rc-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }

        .rc-card-img-wrap {
          position: relative;
          display: block;
          aspect-ratio: 1 / 1.25;
          overflow: hidden;
          background: #f5f3f0;
          border-radius: 12px;
          margin: 8px 8px 0 8px;
          text-decoration: none;
        }

        .rc-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform .4s ease;
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
          padding: 4px 10px;
          border-radius: 20px;
          z-index: 2;
        }
        .rc-badge-promo {
          background: #e53935;
          color: #fff;
        }
        .rc-badge-sold {
          background: rgba(0,0,0,0.65);
          color: #fff;
        }

        .rc-wishlist-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(255,255,255,0.95);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          box-shadow: 0 2px 6px rgba(0,0,0,0.12);
          transition: background 0.2s, transform 0.15s;
        }
        .rc-wishlist-btn:hover { transform: scale(1.1); }
        .rc-wishlist-btn.active { background: #fff5f5; }

        .rc-card-info {
          padding: 12px 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-decoration: none;
        }

        .rc-card-name {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #222;
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
          font-size: 16px;
          font-weight: 800;
          color: #e53935;
        }

        .rc-old-price {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          color: #bbb;
          text-decoration: line-through;
        }
      `}</style>
    </>
  );
};

export default ProductCard;