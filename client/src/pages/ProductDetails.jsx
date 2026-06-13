import { useEffect, useState, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { Link, useParams } from "react-router-dom";
import { assets } from "../assets/assets";
import ProductCard from "../components/ProductCard";
import ProductReviews from "../components/ProductReviews";
import toast from "react-hot-toast";
import SEO from "../components/SEO";
import RecentlyViewed from "../components/RecentlyViewed";

const ProductDetails = () => {

    const {products, navigate, currency, addToCart, cartItems, getCartKey, addToRecentlyViewed, axios} = useAppContext()
    const {id} = useParams()
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedColor, setSelectedColor] = useState(null)
    const [selectedSize, setSelectedSize] = useState(null)
    const [variantData, setVariantData] = useState(null)
    const scrollContainerRef = useRef(null);
    const thumbnailRefs = useRef([]);
    const colorSectionRef = useRef(null);
    const sizeSectionRef = useRef(null);
    
    const [colorError, setColorError] = useState('')
    const [sizeError, setSizeError] = useState('')
    const [highlightColor, setHighlightColor] = useState(false)
    const [highlightSize, setHighlightSize] = useState(false)
    
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    
    const [averageRating, setAverageRating] = useState(4);
    const [totalReviews, setTotalReviews] = useState(0);

    const product = products.find((item)=> item._id === id);

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
            const defaultVariant = product.variants[0]
            setSelectedColor(defaultVariant.color)
            setVariantData(defaultVariant)
            const startIndex = defaultVariant.startImageIndex || 0
            setCurrentImageIndex(startIndex)
        } else {
            setVariantData(null)
            setCurrentImageIndex(0)
        }
    }, [product])

    useEffect(() => {
        if (product && product.variants && selectedColor) {
            const variant = product.variants.find(v => v.color === selectedColor)
            if (variant) {
                setVariantData(variant)
                const startIndex = variant.startImageIndex || 0
                setCurrentImageIndex(startIndex)
                setColorError('')
                setHighlightColor(false)
            }
        }
    }, [selectedColor, product])

    useEffect(() => {
        if (selectedSize) {
            setSizeError('')
            setHighlightSize(false)
        }
    }, [selectedSize])

    useEffect(() => {
        if (product) {
            addToRecentlyViewed(product);
        }
    }, [product]);

    const getProductCategory = () => {
        if (product?.categories && product.categories.length > 0) {
            return product.categories[0]
        }
        return product?.category
    }

    const getProductDescription = () => {
        if (product?.description && Array.isArray(product.description)) {
            return product.description.join(' ').slice(0, 160)
        }
        return product?.description || ''
    }

    const uniqueColors = product && product.variants ? [...new Set(product.variants.map(v => v.color).filter(Boolean))] : []
    const uniqueSizes = product && product.variants ? [...new Set(product.variants.map(v => v.size).filter(Boolean))] : []

    const allImages = product?.image || []

    const currentPrice = variantData?.price || product?.price
    const currentOfferPrice = variantData?.offerPrice || product?.offerPrice
    const currentStock = variantData?.stock ?? product?.stock ?? 0

    const getVariantStock = () => {
        if (!product?.variants?.length) return product?.inStock ? product?.stock : 0
        const variant = product.variants.find(v =>
            (selectedColor ? v.color === selectedColor : !v.color) &&
            (selectedSize ? v.size === selectedSize : !v.size)
        )
        return variant ? variant.stock : 0
    }

    const isSizeAvailable = (size) => {
        if (!selectedColor) {
            return product.variants.some(v => v.size === size && v.stock > 0)
        }
        const variant = product.variants.find(v => v.color === selectedColor && v.size === size)
        return variant ? variant.stock > 0 : false
    }

    const isColorAvailable = (color) => {
        if (!selectedSize) {
            return product.variants.some(v => v.color === color && v.stock > 0)
        }
        const variant = product.variants.find(v => v.color === color && v.size === selectedSize)
        return variant ? variant.stock > 0 : false
    }

    const variantStock = getVariantStock()
    const cartKey = getCartKey(product?._id, selectedColor, selectedSize)
    const currentQty = cartItems[cartKey] || 0

    const getStockLabel = (stock) => {
        if (stock === null || stock === undefined) return null
        if (stock === 0) return 'Rupture de stock'
        if (stock <= 5) return `Plus que ${stock} en stock`
        return `En stock (${stock} disponibles)`
    }

    const getStockColor = (stock) => {
        if (stock === null || stock === undefined) return ''
        if (stock === 0) return 'text-red-500'
        if (stock <= 5) return 'text-orange-500'
        return 'text-green-600'
    }

    const scrollToElement = (ref, setHighlight) => {
        if (ref.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setHighlight(true)
            setTimeout(() => setHighlight(false), 1500)
        }
    }

    const validateAndProceed = (action) => {
        let hasError = false
        
        if (uniqueColors.length > 0 && !selectedColor) {
            setColorError('Veuillez choisir une couleur')
            scrollToElement(colorSectionRef, setHighlightColor)
            hasError = true
        }
        
        if (!hasError && uniqueSizes.length > 0 && !selectedSize) {
            setSizeError('Veuillez choisir une taille')
            scrollToElement(sizeSectionRef, setHighlightSize)
            hasError = true
        }
        
        if (hasError) return false
        
        if (variantStock !== null && variantStock === 0) {
            toast.error('Ce variant est épuisé')
            return false
        }
        
        if (variantStock !== null && currentQty >= variantStock) {
            toast.error(`Stock limité à ${variantStock} unités`)
            return false
        }
        
        return true
    }

    const handleAddToCart = () => {
        if (validateAndProceed('add')) {
            addToCart(product._id, selectedColor, selectedSize)
            toast.success('Ajouté au panier')
        }
    }

    const handleBuyNow = () => {
        if (validateAndProceed('buy')) {
            addToCart(product._id, selectedColor, selectedSize)
            navigate("/cart")
        }
    }

    const isOutOfStock = variantStock === 0;

    // --- Gestion du swipe avec aperçu des images voisines ---
    const handleTouchStart = (e) => {
        setTouchStart(e.targetTouches[0].clientX);
        setTouchEnd(e.targetTouches[0].clientX);
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        const currentX = e.targetTouches[0].clientX;
        setTouchEnd(currentX);
        let offset = currentX - touchStart;

        // Empêche de glisser au-delà de la première/dernière image
        if (currentImageIndex === 0 && offset > 0) offset = offset * 0.3;
        if (currentImageIndex === allImages.length - 1 && offset < 0) offset = offset * 0.3;

        setDragOffset(offset);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) {
            setIsDragging(false);
            setDragOffset(0);
            return;
        }
        const diff = touchStart - touchEnd;
        const threshold = 50;

        if (diff > threshold && currentImageIndex < allImages.length - 1) {
            setCurrentImageIndex((prev) => prev + 1);
        } else if (diff < -threshold && currentImageIndex > 0) {
            setCurrentImageIndex((prev) => prev - 1);
        }

        setIsDragging(false);
        setDragOffset(0);
        setTouchStart(0);
        setTouchEnd(0);
    };

    const renderStars = (rating) => {
        const fullStars = Math.floor(rating);
        const decimal = rating % 1;
        const hasHalfStar = decimal >= 0.5;
        
        return (
            <div className="stars-container">
                {[...Array(5)].map((_, i) => {
                    if (i < fullStars) {
                        return (
                            <svg key={i} className="star star-full" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                            </svg>
                        );
                    } else if (i === fullStars && hasHalfStar) {
                        return (
                            <svg key={i} className="star star-half" viewBox="0 0 24 24" fill="currentColor">
                                <defs>
                                    <clipPath id="halfStarClip">
                                        <rect x="0" y="0" width="12" height="24"/>
                                    </clipPath>
                                </defs>
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" clipPath="url(#halfStarClip)"/>
                            </svg>
                        );
                    } else {
                        return (
                            <svg key={i} className="star star-empty" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                            </svg>
                        );
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
        setSelectedColor(selectedColor === color ? null : color)
        setSelectedSize(null)
    }

    useEffect(()=>{
        if(products.length > 0 && product){
            let productsCopy = products.slice();
            const productCategory = getProductCategory()
            productsCopy = productsCopy.filter((item) => {
                if (item.category) {
                    return item.category === productCategory && item._id !== product._id
                }
                if (item.categories && item.categories.length > 0) {
                    return item.categories.includes(productCategory) && item._id !== product._id
                }
                return false
            })
            setRelatedProducts(productsCopy.slice(0,5))
        }
        setSelectedColor(null)
        setSelectedSize(null)
        setCurrentImageIndex(0)
        setAverageRating(4);
        setTotalReviews(0);
        setVariantData(null)
        setColorError('')
        setSizeError('')
        setHighlightColor(false)
        setHighlightSize(false)
    },[products, id])

    if (!product) return null;

    return (
        <>
            <SEO 
                title={product.name}
                description={getProductDescription()}
                keywords={`${product.name}, ${product.category}, vêtements, accessoires, Ramci, Côte d'Ivoire, Abidjan`}
                image={allImages[0]}
                url={`https://greencart-ci.vercel.app/products/${getProductCategory()?.toLowerCase()}/${product._id}`}
            />
            
            <div className="product-details-page">
                <div className="breadcrumb-container">
                    <Link to={"/"}>Accueil</Link> /
                    <Link to={"/products"}> Articles</Link> /
                    <Link to={`/products/${getProductCategory()?.toLowerCase()}`}> {getProductCategory()}</Link> /
                    <span className="current">{product.name}</span>
                </div>

                <div className="product-main">
                    <div className="product-gallery">
                        {/* Carrousel "peek" : on aperçoit un bout des images voisines */}
                        <div 
                            className="main-image-container"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div 
                                className="image-track"
                                style={{
                                    transform: `translateX(calc(${-currentImageIndex * 100}% + ${currentImageIndex * 24}px + ${dragOffset}px))`,
                                    transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)'
                                }}
                            >
                                {allImages.map((img, idx) => (
                                    <div className="image-slide" key={idx}>
                                        <img src={img} alt={`${product.name} - vue ${idx + 1}`} draggable="false" />
                                    </div>
                                ))}
                            </div>

                            {allImages.length > 1 && (
                                <div className="image-counter">
                                    {currentImageIndex + 1} / {allImages.length}
                                </div>
                            )}
                        </div>

                        {/* Indicateurs de pagination (points) */}
                        {allImages.length > 1 && (
                            <div className="image-dots">
                                {allImages.map((_, idx) => (
                                    <span 
                                        key={idx} 
                                        className={`dot ${currentImageIndex === idx ? 'active' : ''}`}
                                        onClick={() => setCurrentImageIndex(idx)}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* Miniatures sans flèches de navigation */}
                        {allImages.length > 1 && (
                            <div className="thumbnail-scroll" ref={scrollContainerRef}>
                                {allImages.map((img, idx) => (
                                    <div 
                                        key={idx} 
                                        ref={el => thumbnailRefs.current[idx] = el}
                                        onClick={() => setCurrentImageIndex(idx)}
                                        className={`thumbnail-item ${currentImageIndex === idx ? 'active' : ''}`}
                                    >
                                        <img src={img} alt={`${product.name} - miniature ${idx + 1}`} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="product-info">
                        <h1 className="product-title">{product.name}</h1>

                        <div className="product-rating">
                            {renderStars(averageRating)}
                            <span className="rating-value">{averageRating}/5</span>
                            <span className="rating-count">({totalReviews} avis)</span>
                        </div>

                        <div className="essential-info">
                            <div className="product-pricing-vertical">
                                {currentOfferPrice && currentOfferPrice < currentPrice && (
                                    <div className="old-price-vertical">{currentPrice} {currency}</div>
                                )}
                                <div className="price-row">
                                    <span className="current-price-vertical">
                                        {currentOfferPrice && currentOfferPrice < currentPrice ? currentOfferPrice : currentPrice} {currency}
                                    </span>
                                    {currentOfferPrice && currentOfferPrice < currentPrice && (
                                        <span className="discount-badge">-{Math.round(((currentPrice - currentOfferPrice) / currentPrice) * 100)}%</span>
                                    )}
                                </div>
                            </div>

                            <p className={`stock-info ${getStockColor(currentStock)}`}>
                                {getStockLabel(currentStock)}
                            </p>

                            {/* Section couleurs redessinée : grille de cartes avec pastille + libellé clairement séparés */}
                            {uniqueColors.length > 0 && (
                                <div 
                                    ref={colorSectionRef}
                                    className={`option-group ${highlightColor ? 'highlight-error' : ''}`}
                                >
                                    <p className="option-label">
                                        Couleur
                                        {selectedColor && <span className="option-value"> — {selectedColor}</span>}
                                    </p>
                                    <div className="color-grid">
                                        {uniqueColors.map((color, i) => {
                                            const variant = product.variants.find(v => v.color === color)
                                            const isAvailable = variant?.stock > 0
                                            const isSelected = selectedColor === color
                                            return (
                                                <button 
                                                    key={i} 
                                                    onClick={() => handleColorSelect(color)}
                                                    disabled={!isAvailable}
                                                    className={`color-chip ${!isAvailable ? 'disabled' : isSelected ? 'active' : ''}`}
                                                    title={color}
                                                >
                                                    <span 
                                                        className="color-swatch" 
                                                        style={{backgroundColor: variant?.colorCode || '#000000'}}
                                                    >
                                                        {!isAvailable && <span className="out-of-strip"></span>}
                                                    </span>
                                                    <span className="color-chip-label">{color}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {colorError && (
                                        <div className="error-message">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"/>
                                                <line x1="12" y1="8" x2="12" y2="12"/>
                                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                                            </svg>
                                            <span>{colorError}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {uniqueSizes.length > 0 && (
                                <div 
                                    ref={sizeSectionRef}
                                    className={`option-group option-group-last ${highlightSize ? 'highlight-error' : ''}`}
                                >
                                    <p className="option-label">
                                        Taille
                                        {selectedSize && <span className="option-value"> — {selectedSize}</span>}
                                    </p>
                                    <div className="sizes-buttons">
                                        {uniqueSizes.map((size, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                                                disabled={!isSizeAvailable(size)}
                                                className={`size-btn ${!isSizeAvailable(size) ? 'disabled' : selectedSize === size ? 'active' : ''}`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                    {sizeError && (
                                        <div className="error-message">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"/>
                                                <line x1="12" y1="8" x2="12" y2="12"/>
                                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                                            </svg>
                                            <span>{sizeError}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentQty > 0 && (
                                <p className="cart-indicator">
                                    {currentQty} article(s) déjà dans le panier
                                </p>
                            )}
                        </div>

                        <div className="product-description">
                            <p className="desc-title">À propos du produit</p>
                            <ul>
                                {product.description.map((desc, index) => (
                                    <li key={index}>{desc}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="related-section">
                    <div className="section-header">
                        <p className="section-title">Articles similaires</p>
                        <div className="title-underline"></div>
                    </div>
                    <div className="related-grid">
                        {relatedProducts.filter((product)=>product.inStock).map((product, index)=>(
                            <ProductCard key={index} product={product}/>
                        ))}
                    </div>
                    <button onClick={()=> {navigate('/products'); scrollTo(0,0)}} className="view-more-btn">
                        Voir plus
                    </button>
                </div>

                <ProductReviews 
                    productId={product._id} 
                    onDataChange={handleReviewsData}
                />

                <RecentlyViewed />
            </div>

            <div className="floating-action-bar">
                <div className="floating-buttons">
                    <button 
                        onClick={handleAddToCart}
                        className="floating-btn floating-btn-cart"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <path d="M16 10a4 4 0 0 1-8 0"/>
                        </svg>
                        Ajouter
                    </button>
                    <button 
                        onClick={handleBuyNow}
                        className="floating-btn floating-btn-buy"
                    >
                        Acheter
                    </button>
                </div>
            </div>

            <style>{`
                .product-details-page {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: 12px 12px 65px;
                }

                .breadcrumb-container {
                    margin-bottom: 12px;
                    font-size: 11px;
                    color: #888;
                }
                .breadcrumb-container a {
                    color: #666;
                    text-decoration: none;
                }
                .breadcrumb-container a:hover {
                    color: #111;
                }
                .breadcrumb-container .current {
                    color: #111;
                    font-weight: 500;
                }

                .product-main {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                @media (min-width: 768px) {
                    .product-main {
                        flex-direction: row;
                        gap: 32px;
                    }
                    .product-gallery {
                        flex: 1;
                    }
                    .product-info {
                        flex: 1;
                    }
                }

                .product-gallery {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                /* --- Carrousel principal avec aperçu ("peek") --- */
                .main-image-container {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 1/1;
                    max-height: 420px;
                    overflow: hidden;
                    border-radius: 18px;
                    background: #f5f3f0;
                    cursor: grab;
                    /* On déborde un peu sur les côtés pour laisser apparaître l'image voisine */
                    padding: 0 24px;
                    box-sizing: border-box;
                }

                .main-image-container:active {
                    cursor: grabbing;
                }

                .image-track {
                    display: flex;
                    height: 100%;
                    width: 100%;
                    will-change: transform;
                }

                .image-slide {
                    flex: 0 0 100%;
                    width: 100%;
                    height: 100%;
                    padding: 0 4px;
                    box-sizing: border-box;
                    border-radius: 16px;
                    overflow: hidden;
                }

                .image-slide img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 16px;
                    pointer-events: none;
                    user-select: none;
                }

                .image-counter {
                    position: absolute;
                    bottom: 12px;
                    right: 12px;
                    background: rgba(0,0,0,0.55);
                    color: white;
                    font-size: 11px;
                    font-weight: 500;
                    padding: 4px 10px;
                    border-radius: 20px;
                    backdrop-filter: blur(4px);
                    letter-spacing: 0.02em;
                    pointer-events: none;
                }

                /* Points de pagination */
                .image-dots {
                    display: flex;
                    justify-content: center;
                    gap: 6px;
                }

                .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #e0dcd5;
                    cursor: pointer;
                    transition: all 0.25s ease;
                }

                .dot.active {
                    background: #111;
                    width: 18px;
                    border-radius: 4px;
                }

                /* Miniatures, sans flèches */
                .thumbnail-scroll {
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    scroll-behavior: smooth;
                    scrollbar-width: none;
                }

                .thumbnail-scroll::-webkit-scrollbar {
                    display: none;
                }

                .thumbnail-item {
                    width: 58px;
                    height: 58px;
                    flex-shrink: 0;
                    border-radius: 12px;
                    overflow: hidden;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.2s;
                    opacity: 0.6;
                }

                .thumbnail-item.active {
                    border-color: #111;
                    opacity: 1;
                }

                .thumbnail-item:hover {
                    opacity: 1;
                }

                .thumbnail-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .stars-container {
                    display: flex;
                    gap: 3px;
                    align-items: center;
                }

                .star {
                    width: 15px;
                    height: 15px;
                }

                .star-full {
                    color: #ffc107;
                    fill: #ffc107;
                }

                .star-half {
                    color: #ffc107;
                    fill: #ffc107;
                }

                .star-empty {
                    color: #e0e0e0;
                    stroke: #e0e0e0;
                }

                .product-title {
                    font-size: 19px;
                    font-weight: 600;
                    color: #111;
                    margin-bottom: 6px;
                    line-height: 1.3;
                }

                @media (min-width: 768px) {
                    .product-title {
                        font-size: 26px;
                    }
                }

                .product-rating {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 12px;
                    flex-wrap: wrap;
                }

                .rating-value {
                    font-size: 12px;
                    font-weight: 500;
                    color: #111;
                }

                .rating-count {
                    font-size: 11px;
                    color: #888;
                }

                .essential-info {
                    background: #fafafa;
                    border: 1px solid #f0ede8;
                    border-radius: 16px;
                    padding: 14px 16px;
                    margin-bottom: 14px;
                }

                .product-pricing-vertical {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    margin-bottom: 10px;
                }
                .old-price-vertical {
                    font-size: 13px;
                    color: #bbb;
                    text-decoration: line-through;
                }
                .price-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .current-price-vertical {
                    font-size: 23px;
                    font-weight: 700;
                    color: #111;
                }
                .discount-badge {
                    background: #e53935;
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    padding: 3px 8px;
                    border-radius: 20px;
                }

                .stock-info {
                    font-size: 12px;
                    font-weight: 500;
                    margin-bottom: 14px;
                }

                .text-red-500 { color: #e53935; }
                .text-orange-500 { color: #ff9800; }
                .text-green-600 { color: #4caf50; }

                .option-group {
                    margin-bottom: 14px;
                    transition: all 0.3s ease;
                }

                .option-group-last {
                    margin-bottom: 0;
                }

                .option-group.highlight-error {
                    background: #fef2f2;
                    border-radius: 12px;
                    padding: 10px;
                    margin: -10px -10px 14px -10px;
                    animation: shake 0.5s ease-in-out;
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }

                .option-label {
                    font-size: 12px;
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: #333;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }

                .option-value {
                    color: #111;
                    font-weight: 600;
                    text-transform: none;
                    letter-spacing: normal;
                }

                /* --- Grille de couleurs : pastille + libellé bien séparés --- */
                .color-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
                    gap: 8px;
                }

                .color-chip {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 6px;
                    border-radius: 12px;
                    border: 1.5px solid #e8e3dc;
                    background: white;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .color-chip:hover:not(.disabled) {
                    border-color: #ccc;
                    transform: translateY(-1px);
                }

                .color-chip.active {
                    border-color: #111;
                    background: #111;
                }

                .color-chip.active .color-chip-label {
                    color: white;
                }

                .color-chip.disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .color-swatch {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: 1px solid rgba(0,0,0,0.08);
                    position: relative;
                    flex-shrink: 0;
                }

                .out-of-strip {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 2px;
                    height: 24px;
                    background: #e53935;
                    transform: translate(-50%, -50%) rotate(45deg);
                }

                .color-chip-label {
                    font-size: 11px;
                    font-weight: 500;
                    color: #555;
                    text-align: center;
                    line-height: 1.2;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }

                .sizes-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .size-btn {
                    width: 42px;
                    height: 42px;
                    border-radius: 10px;
                    border: 1.5px solid #e8e3dc;
                    background: white;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .size-btn.active {
                    background: #111;
                    border-color: #111;
                    color: white;
                }

                .size-btn.disabled {
                    color: #ccc;
                    border-color: #eee;
                    text-decoration: line-through;
                    cursor: not-allowed;
                }

                .error-message {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #fef2f2;
                    color: #e53935;
                    font-size: 11px;
                    font-weight: 500;
                    padding: 8px 12px;
                    border-radius: 10px;
                    margin-top: 10px;
                    border: 1px solid #fecaca;
                }

                .error-message svg {
                    flex-shrink: 0;
                }

                .cart-indicator {
                    font-size: 12px;
                    color: #111;
                    font-weight: 500;
                    margin-top: 10px;
                }

                .product-description {
                    margin: 12px 0;
                }

                .desc-title {
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 6px;
                    color: #111;
                }

                .product-description ul {
                    list-style: disc;
                    padding-left: 18px;
                    color: #666;
                    font-size: 12px;
                    line-height: 1.5;
                }

                .product-description li {
                    margin-bottom: 4px;
                }

                .related-section {
                    margin-top: 30px;
                }

                .section-header {
                    text-align: center;
                    margin-bottom: 20px;
                }

                .section-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #111;
                    margin-bottom: 6px;
                }

                .title-underline {
                    width: 50px;
                    height: 2px;
                    background: #111;
                    border-radius: 2px;
                    margin: 0 auto;
                }

                .related-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }

                @media (min-width: 640px) {
                    .related-grid {
                        grid-template-columns: repeat(3, 1fr);
                        gap: 16px;
                    }
                }

                @media (min-width: 1024px) {
                    .related-grid {
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                    }
                }

                .view-more-btn {
                    display: block;
                    margin: 24px auto 0;
                    padding: 10px 24px;
                    border: 1.5px solid #e8e3dc;
                    border-radius: 40px;
                    background: white;
                    font-size: 13px;
                    font-weight: 500;
                    color: #111;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .view-more-btn:hover {
                    background: #111;
                    color: white;
                    border-color: #111;
                }

                .floating-action-bar {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(255,255,255,0.98);
                    backdrop-filter: blur(10px);
                    border-top: 1px solid #eee;
                    padding: 8px 16px;
                    z-index: 1000;
                    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
                }

                .floating-buttons {
                    display: flex;
                    gap: 10px;
                }

                .floating-btn {
                    flex: 1;
                    padding: 10px 12px;
                    border-radius: 40px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }

                .floating-btn-cart {
                    background: #f5f5f5;
                    color: #111;
                }

                .floating-btn-cart:hover:not(:disabled) {
                    background: #e8e8e8;
                    transform: scale(1.02);
                }

                .floating-btn-buy {
                    background: #111;
                    color: white;
                }

                .floating-btn-buy:hover:not(:disabled) {
                    background: #333;
                    transform: scale(1.02);
                }

                .floating-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </>
    );
};

export default ProductDetails;