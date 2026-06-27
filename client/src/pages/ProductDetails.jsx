import { useEffect, useState, useRef } from "react";
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
  
  // États
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [variantData, setVariantData] = useState(null);
  const [colorError, setColorError] = useState('');
  const [sizeError, setSizeError] = useState('');
  const [highlightColor, setHighlightColor] = useState(false);
  const [highlightSize, setHighlightSize] = useState(false);
  const [showRelatedPrev, setShowRelatedPrev] = useState(false);
  const [showRelatedNext, setShowRelatedNext] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [averageRating, setAverageRating] = useState(4);
  const [totalReviews, setTotalReviews] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [reviewsKey, setReviewsKey] = useState(0);

  // Refs
  const scrollContainerRef = useRef(null);
  const thumbnailRefs = useRef([]);
  const colorSectionRef = useRef(null);
  const sizeSectionRef = useRef(null);
  const relatedCarouselRef = useRef(null);

  const product = products.find((item) => item._id === id);

  // --- Logique métier inchangée ---
  // (tous les useEffect et fonctions restent identiques)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current && thumbnailRefs.current[currentImageIndex]) {
      thumbnailRefs.current[currentImageIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentImageIndex]);

  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      const defaultVariant = product.variants[0];
      setSelectedColor(defaultVariant.color);
      setVariantData(defaultVariant);
      setCurrentImageIndex(defaultVariant.startImageIndex || 0);
    } else {
      setVariantData(null);
      setCurrentImageIndex(0);
    }
  }, [product]);

  useEffect(() => {
    if (product && product.variants && selectedColor) {
      const variant = product.variants.find(v => v.color === selectedColor);
      if (variant) {
        setVariantData(variant);
        setCurrentImageIndex(variant.startImageIndex || 0);
        setColorError('');
        setHighlightColor(false);
      }
    }
  }, [selectedColor, product]);

  useEffect(() => {
    if (product && product.variants && selectedColor && selectedSize) {
      const exactVariant = product.variants.find(v =>
        v.color === selectedColor && v.size === selectedSize
      );
      if (exactVariant) setVariantData(exactVariant);
    } else if (product && product.variants && selectedColor) {
      const colorVariant = product.variants.find(v => v.color === selectedColor);
      if (colorVariant) setVariantData(colorVariant);
    }
  }, [selectedColor, selectedSize, product]);

  useEffect(() => {
    if (selectedSize) {
      setSizeError('');
      setHighlightSize(false);
    }
  }, [selectedSize]);

  useEffect(() => {
    if (product) {
      addToRecentlyViewed(product);
      setReviewsKey(prev => prev + 1);
    }
  }, [product]);

  const checkRelatedScroll = () => {
    if (relatedCarouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = relatedCarouselRef.current;
      setShowRelatedPrev(scrollLeft > 20);
      setShowRelatedNext(scrollLeft + clientWidth < scrollWidth - 20);
    }
  };

  const scrollRelated = (direction) => {
    if (relatedCarouselRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      relatedCarouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkRelatedScroll, 300);
    }
  };

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setTouchStart(0);
      setTouchEnd(0);
      return;
    }
    const diff = touchStart - touchEnd;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentImageIndex < allImages.length - 1) {
        setCurrentImageIndex(currentImageIndex + 1);
      } else if (diff < 0 && currentImageIndex > 0) {
        setCurrentImageIndex(currentImageIndex - 1);
      }
    }
    setTouchStart(0);
    setTouchEnd(0);
  };

  const goToPrevImage = () => {
    setCurrentImageIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1);
  };

  const goToNextImage = () => {
    setCurrentImageIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1);
  };

  const getProductCategory = () => {
    if (product?.categories && product.categories.length > 0) {
      return product.categories[0];
    }
    return product?.category;
  };

  const getProductDescription = () => {
    if (!product?.description) return '';
    if (Array.isArray(product.description)) {
      return product.description.join(' ');
    }
    return product.description.replace(/<[^>]*>/g, '');
  };

  const uniqueColors = product && product.variants ? [...new Set(product.variants.map(v => v.color).filter(Boolean))] : [];
  const uniqueSizes = product && product.variants ? [...new Set(product.variants.map(v => v.size).filter(Boolean))] : [];
  const allImages = product?.image || [];

  const currentPrice = variantData?.price || product?.price;
  const currentOfferPrice = variantData?.offerPrice || product?.offerPrice;
  const currentStock = variantData?.stock ?? product?.stock ?? 0;

  const getVariantStock = () => {
    if (!product?.variants?.length) return product?.inStock ? product?.stock : 0;
    const variant = product.variants.find(v =>
      (selectedColor ? v.color === selectedColor : !v.color) &&
      (selectedSize ? v.size === selectedSize : !v.size)
    );
    return variant ? variant.stock : 0;
  };

  const isSizeAvailable = (size) => {
    if (!selectedColor) {
      return product.variants.some(v => v.size === size && v.stock > 0);
    }
    const variant = product.variants.find(v => v.color === selectedColor && v.size === size);
    return variant ? variant.stock > 0 : false;
  };

  const variantStock = getVariantStock();
  const cartKey = getCartKey(product?._id, selectedColor, selectedSize);
  const currentQty = cartItems[cartKey] || 0;

  const getStockLabel = (stock) => {
    if (stock === null || stock === undefined) return null;
    if ((uniqueColors.length > 0 && !selectedColor) || (uniqueSizes.length > 0 && !selectedSize)) return null;
    if (stock === 0) return 'Rupture de stock';
    if (stock <= 5) return `Plus que ${stock} en stock`;
    return `En stock (${stock})`;
  };

  const getStockColor = (stock) => {
    if (stock === null || stock === undefined) return '';
    if (stock === 0) return '#e53935';
    if (stock <= 5) return '#ff9800';
    return '#4caf50';
  };

  const scrollToElement = (ref, setHighlight) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlight(true);
      setTimeout(() => setHighlight(false), 1500);
    }
  };

  const validateAndProceed = (action) => {
    let hasError = false;
    if (uniqueColors.length > 0 && !selectedColor) {
      setColorError('Choisissez une couleur');
      scrollToElement(colorSectionRef, setHighlightColor);
      hasError = true;
    }
    if (!hasError && uniqueSizes.length > 0 && !selectedSize) {
      setSizeError('Choisissez une taille');
      scrollToElement(sizeSectionRef, setHighlightSize);
      hasError = true;
    }
    if (hasError) return false;
    if (variantStock !== null && variantStock === 0) {
      toast.error('Épuisé');
      return false;
    }
    if (variantStock !== null && currentQty >= variantStock) {
      toast.error(`Stock limité à ${variantStock}`);
      return false;
    }
    return true;
  };

  const handleAddToCart = () => {
    if (validateAndProceed('add')) {
      addToCart(product._id, selectedColor, selectedSize);
      toast.success('Ajouté au panier');
    }
  };

  const handleBuyNow = () => {
    if (validateAndProceed('buy')) {
      addToCart(product._id, selectedColor, selectedSize);
      navigate("/cart");
    }
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const decimal = rating % 1;
    const hasHalfStar = decimal >= 0.5;
    return (
      <div className="pd-stars">
        {[...Array(5)].map((_, i) => {
          if (i < fullStars) {
            return <svg key={i} className="pd-star full" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>;
          } else if (i === fullStars && hasHalfStar) {
            return <svg key={i} className="pd-star half" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" clipPath="url(#half)"/></svg>;
          } else {
            return <svg key={i} className="pd-star empty" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>;
          }
        })}
      </div>
    );
  };

  const handleReviewsData = (data) => {
    setAverageRating(data.averageRating);
    setTotalReviews(data.totalReviews);
  };

  const handleColorSelect = (color) => {
    setSelectedColor(selectedColor === color ? null : color);
    setSelectedSize(null);
  };

  useEffect(() => {
    if (products.length > 0 && product) {
      let productsCopy = products.slice();
      const productCategory = getProductCategory();
      productsCopy = productsCopy.filter((item) => {
        if (item.category) {
          return item.category === productCategory && item._id !== product._id;
        }
        if (item.categories && item.categories.length > 0) {
          return item.categories.includes(productCategory) && item._id !== product._id;
        }
        return false;
      });
      setRelatedProducts(productsCopy.slice(0, 12));
      setTimeout(checkRelatedScroll, 100);
    }
    setSelectedColor(null);
    setSelectedSize(null);
    setCurrentImageIndex(0);
    setAverageRating(4);
    setTotalReviews(0);
    setVariantData(null);
    setColorError('');
    setSizeError('');
    setHighlightColor(false);
    setHighlightSize(false);
    setShowDetails(false);
  }, [products, id]);

  if (!product) return null;

  const discount = currentOfferPrice && currentOfferPrice < currentPrice
    ? Math.round(((currentPrice - currentOfferPrice) / currentPrice) * 100)
    : null;

  return (
    <>
      <SEO
        title={product.name}
        description={getProductDescription().slice(0, 160)}
        keywords={`${product.name}, ${product.category}, vêtements, accessoires`}
        image={allImages[0]}
        url={`https://greencart-ci.vercel.app/products/${getProductCategory()?.toLowerCase()}/${product._id}`}
      />

      <div className="pd-page">
        {/* Fil d'Ariane */}
        <div className="pd-breadcrumb">
          <Link to="/">Accueil</Link> / 
          <Link to="/products">Articles</Link> / 
          <span>{product.name}</span>
        </div>

        <div className="pd-main">
          {/* Galerie */}
          <div className="pd-gallery">
            <div
              className="pd-main-img"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img src={allImages[currentImageIndex]} alt={product.name} />
              {allImages.length > 1 && !isMobile && (
                <>
                  <button className="pd-nav pd-nav-prev" onClick={goToPrevImage}>‹</button>
                  <button className="pd-nav pd-nav-next" onClick={goToNextImage}>›</button>
                </>
              )}
              {allImages.length > 1 && (
                <span className="pd-counter">{currentImageIndex + 1}/{allImages.length}</span>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="pd-dots">
                {allImages.map((_, i) => (
                  <span
                    key={i}
                    className={`pd-dot ${currentImageIndex === i ? 'active' : ''}`}
                    onClick={() => setCurrentImageIndex(i)}
                  />
                ))}
              </div>
            )}

            {allImages.length > 1 && (
              <div className="pd-thumbs" ref={scrollContainerRef}>
                {allImages.map((img, i) => (
                  <div
                    key={i}
                    ref={el => thumbnailRefs.current[i] = el}
                    className={`pd-thumb ${currentImageIndex === i ? 'active' : ''}`}
                    onClick={() => setCurrentImageIndex(i)}
                  >
                    <img src={img} alt="" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Infos */}
          <div className="pd-info">
            <h1 className="pd-title">{product.name}</h1>

            <div className="pd-price">
              {discount && <span className="pd-old">{currentPrice} {currency}</span>}
              <span className="pd-current">{currentOfferPrice && currentOfferPrice < currentPrice ? currentOfferPrice : currentPrice} {currency}</span>
              {discount && <span className="pd-discount">-{discount}%</span>}
            </div>

            <div className="pd-rating">
              {renderStars(averageRating)}
              <span className="pd-rating-text">{averageRating}/5 ({totalReviews} avis)</span>
            </div>

            {getStockLabel(currentStock) && (
              <p className="pd-stock" style={{ color: getStockColor(currentStock) }}>
                {getStockLabel(currentStock)}
              </p>
            )}

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
                        onClick={() => handleColorSelect(color)}
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

            {currentQty > 0 && (
              <p className="pd-cart-indicator">{currentQty} dans le panier</p>
            )}

            <div className="pd-details">
              <button
                className={`pd-details-btn ${showDetails ? 'open' : ''}`}
                onClick={() => setShowDetails(!showDetails)}
              >
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
              <p>Vous pourriez aussi aimer</p>
            </div>
            <div className="pd-carousel-wrapper">
              {showRelatedPrev && (
                <button className="pd-carousel-nav pd-carousel-prev" onClick={() => scrollRelated('left')}>‹</button>
              )}
              <div className="pd-carousel" ref={relatedCarouselRef} onScroll={checkRelatedScroll}>
                {relatedProducts.filter(p => p.inStock).map(p => (
                  <div key={p._id} className="pd-carousel-item">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
              {showRelatedNext && (
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
          <ProductReviews productId={product._id} onDataChange={handleReviewsData} key={reviewsKey} />
        </div>

        <RecentlyViewed key={reviewsKey} />

        {/* Barre flottante */}
        <div className="pd-floating">
          <button className="pd-btn-cart" onClick={handleAddToCart}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            Ajouter
          </button>
          <button className="pd-btn-buy" onClick={handleBuyNow}>Acheter</button>
        </div>
      </div>

      <style>{`
        /* ============================================
           PRODUCT DETAILS - STYLE SHEIN
           ============================================ */

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

        /* Galerie */
        .pd-gallery {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .pd-main-img {
          position: relative;
          aspect-ratio: 1/1;
          background: #f7f5f2;
          border-radius: 0;
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
          font-size: 22px;
          cursor: pointer;
          transition: background 0.2s;
          z-index: 2;
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

        .pd-dots {
          display: flex;
          justify-content: center;
          gap: 6px;
        }
        .pd-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ddd;
          cursor: pointer;
          transition: all 0.3s;
        }
        .pd-dot.active {
          background: #111;
          width: 20px;
          border-radius: 4px;
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
          border-radius: 0;
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

        /* Infos */
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
        .pd-stars {
          display: flex;
          gap: 2px;
        }
        .pd-star {
          width: 16px;
          height: 16px;
        }
        .pd-star.full { fill: #ffc107; color: #ffc107; }
        .pd-star.half { fill: #ffc107; color: #ffc107; clip-path: inset(0 50% 0 0); }
        .pd-star.empty { fill: #e0e0e0; color: #e0e0e0; }
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
          min-width: 40px;
          height: 40px;
          padding: 0 12px;
          border-radius: 6px;
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

        /* Sections */
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

        /* Carrousel */
        .pd-carousel-wrapper {
          position: relative;
        }

        .pd-carousel {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          scroll-behavior: smooth;
          scrollbar-width: none;
          padding: 4px 0;
        }
        .pd-carousel::-webkit-scrollbar { display: none; }

        .pd-carousel-item {
          flex: 0 0 160px;
        }
        @media (min-width: 640px) {
          .pd-carousel-item { flex: 0 0 180px; }
        }
        @media (min-width: 768px) {
          .pd-carousel-item { flex: 0 0 200px; }
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

        /* Barre flottante */
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
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
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

        /* ============================================
           FIN PRODUCT DETAILS
           ============================================ */
      `}</style>
    </>
  );
};

export default ProductDetails;