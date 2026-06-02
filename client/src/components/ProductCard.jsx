import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const ProductCard = ({ product }) => {
  const { addToWishlist, wishlist, currency, isInWishlist } = useAppContext();
  const [imgIdx, setImgIdx] = useState(0);

  if (!product) return null;

  const { _id, name, price, offerPrice, image, variants } = product;
  
  // Vérifier si le produit est dans la wishlist
  const isWishlisted = isInWishlist ? isInWishlist(_id) : false;
  
  // Calculer la réduction
  const discount = offerPrice && price ? Math.round(((price - offerPrice) / price) * 100) : null;
  
  // Prix affiché
  const displayPrice = offerPrice || price;
  
  // Image principale (tableau image dans product)
  const images = image || [];
  const mainImg = images[imgIdx] || images[0];

  // Calculer le stock total pour savoir si c'est épuisé
  const totalStock = variants?.length > 0 
    ? variants.reduce((acc, v) => acc + (v.stock || 0), 0)
    : (product.inStock ? 1 : 0);
  
  const isOutOfStock = totalStock === 0;

  return (
    <div className="pcard">
      <Link to={`/products/${_id}`} className="pcard-img-wrap">
        {mainImg && (
          <img
            src={mainImg}
            alt={name}
            className="pcard-img"
            onMouseEnter={() => images[1] && setImgIdx(1)}
            onMouseLeave={() => setImgIdx(0)}
            loading="lazy"
          />
        )}
        {discount && !isOutOfStock && <span className="pcard-discount">-{discount}%</span>}
        {isOutOfStock && <span className="pcard-sold stock-out">Épuisé</span>}
        <button
          className={`pcard-wish${isWishlisted ? " wishlisted" : ""}`}
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

      <Link to={`/products/${_id}`} className="pcard-info">
        <p className="pcard-name">{name}</p>
        <div className="pcard-prices">
          <span className="pcard-price">{currency}{displayPrice?.toFixed(2)}</span>
          {offerPrice && price && price > offerPrice && (
            <span className="pcard-oldprice">{currency}{price?.toFixed(2)}</span>
          )}
        </div>
      </Link>

      <style>{`
        .pcard {
          display: flex;
          flex-direction: column;
          background: #fff;
          border-radius: 2px;
          overflow: hidden;
          transition: box-shadow .2s;
        }
        .pcard:hover { box-shadow: 0 4px 16px rgba(0,0,0,.1); }
        .pcard-img-wrap {
          position: relative;
          display: block;
          aspect-ratio: 3/4;
          overflow: hidden;
          background: #f5f5f5;
          text-decoration: none;
        }
        .pcard-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform .3s;
        }
        .pcard:hover .pcard-img { transform: scale(1.04); }
        .pcard-discount {
          position: absolute;
          top: 8px; left: 8px;
          background: #e53935;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 2px;
          letter-spacing: .3px;
        }
        .pcard-wish {
          position: absolute;
          bottom: 8px; right: 8px;
          background: rgba(0,0,0,.35);
          border: none;
          border-radius: 50%;
          width: 32px; height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background .2s;
        }
        .pcard-wish:hover, .pcard-wish.wishlisted { background: rgba(0,0,0,.6); }
        .pcard-sold {
          position: absolute;
          bottom: 8px; left: 8px;
          background: rgba(0,0,0,.5);
          color: #fff;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 2px;
        }
        .pcard-sold.stock-out {
          background: #e53935;
          font-weight: 700;
        }
        .pcard-info {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-decoration: none;
          flex: 1;
        }
        .pcard-name {
          font-size: 12px;
          color: #333;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin: 0;
        }
        .pcard-prices { display: flex; align-items: baseline; gap: 6px; }
        .pcard-price {
          font-size: 14px;
          font-weight: 700;
          color: #111;
        }
        .pcard-oldprice {
          font-size: 11px;
          color: #aaa;
          text-decoration: line-through;
        }
      `}</style>
    </div>
  );
};

export default ProductCard;