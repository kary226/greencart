import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const ProductCard = ({ product }) => {
  const { addToWishlist, wishlist, currency, isInWishlist } = useAppContext();
  const [imgIdx, setImgIdx] = useState(0);

  if (!product) return null;

  const { _id, name, price, offerPrice, image, variants } = product;
  
  const isWishlisted = isInWishlist ? isInWishlist(_id) : false;
  const discount = offerPrice && price ? Math.round(((price - offerPrice) / price) * 100) : null;
  const displayPrice = offerPrice || price;
  const images = image || [];
  const mainImg = images[imgIdx] || images[0];

  const totalStock = variants?.length > 0 
    ? variants.reduce((acc, v) => acc + (v.stock || 0), 0)
    : (product.inStock ? 1 : 0);
  
  const isOutOfStock = totalStock === 0;

  return (
    <div className="product-card">
      <Link to={`/products/${_id}`} className="product-card-img-wrap">
        {mainImg && (
          <img
            src={mainImg}
            alt={name}
            className="product-card-img"
            onMouseEnter={() => images[1] && setImgIdx(1)}
            onMouseLeave={() => setImgIdx(0)}
            loading="lazy"
          />
        )}
        {discount && !isOutOfStock && <span className="product-discount">-{discount}%</span>}
        {isOutOfStock && <span className="product-sold">Épuisé</span>}
        <button
          className={`product-wishlist ${isWishlisted ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addToWishlist && addToWishlist(_id);
          }}
          aria-label="Ajouter aux favoris"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? "#e53935" : "none"} stroke={isWishlisted ? "#e53935" : "#fff"} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </Link>

      <Link to={`/products/${_id}`} className="product-card-info">
        <h3 className="product-name">{name}</h3>
        <div className="product-prices">
          <span className="product-price">{currency}{displayPrice?.toFixed(2)}</span>
          {offerPrice && price && price > offerPrice && (
            <span className="product-oldprice">{currency}{price?.toFixed(2)}</span>
          )}
        </div>
      </Link>

      <style>{`
        .product-card {
          display: flex;
          flex-direction: column;
          background: #fff;
          border-radius: 4px;
          overflow: hidden;
          transition: box-shadow 0.2s;
        }
        .product-card-img-wrap {
          position: relative;
          display: block;
          aspect-ratio: 3/4;
          overflow: hidden;
          background: #f5f5f5;
          text-decoration: none;
        }
        .product-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }
        .product-card:hover .product-card-img {
          transform: scale(1.03);
        }
        .product-discount {
          position: absolute;
          top: 8px;
          left: 8px;
          background: #e53935;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 2px;
          z-index: 2;
        }
        .product-wishlist {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0,0,0,0.35);
          border: none;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
          z-index: 2;
        }
        .product-wishlist:hover,
        .product-wishlist.active {
          background: rgba(0,0,0,0.6);
        }
        .product-sold {
          position: absolute;
          bottom: 8px;
          left: 8px;
          background: rgba(0,0,0,0.6);
          color: #fff;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 2px;
          z-index: 2;
        }
        .product-card-info {
          padding: 10px 8px 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-decoration: none;
        }
        .product-name {
          font-size: 12px;
          font-weight: 400;
          color: #333;
          line-height: 1.4;
          margin: 0;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          min-height: 32px;
        }
        .product-prices {
          display: flex;
          align-items: baseline;
          gap: 6px;
          flex-wrap: wrap;
        }
        .product-price {
          font-size: 14px;
          font-weight: 700;
          color: #111;
        }
        .product-oldprice {
          font-size: 11px;
          color: #aaa;
          text-decoration: line-through;
        }
      `}</style>
    </div>
  );
};

export default ProductCard;