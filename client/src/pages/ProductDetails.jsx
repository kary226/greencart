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
    
    // États pour les erreurs inline
    const [colorError, setColorError] = useState('')
    const [sizeError, setSizeError] = useState('')
    const [highlightColor, setHighlightColor] = useState(false)
    const [highlightSize, setHighlightSize] = useState(false)
    
    // Pour le swipe sur l'image principale
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);
    
    const [averageRating, setAverageRating] = useState(4);
    const [totalReviews, setTotalReviews] = useState(0);

    const product = products.find((item)=> item._id === id);

    // Faire défiler automatiquement la miniature correspondante
    useEffect(() => {
        if (scrollContainerRef.current && thumbnailRefs.current[currentImageIndex]) {
            thumbnailRefs.current[currentImageIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }, [currentImageIndex]);

    // Récupérer la variante par défaut (première couleur disponible)
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

    // Mettre à jour variantData quand la couleur change
    useEffect(() => {
        if (product && product.variants && selectedColor) {
            const variant = product.variants.find(v => v.color === selectedColor)
            if (variant) {
                setVariantData(variant)
                const startIndex = variant.startImageIndex || 0
                setCurrentImageIndex(startIndex)
                // Effacer l'erreur et le highlight quand une couleur est sélectionnée
                setColorError('')
                setHighlightColor(false)
            }
        }
    }, [selectedColor, product])

    // Effacer l'erreur de taille quand une taille est sélectionnée
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

    // Gestion du swipe sur l'image principale
    const handleTouchStart = (e) => {
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const diff = touchStart - touchEnd;
        if (diff > 50) {
            setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
        }
        if (diff < -50) {
            setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
        }
        setTouchStart(0);
        setTouchEnd(0);
    };

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

    const scrollImages = (direction) => {
        if (scrollContainerRef.current) {
            const scrollAmount = direction === 'left' ? -120 : 120;
            scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
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
                        <div 
                            className="main-image-container"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <img src={allImages[currentImageIndex]} alt={product.name} className="main-image" />
                        </div>
                        
                        {allImages.length > 1 && (
                            <div className="thumbnail-carousel">
                                <button onClick={() => scrollImages('left')} className="carousel-nav carousel-prev">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M15 18l-6-6 6-6"/>
                                    </svg>
                                </button>
                                
                                <div className="thumbnail-scroll" ref={scrollContainerRef}>
                                    {allImages.map((img, idx) => (
                                        <div 
                                            key={idx} 
                                            ref={el => thumbnailRefs.current[idx] = el}
                                            onClick={() => setCurrentImageIndex(idx)}
                                            className={`thumbnail-item ${currentImageIndex === idx ? 'active' : ''}`}
                                        >
                                            <img src={img} alt={`${product.name} - vue ${idx + 1}`} />
                                        </div>
                                    ))}
                                </div>
                                
                                <button onClick={() => scrollImages('right')} className="carousel-nav carousel-next">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 18l6-6-6-6"/>
                                    </svg>
                                </button>
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

                        {uniqueColors.length > 0 && (
                            <div 
                                ref={colorSectionRef}
                                className={`option-group ${highlightColor ? 'highlight-error' : ''}`}
                            >
                                <p className="option-label">
                                    Couleur : <span style={{color: variantData?.colorCode}}>{selectedColor || 'Non sélectionnée'}</span>
                                </p>
                                <div className="colors-buttons">
                                    {uniqueColors.map((color, i) => {
                                        const variant = product.variants.find(v => v.color === color)
                                        const isAvailable = variant?.stock > 0
                                        const isSelected = selectedColor === color
                                        return (
                                            <button 
                                                key={i} 
                                                onClick={() => handleColorSelect(color)}
                                                disabled={!isAvailable}
                                                className={`color-btn ${!isAvailable ? 'disabled' : isSelected ? 'active' : ''}`}
                                                style={{backgroundColor: variant?.colorCode || '#000000'}}
                                                title={color}
                                            >
                                                {!isAvailable && <span className="out-of-strip"></span>}
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="color-names">
                                    {uniqueColors.map((color, i) => {
                                        const isSelected = selectedColor === color
                                        return (
                                            <span 
                                                key={i} 
                                                className={`color-name ${isSelected ? 'active' : ''}`}
                                                onClick={() => handleColorSelect(color)}
                                            >
                                                {color}
                                            </span>
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
                                className={`option-group ${highlightSize ? 'highlight-error' : ''}`}
                            >
                                <p className="option-label">
                                    Taille : <span>{selectedSize || 'Non sélectionnée'}</span>
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

                        <div className="product-description">
                            <p className="desc-title">À propos du produit</p>
                            <ul>
                                {product.description.map((desc, index) => (
                                    <li key={index}>{desc}</li>
                                ))}
                            </ul>
                        </div>

                        {currentQty > 0 && (
                            <p className="cart-indicator">
                                {currentQty} article(s) déjà dans le panier
                            </p>
                        )}
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
                    gap: 10px;
                }

                .main-image-container {
                    width: 100%;
                    aspect-ratio: 1/1;
                    max-height: 380px;
                    background: #f5f3f0;
                    border-radius: 16px;
                    overflow: hidden;
                    cursor: grab;
                }

                .main-image-container:active {
                    cursor: grabbing;
                }

                .main-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    pointer-events: none;
                }

                .thumbnail-carousel {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .carousel-nav {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background: white;
                    border: 1px solid #e8e3dc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .carousel-nav:hover {
                    background: #111;
                    color: white;
                    border-color: #111;
                }

                .thumbnail-scroll {
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    scroll-behavior: smooth;
                    scrollbar-width: thin;
                    flex: 1;
                }

                .thumbnail-scroll::-webkit-scrollbar {
                    height: 2px;
                }

                .thumbnail-scroll::-webkit-scrollbar-track {
                    background: #f0ede8;
                    border-radius: 10px;
                }

                .thumbnail-scroll::-webkit-scrollbar-thumb {
                    background: #ccc;
                    border-radius: 10px;
                }

                .thumbnail-item {
                    width: 55px;
                    height: 55px;
                    flex-shrink: 0;
                    border-radius: 10px;
                    overflow: hidden;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.2s;
                }

                .thumbnail-item.active {
                    border-color: #111;
                }

                .thumbnail-item:hover {
                    transform: scale(1.02);
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
                    font-size: 18px;
                    font-weight: 600;
                    color: #111;
                    margin-bottom: 6px;
                    line-height: 1.3;
                }

                @media (min-width: 768px) {
                    .product-title {
                        font-size: 24px;
                    }
                }

                .product-rating {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 10px;
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

                .product-pricing-vertical {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    margin-bottom: 8px;
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
                    font-size: 22px;
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
                    margin-bottom: 12px;
                }

                .text-red-500 { color: #e53935; }
                .text-orange-500 { color: #ff9800; }
                .text-green-600 { color: #4caf50; }

                .option-group {
                    margin-bottom: 14px;
                    transition: all 0.3s ease;
                }

                .option-group.highlight-error {
                    background: #fef2f2;
                    border-radius: 12px;
                    padding: 8px;
                    margin: -8px -8px 14px -8px;
                    animation: shake 0.5s ease-in-out;
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }

                .option-label {
                    font-size: 13px;
                    font-weight: 500;
                    margin-bottom: 8px;
                    color: #333;
                }

                .option-label span {
                    color: #111;
                    font-weight: 600;
                }

                .colors-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 8px;
                }

                .color-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 2px solid #e8e3dc;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }

                .color-btn.active {
                    border-color: #111;
                    transform: scale(1.1);
                    box-shadow: 0 0 0 2px white, 0 0 0 4px #111;
                }

                .color-btn:hover:not(.disabled) {
                    transform: scale(1.05);
                    border-color: #111;
                }

                .color-btn.disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                    position: relative;
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

                .color-names {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .color-name {
                    font-size: 12px;
                    color: #888;
                    cursor: pointer;
                    transition: color 0.2s;
                }

                .color-name:hover {
                    color: #111;
                }

                .color-name.active {
                    color: #111;
                    font-weight: 600;
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

                .cart-indicator {
                    font-size: 12px;
                    color: #111;
                    font-weight: 500;
                    margin-top: 10px;
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