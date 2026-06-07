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

    const {products, navigate, currency, addToCart, cartItems, getCartKey, addToRecentlyViewed} = useAppContext()
    const {id} = useParams()
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedColor, setSelectedColor] = useState(null)
    const [selectedSize, setSelectedSize] = useState(null)
    const scrollContainerRef = useRef(null);
    
    const [averageRating, setAverageRating] = useState(4);
    const [totalReviews, setTotalReviews] = useState(0);

    const product = products.find((item)=> item._id === id);

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

    const uniqueColors = product ? [...new Set(product.variants?.map(v => v.color).filter(Boolean))] : []
    const uniqueSizes = product ? [...new Set(product.variants?.map(v => v.size).filter(Boolean))] : []

    const getVariantStock = () => {
        if (!product?.variants?.length) return null
        const variant = product.variants.find(v =>
            (selectedColor ? v.color === selectedColor : !v.color) &&
            (selectedSize ? v.size === selectedSize : !v.size)
        ) || product.variants.find(v =>
            (selectedColor ? v.color === selectedColor : true) &&
            (selectedSize ? v.size === selectedSize : true)
        )
        return variant ? variant.stock : null
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

    const handleAddToCart = () => {
        if (uniqueColors.length > 0 && !selectedColor) {
            toast.error('Veuillez choisir une couleur')
            return
        }
        if (uniqueSizes.length > 0 && !selectedSize) {
            toast.error('Veuillez choisir une taille')
            return
        }
        if (variantStock !== null && variantStock === 0) {
            toast.error('Ce variant est épuisé')
            return
        }
        if (variantStock !== null && currentQty >= variantStock) {
            toast.error(`Stock limité à ${variantStock} unités`)
            return
        }
        addToCart(product._id, selectedColor, selectedSize)
        toast.success('Ajouté au panier')
    }

    const handleBuyNow = () => {
        if (uniqueColors.length > 0 && !selectedColor) {
            toast.error('Veuillez choisir une couleur')
            return
        }
        if (uniqueSizes.length > 0 && !selectedSize) {
            toast.error('Veuillez choisir une taille')
            return
        }
        if (variantStock !== null && variantStock === 0) {
            toast.error('Ce variant est épuisé')
            return
        }
        if (variantStock !== null && currentQty >= variantStock) {
            toast.error(`Stock limité à ${variantStock} unités`)
            return
        }
        addToCart(product._id, selectedColor, selectedSize)
        navigate("/cart")
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
    },[products, id])

    if (!product) return null;

    return (
        <>
            <SEO 
                title={product.name}
                description={getProductDescription()}
                keywords={`${product.name}, ${product.category}, vêtements, accessoires, Ramci, Côte d'Ivoire, Abidjan`}
                image={product.image[0]}
                url={`https://greencart-ci.vercel.app/products/${getProductCategory()?.toLowerCase()}/${product._id}`}
            />
            
            <div className="product-details-page pb-28">
                <div className="breadcrumb-container">
                    <Link to={"/"}>Accueil</Link> /
                    <Link to={"/products"}> Articles</Link> /
                    <Link to={`/products/${getProductCategory()?.toLowerCase()}`}> {getProductCategory()}</Link> /
                    <span className="current">{product.name}</span>
                </div>

                <div className="product-main">
                    <div className="product-gallery">
                        <div className="main-image-container">
                            <img src={product.image[currentImageIndex]} alt={product.name} className="main-image" />
                        </div>
                        
                        {product.image.length > 1 && (
                            <div className="thumbnail-carousel">
                                <button onClick={() => scrollImages('left')} className="carousel-nav carousel-prev">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M15 18l-6-6 6-6"/>
                                    </svg>
                                </button>
                                
                                <div className="thumbnail-scroll" ref={scrollContainerRef}>
                                    {product.image.map((img, idx) => (
                                        <div 
                                            key={idx} 
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

                        {/* PRIX MODIFIÉS : DISPOSITION VERTICALE */}
                        <div className="product-pricing-vertical">
                            {product.offerPrice && product.offerPrice < product.price && (
                                <div className="old-price-vertical">{product.price} {currency}</div>
                            )}
                            <div className="price-row">
                                <span className="current-price-vertical">
                                    {product.offerPrice && product.offerPrice < product.price ? product.offerPrice : product.price} {currency}
                                </span>
                                {product.offerPrice && product.offerPrice < product.price && (
                                    <span className="discount-badge">-{Math.round(((product.price - product.offerPrice) / product.price) * 100)}%</span>
                                )}
                            </div>
                        </div>

                        {getStockLabel(variantStock) && (
                            <p className={`stock-info ${getStockColor(variantStock)}`}>
                                {getStockLabel(variantStock)}
                            </p>
                        )}

                        {uniqueColors.length > 0 && (
                            <div className="option-group">
                                <p className="option-label">
                                    Couleur : <span>{selectedColor || 'Non sélectionnée'}</span>
                                </p>
                                <div className="option-buttons">
                                    {uniqueColors.map((color, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                                            disabled={!isColorAvailable(color)}
                                            className={`option-btn ${!isColorAvailable(color) ? 'disabled' : selectedColor === color ? 'active' : ''}`}
                                        >
                                            {color}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {uniqueSizes.length > 0 && (
                            <div className="option-group">
                                <p className="option-label">
                                    Taille : <span>{selectedSize || 'Non sélectionnée'}</span>
                                </p>
                                <div className="option-buttons sizes">
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
                        disabled={isOutOfStock}
                        className="floating-btn floating-btn-cart"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <path d="M16 10a4 4 0 0 1-8 0"/>
                        </svg>
                        Ajouter au panier
                    </button>
                    <button 
                        onClick={handleBuyNow}
                        disabled={isOutOfStock}
                        className="floating-btn floating-btn-buy"
                    >
                        Acheter maintenant
                    </button>
                </div>
            </div>

            <style>{`
                .product-details-page {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: 20px 16px 80px;
                }

                .breadcrumb-container {
                    margin-bottom: 24px;
                    font-size: 13px;
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
                    gap: 32px;
                }

                @media (min-width: 768px) {
                    .product-main {
                        flex-direction: row;
                        gap: 48px;
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
                    gap: 16px;
                }

                .main-image-container {
                    width: 100%;
                    aspect-ratio: 1/1;
                    background: #f5f3f0;
                    border-radius: 20px;
                    overflow: hidden;
                }

                .main-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .thumbnail-carousel {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .carousel-nav {
                    width: 36px;
                    height: 36px;
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
                    gap: 10px;
                    overflow-x: auto;
                    scroll-behavior: smooth;
                    scrollbar-width: thin;
                    flex: 1;
                }

                .thumbnail-scroll::-webkit-scrollbar {
                    height: 3px;
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
                    width: 70px;
                    height: 70px;
                    flex-shrink: 0;
                    border-radius: 12px;
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
                    gap: 4px;
                    align-items: center;
                }

                .star {
                    width: 18px;
                    height: 18px;
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
                    font-size: 24px;
                    font-weight: 600;
                    color: #111;
                    margin-bottom: 12px;
                    line-height: 1.3;
                }

                @media (min-width: 768px) {
                    .product-title {
                        font-size: 28px;
                    }
                }

                .product-rating {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }

                .rating-value {
                    font-size: 14px;
                    font-weight: 500;
                    color: #111;
                }

                .rating-count {
                    font-size: 13px;
                    color: #888;
                }

                /* NOUVEAUX STYLES PRIX VERTICAL */
                .product-pricing-vertical {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    margin-bottom: 12px;
                }
                .old-price-vertical {
                    font-size: 15px;
                    color: #bbb;
                    text-decoration: line-through;
                }
                .price-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .current-price-vertical {
                    font-size: 28px;
                    font-weight: 700;
                    color: #111;
                }
                .discount-badge {
                    background: #e53935;
                    color: white;
                    font-size: 12px;
                    font-weight: 600;
                    padding: 4px 10px;
                    border-radius: 20px;
                }

                .stock-info {
                    font-size: 13px;
                    font-weight: 500;
                    margin-bottom: 20px;
                }

                .text-red-500 { color: #e53935; }
                .text-orange-500 { color: #ff9800; }
                .text-green-600 { color: #4caf50; }

                .option-group {
                    margin-bottom: 24px;
                }

                .option-label {
                    font-size: 14px;
                    font-weight: 500;
                    margin-bottom: 12px;
                    color: #333;
                }

                .option-label span {
                    color: #111;
                    font-weight: 600;
                }

                .option-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }

                .option-btn {
                    padding: 8px 18px;
                    border-radius: 40px;
                    border: 1.5px solid #e8e3dc;
                    background: white;
                    font-size: 13px;
                    font-weight: 500;
                    color: #555;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .option-btn:hover:not(.disabled) {
                    border-color: #111;
                }

                .option-btn.active {
                    background: #111;
                    border-color: #111;
                    color: white;
                }

                .option-btn.disabled {
                    color: #ccc;
                    border-color: #eee;
                    text-decoration: line-through;
                    cursor: not-allowed;
                }

                .size-btn {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    border: 1.5px solid #e8e3dc;
                    background: white;
                    font-size: 14px;
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

                .product-description {
                    margin: 20px 0;
                }

                .desc-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: #111;
                }

                .product-description ul {
                    list-style: disc;
                    padding-left: 20px;
                    color: #666;
                    font-size: 14px;
                    line-height: 1.6;
                }

                .product-description li {
                    margin-bottom: 6px;
                }

                .cart-indicator {
                    font-size: 13px;
                    color: #111;
                    font-weight: 500;
                    margin-top: 16px;
                }

                .related-section {
                    margin-top: 60px;
                }

                .section-header {
                    text-align: center;
                    margin-bottom: 32px;
                }

                .section-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: #111;
                    margin-bottom: 8px;
                }

                .title-underline {
                    width: 60px;
                    height: 3px;
                    background: #111;
                    border-radius: 3px;
                    margin: 0 auto;
                }

                .related-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }

                @media (min-width: 640px) {
                    .related-grid {
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                    }
                }

                @media (min-width: 1024px) {
                    .related-grid {
                        grid-template-columns: repeat(4, 1fr);
                        gap: 24px;
                    }
                }

                .view-more-btn {
                    display: block;
                    margin: 32px auto 0;
                    padding: 12px 32px;
                    border: 1.5px solid #e8e3dc;
                    border-radius: 40px;
                    background: white;
                    font-size: 14px;
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
                    padding: 12px 20px;
                    z-index: 1000;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
                }

                .floating-buttons {
                    display: flex;
                    gap: 12px;
                }

                .floating-btn {
                    flex: 1;
                    padding: 14px 20px;
                    border-radius: 14px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
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