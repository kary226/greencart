import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useAppContext } from "../context/AppContext";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import ProductReviews from "../components/ProductReviews";
import toast from "react-hot-toast";
import SEO from "../components/SEO";
import RecentlyViewed from "../components/RecentlyViewed";

const ProductDetails = () => {
  const { products, navigate, currency, addToCart, cartItems, getCartKey, addToRecentlyViewed, axios } = useAppContext();
  const { id } = useParams();
  
  // États principaux
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [variantData, setVariantData] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [averageRating, setAverageRating] = useState(4);
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviewsKey, setReviewsKey] = useState(0);
  
  // États d'erreur
  const [colorError, setColorError] = useState('');
  const [sizeError, setSizeError] = useState('');
  const [highlightColor, setHighlightColor] = useState(false);
  const [highlightSize, setHighlightSize] = useState(false);
  
  // Refs
  const colorSectionRef = useRef(null);
  const sizeSectionRef = useRef(null);
  const relatedCarouselRef = useRef(null);
  const [showRelatedNav, setShowRelatedNav] = useState({ prev: false, next: true });

  // Trouver le produit
  useEffect(() => {
    const found = products.find(item => item._id === id);
    setProduct(found);
  }, [products, id]);

  // Initialiser les sélections
  useEffect(() => {
    if (!product?.variants?.length) {
      setVariantData(null);
      setCurrentImageIndex(0);
      return;
    }
    const defaultVariant = product.variants[0];
    setSelectedColor(defaultVariant.color);
    setVariantData(defaultVariant);
    setCurrentImageIndex(defaultVariant.startImageIndex || 0);
  }, [product]);

  // Mise à jour variant par couleur
  useEffect(() => {
    if (!product?.variants || !selectedColor) return;
    const variant = product.variants.find(v => v.color === selectedColor);
    if (variant) {
      setVariantData(variant);
      setCurrentImageIndex(variant.startImageIndex || 0);
      setColorError('');
      setHighlightColor(false);
    }
  }, [selectedColor, product]);

  // Mise à jour variant par taille
  useEffect(() => {
    if (!product?.variants || !selectedColor || !selectedSize) return;
    const exactVariant = product.variants.find(v => 
      v.color === selectedColor && v.size === selectedSize
    );
    if (exactVariant) setVariantData(exactVariant);
  }, [selectedColor, selectedSize, product]);

  // Réinitialisation erreurs
  useEffect(() => {
    if (selectedSize) {
      setSizeError('');
      setHighlightSize(false);
    }
  }, [selectedSize]);

  // Ajout aux récemment consultés
  useEffect(() => {
    if (product) {
      addToRecentlyViewed(product);
      setReviewsKey(prev => prev + 1);
    }
  }, [product]);

  // Produits similaires
  useEffect(() => {
    if (!products.length || !product) return;
    
    const category = product.categories?.[0] || product.category;
    const filtered = products.filter(p => {
      const pCategory = p.categories?.[0] || p.category;
      return pCategory === category && p._id !== product._id && p.inStock !== false;
    });
    setRelatedProducts(filtered.slice(0, 12));
    setTimeout(checkRelatedScroll, 100);
  }, [products, product]);

  // Utilitaires
  const allImages = product?.image || [];
  const uniqueColors = useMemo(() => 
    product?.variants ? [...new Set(product.variants.map(v => v.color).filter(Boolean))] : [],
    [product]
  );
  const uniqueSizes = useMemo(() => 
    product?.variants ? [...new Set(product.variants.map(v => v.size).filter(Boolean))] : [],
    [product]
  );

  const currentPrice = variantData?.price ?? product?.price;
  const currentOfferPrice = variantData?.offerPrice ?? product?.offerPrice;
  const currentStock = variantData?.stock ?? product?.stock ?? 0;
  const displayPrice = currentOfferPrice && currentOfferPrice < currentPrice ? currentOfferPrice : currentPrice;
  const discount = currentOfferPrice && currentOfferPrice < currentPrice 
    ? Math.round(((currentPrice - currentOfferPrice) / currentPrice) * 100) 
    : null;

  const cartKey = getCartKey(product?._id, selectedColor, selectedSize);
  const currentQty = cartItems[cartKey] || 0;

  const isSizeAvailable = (size) => {
    if (!selectedColor) {
      return product?.variants?.some(v => v.size === size && v.stock > 0) || false;
    }
    const variant = product?.variants?.find(v => v.color === selectedColor && v.size === size);
    return variant ? variant.stock > 0 : false;
  };

  const getStockLabel = () => {
    if ((uniqueColors.length && !selectedColor) || (uniqueSizes.length && !selectedSize)) return null;
    if (currentStock === 0) return 'Rupture de stock';
    if (currentStock <= 5) return `Plus que ${currentStock} en stock`;
    return `En stock (${currentStock})`;
  };

  const getStockColor = () => {
    if (currentStock === 0) return '#e53935';
    if (currentStock <= 5) return '#ff9800';
    return '#4caf50';
  };

  // Navigation carrousel
  const checkRelatedScroll = () => {
    if (!relatedCarouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = relatedCarouselRef.current;
    setShowRelatedNav({
      prev: scrollLeft > 20,
      next: scrollLeft + clientWidth < scrollWidth - 20
    });
  };

  const scrollRelated = (direction) => {
    if (!relatedCarouselRef.current) return;
    const amount = direction === 'left' ? -280 : 280;
    relatedCarouselRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkRelatedScroll, 300);
  };

  // Navigation images
  const goToPrevImage = () => setCurrentImageIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1);
  const goToNextImage = () => setCurrentImageIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1);

  // Validation
  const validateSelection = () => {
    let valid = true;
    if (uniqueColors.length && !selectedColor) {
      setColorError('Choisissez une couleur');
      colorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightColor(true);
      setTimeout(() => setHighlightColor(false), 1500);
      valid = false;
    }
    if (valid && uniqueSizes.length && !selectedSize) {
      setSizeError('Choisissez une taille');
      sizeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightSize(true);
      setTimeout(() => setHighlightSize(false), 1500);
      valid = false;
    }
    return valid;
  };

  const handleAddToCart = () => {
    if (!validateSelection()) return;
    if (currentStock === 0) return toast.error('Épuisé');
    if (currentQty >= currentStock) return toast.error(`Stock limité à ${currentStock}`);
    addToCart(product._id, selectedColor, selectedSize);
    toast.success('Ajouté au panier');
  };

  const handleBuyNow = () => {
    if (!validateSelection()) return;
    if (currentStock === 0) return toast.error('Épuisé');
    addToCart(product._id, selectedColor, selectedSize);
    navigate('/cart');
  };

  // Rendu étoiles
  const renderStars = (rating) => (
    <div className="stars">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className={`star ${i < Math.floor(rating) ? 'full' : i < rating ? 'half' : 'empty'}`} viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      ))}
    </div>
  );

  if (!product) return null;

  return (
    <>
      <SEO title={product.name} description={product.description?.slice(0, 160) || ''} image={allImages[0]} />
      
      <div className="pd-page">
        {/* Fil d'Ariane */}
        <div className="pd-breadcrumb">
          <Link to="/">Accueil</Link> / 
          <Link to="/products">Articles</Link> / 
          <span>{product.name}</span>
        </div>

        {/* Section principale */}
        <div className="pd-main">
          {/* Galerie */}
          <div className="pd-gallery">
            <div className="pd-main-img">
              <img src={allImages[currentImageIndex]} alt={product.name} />
              {allImages.length > 1 && (
                <>
                  <button className="pd-nav pd-nav-prev" onClick={goToPrevImage}>‹</button>
                  <button className="pd-nav pd-nav-next" onClick={goToNextImage}>›</button>
                  <span className="pd-counter">{currentImageIndex + 1}/{allImages.length}</span>
                </>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="pd-thumbs">
                {allImages.map((img, i) => (
                  <div 
                    key={i} 
                    className={`pd-thumb ${currentImageIndex === i ? 'active' : ''}`}
                    onClick={() => setCurrentImageIndex(i)}
                  >
                    <img src={img} alt="" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Infos produit */}
          <div className="pd-info">
            <h1 className="pd-title">{product.name}</h1>

            {/* Prix */}
            <div className="pd-price">
              {discount && <span className="pd-old">{currentPrice} {currency}</span>}
              <span className="pd-current">{displayPrice} {currency}</span>
              {discount && <span className="pd-discount">-{discount}%</span>}
            </div>

            {/* Étoiles */}
            <div className="pd-rating">
              {renderStars(averageRating)}
              <span className="pd-rating-text">{averageRating}/5 ({totalReviews} avis)</span>
            </div>

            {/* Stock */}
            {getStockLabel() && (
              <p className="pd-stock" style={{ color: getStockColor() }}>{getStockLabel()}</p>
            )}

            {/* Couleurs */}
            {uniqueColors.length > 0 && (
              <div ref={colorSectionRef} className={`pd-option ${highlightColor ? 'error' : ''}`}>
                <p className="pd-option-label">Couleur {selectedColor && <span>— {selectedColor}</span>}</p>
                <div className="pd-colors">
                  {uniqueColors.map((color, i) => {
                    const variant = product.variants.find(v => v.color === color);
                    const available = variant?.stock > 0;
                    return (
                      <button
                        key={i}
                        className={`pd-color ${selectedColor === color ? 'active' : ''} ${!available ? 'disabled' : ''}`}
                        onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                        disabled={!available}
                      >
                        <span className="pd-swatch" style={{ backgroundColor: variant?.colorCode || '#ccc' }} />
                        <span className="pd-color-label">{color}</span>
                      </button>
                    );
                  })}
                </div>
                {colorError && <p className="pd-error">{colorError}</p>}
              </div>
            )}

            {/* Tailles */}
            {uniqueSizes.length > 0 && (
              <div ref={sizeSectionRef} className={`pd-option ${highlightSize ? 'error' : ''}`}>
                <p className="pd-option-label">Taille {selectedSize && <span>— {selectedSize}</span>}</p>
                <div className="pd-sizes">
                  {uniqueSizes.map((size, i) => (
                    <button
                      key={i}
                      className={`pd-size ${selectedSize === size ? 'active' : ''} ${!isSizeAvailable(size) ? 'disabled' : ''}`}
                      onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                      disabled={!isSizeAvailable(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {sizeError && <p className="pd-error">{sizeError}</p>}
              </div>
            )}

            {/* Indicateur panier */}
            {currentQty > 0 && <p className="pd-cart-indicator">{currentQty} dans le panier</p>}

            {/* Détails */}
            <div className="pd-details">
              <button className={`pd-details-btn ${showDetails ? 'open' : ''}`} onClick={() => setShowDetails(!showDetails)}>
                Détails <span>{showDetails ? '▲' : '▼'}</span>
              </button>
              {showDetails && (
                <div className="pd-details-content" dangerouslySetInnerHTML={{ __html: product.description || '' }} />
              )}
            </div>
          </div>
        </div>

        {/* Produits similaires */}
        {relatedProducts.length > 0 && (
          <div className="pd-related">
            <div className="pd-section-header">
              <h2>Articles similaires</h2>
            </div>
            <div className="pd-related-carousel-wrapper">
              {showRelatedNav.prev && (
                <button className="pd-carousel-nav pd-carousel-prev" onClick={() => scrollRelated('left')}>‹</button>
              )}
              <div className="pd-related-carousel" ref={relatedCarouselRef} onScroll={checkRelatedScroll}>
                {relatedProducts.map(p => (
                  <div key={p._id} className="pd-related-item">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
              {showRelatedNav.next && (
                <button className="pd-carousel-nav pd-carousel-next" onClick={() => scrollRelated('right')}>›</button>
              )}
            </div>
          </div>
        )}

        {/* Avis */}
        <div className="pd-reviews">
          <div className="pd-section-header">
            <h2>Avis clients</h2>
            <p>{totalReviews > 0 ? `${totalReviews} avis • ${averageRating}/5` : 'Soyez le premier à donner votre avis'}</p>
          </div>
          <ProductReviews productId={product._id} onDataChange={set} key={reviewsKey} />
        </div>

        {/* Récemment consultés */}
        <RecentlyViewed key={reviewsKey} />

        {/* Barre d'action flottante */}
        <div className="pd-floating">
          <button className="pd-btn-cart" onClick={handleAddToCart}>🛒 Ajouter</button>
          <button className="pd-btn-buy" onClick={handleBuyNow}>Acheter</button>
        </div>
      </div>

      <style>{`
        .pd-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px 12px 80px;
        }

        .pd-breadcrumb {
          font-size: 12px;
          color: #888;
          margin-bottom: 16px;
        }
        .pd-breadcrumb a {
          color: #666;
          text-decoration: none;
          margin: 0 4px;
        }
        .pd-breadcrumb a:hover { color: #111; }
        .pd-breadcrumb span { color: #111; font-weight: 500; }

        .pd-main {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        @media (min-width: 768px) {
          .pd-main {
            grid-template-columns: 1fr 1fr;
            gap: 40px;
          }
        }

        .pd-gallery {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .pd-main-img {
          position: relative;
          aspect-ratio: 1/1;
          background: #f7f5f2;
          border-radius: 16px;
          overflow: hidden;
        }
        .pd-main-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pd-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(0,0,0,0.4);
          color: white;
          border: none;
          font-size: 20px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .pd-nav:hover { background: rgba(0,0,0,0.6); }
        .pd-nav-prev { left: 10px; }
        .pd-nav-next { right: 10px; }

        .pd-counter {
          position: absolute;
          bottom: 12px;
          right: 12px;
          background: rgba(0,0,0,0.5);
          color: white;
          font-size: 11px;
          padding: 3px 10px;
          border-radius: 12px;
        }

        .pd-thumbs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .pd-thumbs::-webkit-scrollbar { display: none; }

        .pd-thumb {
          width: 56px;
          height: 56px;
          flex-shrink: 0;
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          opacity: 0.5;
          transition: all 0.2s;
        }
        .pd-thumb.active {
          border-color: #111;
          opacity: 1;
        }
        .pd-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pd-title {
          font-size: 20px;
          font-weight: 600;
          color: #111;
          margin: 0 0 6px;
        }
        @media (min-width: 768px) {
          .pd-title { font-size: 26px; }
        }

        .pd-price {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin: 8px 0 4px;
        }
        .pd-old {
          font-size: 14px;
          color: #bbb;
          text-decoration: line-through;
        }
        .pd-current {
          font-size: 24px;
          font-weight: 700;
          color: #111;
        }
        .pd-discount {
          background: #e53935;
          color: white;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 10px;
          border-radius: 20px;
        }

        .pd-rating {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 6px 0 10px;
        }
        .stars {
          display: flex;
          gap: 2px;
        }
        .star {
          width: 16px;
          height: 16px;
        }
        .star.full { fill: #ffc107; color: #ffc107; }
        .star.half { fill: #ffc107; color: #ffc107; clip-path: inset(0 50% 0 0); }
        .star.empty { fill: #e0e0e0; color: #e0e0e0; }
        .pd-rating-text {
          font-size: 12px;
          color: #888;
        }

        .pd-stock {
          font-size: 13px;
          font-weight: 500;
          margin: 8px 0;
        }

        .pd-option {
          margin: 16px 0;
          padding: 4px 0;
          border-radius: 10px;
          transition: all 0.3s;
        }
        .pd-option.error {
          background: #fef2f2;
          padding: 10px;
          margin: 10px -10px 16px;
          animation: shake 0.4s;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        .pd-option-label {
          font-size: 12px;
          font-weight: 600;
          color: #333;
          margin: 0 0 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pd-option-label span {
          color: #111;
          text-transform: none;
          font-weight: 600;
        }

        .pd-colors {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
        }

        .pd-color {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
        }
        .pd-color.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pd-swatch {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.08);
          transition: all 0.2s;
        }
        .pd-color.active .pd-swatch {
          box-shadow: 0 0 0 2px #fff, 0 0 0 4px #111;
        }
        .pd-color-label {
          font-size: 10px;
          color: #666;
          font-weight: 500;
        }
        .pd-color.active .pd-color-label {
          color: #111;
        }

        .pd-sizes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .pd-size {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1.5px solid #e8e3dc;
          background: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pd-size.active {
          background: #111;
          border-color: #111;
          color: white;
        }
        .pd-size.disabled {
          color: #ccc;
          border-color: #eee;
          text-decoration: line-through;
          cursor: not-allowed;
        }

        .pd-error {
          color: #e53935;
          font-size: 12px;
          font-weight: 500;
          margin: 8px 0 0;
        }

        .pd-cart-indicator {
          font-size: 13px;
          font-weight: 500;
          color: #111;
          margin: 8px 0;
        }

        .pd-details {
          margin-top: 16px;
          border-top: 1px solid #f0ede8;
          padding-top: 14px;
        }

        .pd-details-btn {
          display: flex;
          justify-content: space-between;
          width: 100%;
          padding: 8px 0;
          background: none;
          border: none;
          font-size: 14px;
          font-weight: 600;
          color: #111;
          cursor: pointer;
        }
        .pd-details-btn span { font-size: 12px; transition: transform 0.3s; }
        .pd-details-btn.open span { transform: rotate(180deg); }

        .pd-details-content {
          color: #666;
          font-size: 13px;
          line-height: 1.7;
          margin-top: 8px;
        }
        .pd-details-content p { margin: 0 0 10px; }
        .pd-details-content ul { padding-left: 18px; margin: 0 0 10px; }

        .pd-section-header {
          margin: 32px 0 16px;
        }
        .pd-section-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin: 0;
        }
        .pd-section-header p {
          font-size: 12px;
          color: #888;
          margin: 4px 0 0;
        }

        .pd-related-carousel-wrapper {
          position: relative;
        }

        .pd-related-carousel {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          scroll-behavior: smooth;
          scrollbar-width: none;
          padding: 4px 0;
        }
        .pd-related-carousel::-webkit-scrollbar { display: none; }

        .pd-related-item {
          flex: 0 0 160px;
        }
        @media (min-width: 640px) {
          .pd-related-item { flex: 0 0 180px; }
        }
        @media (min-width: 768px) {
          .pd-related-item { flex: 0 0 200px; }
        }

        .pd-carousel-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: white;
          border: 1px solid #e8e3dc;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          transition: all 0.2s;
          z-index: 2;
        }
        .pd-carousel-nav:hover {
          background: #111;
          color: white;
          border-color: #111;
        }
        .pd-carousel-prev { left: -8px; }
        .pd-carousel-next { right: -8px; }
        @media (max-width: 640px) {
          .pd-carousel-nav { display: none; }
        }

        .pd-reviews {
          border-top: 1px solid #f0ede8;
          padding-top: 8px;
          margin-top: 8px;
        }

        .pd-floating {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          gap: 10px;
          padding: 10px 16px;
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(10px);
          border-top: 1px solid #eee;
          z-index: 100;
        }

        .pd-btn-cart, .pd-btn-buy {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 40px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pd-btn-cart {
          background: #f5f5f5;
          color: #111;
        }
        .pd-btn-cart:hover { background: #e8e8e8; }
        .pd-btn-buy {
          background: #111;
          color: white;
        }
        .pd-btn-buy:hover { background: #333; }
      `}</style>
    </>
  );
};

export default ProductDetails;