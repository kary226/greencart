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
    const [descOpen, setDescOpen] = useState(false)
    const scrollContainerRef = useRef(null);
    const thumbnailRefs = useRef([]);
    const colorSectionRef = useRef(null);
    const sizeSectionRef = useRef(null);
    const galleryRef = useRef(null);

    const [colorError, setColorError] = useState('')
    const [sizeError, setSizeError] = useState('')
    const [highlightColor, setHighlightColor] = useState(false)
    const [highlightSize, setHighlightSize] = useState(false)

    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [galleryWidth, setGalleryWidth] = useState(0);

    const [averageRating, setAverageRating] = useState(4);
    const [totalReviews, setTotalReviews] = useState(0);

    const product = products.find((item) => item._id === id);

    useEffect(() => {
        if (scrollContainerRef.current && thumbnailRefs.current[currentImageIndex]) {
            thumbnailRefs.current[currentImageIndex].scrollIntoView({
                behavior: 'smooth', block: 'nearest', inline: 'center'
            });
        }
    }, [currentImageIndex]);

    useEffect(() => {
        if (product && product.variants && product.variants.length > 0) {
            const defaultVariant = product.variants[0]
            setSelectedColor(defaultVariant.color)
            setVariantData(defaultVariant)
            setCurrentImageIndex(defaultVariant.startImageIndex || 0)
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
                setCurrentImageIndex(variant.startImageIndex || 0)
                setColorError('')
                setHighlightColor(false)
            }
        }
    }, [selectedColor, product])

    useEffect(() => {
        if (product && product.variants && selectedColor && selectedSize) {
            const exactVariant = product.variants.find(v => v.color === selectedColor && v.size === selectedSize)
            if (exactVariant) setVariantData(exactVariant)
        } else if (product && product.variants && selectedColor) {
            const colorVariant = product.variants.find(v => v.color === selectedColor)
            if (colorVariant) setVariantData(colorVariant)
        }
    }, [selectedColor, selectedSize, product])

    useEffect(() => {
        if (selectedSize) { setSizeError(''); setHighlightSize(false) }
    }, [selectedSize])

    useEffect(() => {
        if (product) addToRecentlyViewed(product);
    }, [product]);

    useEffect(() => {
        const updateWidth = () => {
            if (galleryRef.current) setGalleryWidth(galleryRef.current.offsetWidth);
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const getProductCategory = () => {
        if (product?.categories && product.categories.length > 0) return product.categories[0]
        return product?.category
    }

    const getProductDescription = () => {
        if (product?.description && Array.isArray(product.description)) return product.description.join(' ').slice(0, 160)
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
        if (!selectedColor) return product.variants.some(v => v.size === size && v.stock > 0)
        const variant = product.variants.find(v => v.color === selectedColor && v.size === size)
        return variant ? variant.stock > 0 : false
    }

    const variantStock = getVariantStock()
    const cartKey = getCartKey(product?._id, selectedColor, selectedSize)
    const currentQty = cartItems[cartKey] || 0

    const getStockLabel = (stock) => {
        if (stock === null || stock === undefined) return null
        if ((uniqueColors.length > 0 && !selectedColor) || (uniqueSizes.length > 0 && !selectedSize)) return null
        if (stock === 0) return 'Rupture de stock'
        if (stock <= 5) return `Plus que ${stock} en stock`
        return `En stock (${stock} disponibles)`
    }

    const getStockColor = (stock) => {
        if (!stock) return ''
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

    const validateAndProceed = () => {
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
        if (variantStock !== null && variantStock === 0) { toast.error('Ce variant est épuisé'); return false }
        if (variantStock !== null && currentQty >= variantStock) { toast.error(`Stock limité à ${variantStock} unités`); return false }
        return true
    }

    const handleAddToCart = () => {
        if (validateAndProceed()) { addToCart(product._id, selectedColor, selectedSize); toast.success('Ajouté au panier') }
    }

    const handleBuyNow = () => {
        if (validateAndProceed()) { addToCart(product._id, selectedColor, selectedSize); navigate("/cart") }
    }

    // Swipe continu
    const handleTouchStart = (e) => {
        setTouchStart(e.targetTouches[0].clientX)
        setTouchEnd(e.targetTouches[0].clientX)
        setIsDragging(true)
    }
    const handleTouchMove = (e) => {
        const x = e.targetTouches[0].clientX
        setTouchEnd(x)
        let offset = x - touchStart
        if (currentImageIndex === 0 && offset > 0) offset = offset * 0.3
        if (currentImageIndex === allImages.length - 1 && offset < 0) offset = offset * 0.3
        setDragOffset(offset)
    }
    const handleTouchEnd = () => {
        const diff = touchStart - touchEnd
        const threshold = galleryWidth * 0.18
        if (diff > threshold && currentImageIndex < allImages.length - 1) setCurrentImageIndex(p => p + 1)
        else if (diff < -threshold && currentImageIndex > 0) setCurrentImageIndex(p => p - 1)
        setIsDragging(false)
        setDragOffset(0)
        setTouchStart(0)
        setTouchEnd(0)
    }

    const renderStars = (rating) => {
        const full = Math.floor(rating)
        const half = (rating % 1) >= 0.5
        return (
            <div className="stars-container">
                {[...Array(5)].map((_, i) => {
                    if (i < full) return <svg key={i} className="star star-full" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                    if (i === full && half) return <svg key={i} className="star star-half" viewBox="0 0 24 24" fill="currentColor"><defs><clipPath id="h"><rect x="0" y="0" width="12" height="24"/></clipPath></defs><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" clipPath="url(#h)"/></svg>
                    return <svg key={i} className="star star-empty" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                })}
            </div>
        )
    }

    const handleReviewsData = (data) => { setAverageRating(data.averageRating); setTotalReviews(data.totalReviews) }
    const handleColorSelect = (color) => { setSelectedColor(selectedColor === color ? null : color); setSelectedSize(null) }

    useEffect(() => {
        if (products.length > 0 && product) {
            const cat = getProductCategory()
            const copy = products.slice().filter(item => {
                if (item.category) return item.category === cat && item._id !== product._id
                if (item.categories?.length) return item.categories.includes(cat) && item._id !== product._id
                return false
            })
            setRelatedProducts(copy.slice(0, 5))
        }
        setSelectedColor(null); setSelectedSize(null); setCurrentImageIndex(0)
        setAverageRating(4); setTotalReviews(0); setVariantData(null)
        setColorError(''); setSizeError(''); setHighlightColor(false); setHighlightSize(false)
        setDescOpen(false)
    }, [products, id])

    if (!product) return null;

    const stockLabel = getStockLabel(currentStock)

    return (
        <>
            <SEO
                title={product.name}
                description={getProductDescription()}
                keywords={`${product.name}, ${product.category}, vêtements, accessoires, Ramci, Côte d'Ivoire, Abidjan`}
                image={allImages[0]}
                url={`https://greencart-ci.vercel.app/products/${getProductCategory()?.toLowerCase()}/${product._id}`}
            />

            <div className="pdp">
                <div className="breadcrumb">
                    <Link to="/">Accueil</Link> /
                    <Link to="/products"> Articles</Link> /
                    <Link to={`/products/${getProductCategory()?.toLowerCase()}`}> {getProductCategory()}</Link> /
                    <span>{product.name}</span>
                </div>

                <div className="pdp-main">
                    {/* ── GALERIE ── */}
                    <div className="gallery">
                        <div
                            className="gallery-carousel"
                            ref={galleryRef}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div
                                className="gallery-track"
                                style={{
                                    transform: `translateX(${-currentImageIndex * galleryWidth + dragOffset}px)`,
                                    transition: isDragging ? 'none' : 'transform 0.38s cubic-bezier(0.22, 0.61, 0.36, 1)'
                                }}
                            >
                                {allImages.map((img, idx) => (
                                    <div key={idx} className="gallery-slide" style={{ width: galleryWidth }}>
                                        <img src={img} alt={`${product.name} ${idx + 1}`} draggable="false" />
                                    </div>
                                ))}
                            </div>
                            {allImages.length > 1 && (
                                <span className="img-counter">{currentImageIndex + 1} / {allImages.length}</span>
                            )}
                        </div>

                        {allImages.length > 1 && (
                            <>
                                <div className="dots">
                                    {allImages.map((_, i) => (
                                        <span key={i} className={`dot${currentImageIndex === i ? ' active' : ''}`} onClick={() => setCurrentImageIndex(i)} />
                                    ))}
                                </div>
                                <div className="thumbs" ref={scrollContainerRef}>
                                    {allImages.map((img, idx) => (
                                        <div
                                            key={idx}
                                            ref={el => thumbnailRefs.current[idx] = el}
                                            onClick={() => setCurrentImageIndex(idx)}
                                            className={`thumb${currentImageIndex === idx ? ' active' : ''}`}
                                        >
                                            <img src={img} alt="" />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── INFOS ── */}
                    <div className="info">
                        {/* Titre + note inline pour économiser de l'espace */}
                        <div className="title-row">
                            <h1 className="ptitle">{product.name}</h1>
                            <div className="rating-inline">
                                {renderStars(averageRating)}
                                <span className="rv">{averageRating}</span>
                                <span className="rc">({totalReviews})</span>
                            </div>
                        </div>

                        {/* Prix */}
                        <div className="pricing">
                            {currentOfferPrice && currentOfferPrice < currentPrice && (
                                <span className="old-price">{currentPrice} {currency}</span>
                            )}
                            <div className="price-row">
                                <span className="price">
                                    {currentOfferPrice && currentOfferPrice < currentPrice ? currentOfferPrice : currentPrice} {currency}
                                </span>
                                {currentOfferPrice && currentOfferPrice < currentPrice && (
                                    <span className="badge">-{Math.round(((currentPrice - currentOfferPrice) / currentPrice) * 100)}%</span>
                                )}
                            </div>
                        </div>

                        {/* Couleurs */}
                        {uniqueColors.length > 0 && (
                            <div ref={colorSectionRef} className={`opt-group${highlightColor ? ' err-highlight' : ''}`}>
                                <p className="opt-label">
                                    Couleur {selectedColor && <span className="opt-val">— {selectedColor}</span>}
                                </p>
                                <div className="color-row">
                                    {uniqueColors.map((color, i) => {
                                        const variant = product.variants.find(v => v.color === color)
                                        const available = variant?.stock > 0
                                        const selected = selectedColor === color
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => handleColorSelect(color)}
                                                disabled={!available}
                                                className={`color-chip${!available ? ' disabled' : selected ? ' active' : ''}`}
                                                title={color}
                                            >
                                                <span className="swatch" style={{ backgroundColor: variant?.colorCode || '#000' }}>
                                                    {!available && <span className="cross" />}
                                                    {selected && available && (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                                            <path d="M20 6L9 17l-5-5" />
                                                        </svg>
                                                    )}
                                                </span>
                                                <span className="swatch-label">{color}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                                {colorError && <div className="err-msg"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{colorError}</div>}
                            </div>
                        )}

                        {/* Tailles */}
                        {uniqueSizes.length > 0 && (
                            <div ref={sizeSectionRef} className={`opt-group${highlightSize ? ' err-highlight' : ''}`}>
                                <p className="opt-label">
                                    Taille {selectedSize && <span className="opt-val">— {selectedSize}</span>}
                                </p>
                                <div className="sizes">
                                    {uniqueSizes.map((size, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                                            disabled={!isSizeAvailable(size)}
                                            className={`size-btn${!isSizeAvailable(size) ? ' disabled' : selectedSize === size ? ' active' : ''}`}
                                        >{size}</button>
                                    ))}
                                </div>
                                {sizeError && <div className="err-msg"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{sizeError}</div>}
                            </div>
                        )}

                        {/* Stock */}
                        {stockLabel && <p className={`stock ${getStockColor(currentStock)}`}>{stockLabel}</p>}

                        {/* Panier indicateur */}
                        {currentQty > 0 && <p className="cart-ind">{currentQty} article(s) déjà dans le panier</p>}

                        {/* À propos — accordéon */}
                        <div className="desc-accordion">
                            <button className="desc-toggle" onClick={() => setDescOpen(o => !o)}>
                                <span>À propos du produit</span>
                                <svg
                                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                    style={{ transform: descOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }}
                                >
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>
                            <div className={`desc-body${descOpen ? ' open' : ''}`}>
                                <ul>
                                    {product.description.map((d, i) => <li key={i}>{d}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Articles similaires */}
                <div className="related-section">
                    <div className="section-header">
                        <p className="section-title">Articles similaires</p>
                        <div className="title-underline" />
                    </div>
                    <div className="related-grid">
                        {relatedProducts.filter(p => p.inStock).map((p, i) => <ProductCard key={i} product={p} />)}
                    </div>
                    <button onClick={() => { navigate('/products'); scrollTo(0, 0) }} className="view-more-btn">Voir plus</button>
                </div>

                <ProductReviews productId={product._id} onDataChange={handleReviewsData} />
                <RecentlyViewed />
            </div>

            {/* Barre flottante */}
            <div className="fab-bar">
                <button onClick={handleAddToCart} className="fab fab-cart">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <path d="M16 10a4 4 0 0 1-8 0"/>
                    </svg>
                    Ajouter
                </button>
                <button onClick={handleBuyNow} className="fab fab-buy">Acheter</button>
            </div>

            <style>{`
                /* ─── BASE ─── */
                .pdp {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: 10px 12px 70px;
                }

                .breadcrumb {
                    font-size: 11px;
                    color: #999;
                    margin-bottom: 10px;
                }
                .breadcrumb a { color: #777; text-decoration: none; }
                .breadcrumb a:hover { color: #111; }
                .breadcrumb span { color: #111; font-weight: 500; }

                /* ─── LAYOUT PRINCIPAL ─── */
                .pdp-main {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }

                @media (min-width: 768px) {
                    .pdp-main { flex-direction: row; gap: 36px; align-items: flex-start; }
                    .gallery { flex: 0 0 44%; position: sticky; top: 80px; }
                    .info { flex: 1; }
                }

                /* ─── GALERIE ─── */
                .gallery { display: flex; flex-direction: column; gap: 10px; }

                .gallery-carousel {
                    position: relative;
                    width: 100%;
                    /* Rectangle 4:5 sur mobile pour gagner de la hauteur vs carré */
                    aspect-ratio: 4/5;
                    max-height: 62vw; /* jamais plus de 62% de la largeur viewport = reste compact */
                    overflow: hidden;
                    border-radius: 16px;
                    background: #f5f3f0;
                    cursor: grab;
                    touch-action: pan-y;
                }

                @media (min-width: 480px) {
                    .gallery-carousel { aspect-ratio: 1/1; max-height: none; }
                }

                .gallery-carousel:active { cursor: grabbing; }

                .gallery-track {
                    display: flex;
                    height: 100%;
                    will-change: transform;
                }

                .gallery-slide {
                    flex-shrink: 0;
                    height: 100%;
                }

                .gallery-slide img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    pointer-events: none;
                    user-select: none;
                    display: block;
                }

                .img-counter {
                    position: absolute;
                    bottom: 10px;
                    right: 10px;
                    background: rgba(0,0,0,0.5);
                    color: #fff;
                    font-size: 11px;
                    padding: 3px 9px;
                    border-radius: 20px;
                    backdrop-filter: blur(4px);
                    pointer-events: none;
                }

                /* Dots */
                .dots {
                    display: flex;
                    justify-content: center;
                    gap: 6px;
                }
                .dot {
                    width: 6px; height: 6px;
                    border-radius: 50%;
                    background: #ddd;
                    cursor: pointer;
                    transition: all .22s;
                }
                .dot.active { background: #111; width: 18px; border-radius: 4px; }

                /* Miniatures */
                .thumbs {
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    scrollbar-width: none;
                }
                .thumbs::-webkit-scrollbar { display: none; }

                .thumb {
                    width: 52px; height: 52px;
                    flex-shrink: 0;
                    border-radius: 10px;
                    overflow: hidden;
                    border: 2px solid transparent;
                    cursor: pointer;
                    opacity: 0.5;
                    transition: all .2s;
                }
                .thumb.active { border-color: #111; opacity: 1; }
                .thumb:hover { opacity: 1; }
                .thumb img { width: 100%; height: 100%; object-fit: cover; }

                /* ─── INFOS ─── */
                .info { display: flex; flex-direction: column; gap: 10px; }

                /* Titre + note sur une ligne */
                .title-row {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 8px;
                }

                .ptitle {
                    font-size: 17px;
                    font-weight: 700;
                    color: #111;
                    line-height: 1.25;
                    flex: 1;
                    margin: 0;
                }

                @media (min-width: 768px) { .ptitle { font-size: 24px; } }

                .rating-inline {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex-shrink: 0;
                    padding-top: 2px;
                }

                .stars-container { display: flex; gap: 2px; }
                .star { width: 13px; height: 13px; }
                .star-full { color: #ffc107; fill: #ffc107; }
                .star-half { color: #ffc107; fill: #ffc107; }
                .star-empty { color: #e0e0e0; stroke: #e0e0e0; }
                .rv { font-size: 11px; font-weight: 600; color: #111; }
                .rc { font-size: 10px; color: #aaa; }

                /* Prix */
                .pricing { display: flex; flex-direction: column; gap: 1px; }
                .old-price { font-size: 12px; color: #bbb; text-decoration: line-through; }
                .price-row { display: flex; align-items: center; gap: 8px; }
                .price { font-size: 22px; font-weight: 800; color: #111; }
                .badge {
                    background: #e53935; color: #fff;
                    font-size: 11px; font-weight: 700;
                    padding: 2px 8px; border-radius: 20px;
                }

                /* Groupes options */
                .opt-group { display: flex; flex-direction: column; gap: 8px; }

                .opt-group.err-highlight {
                    background: #fef2f2;
                    border-radius: 10px;
                    padding: 8px;
                    animation: shake .45s ease;
                }

                @keyframes shake {
                    0%,100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }

                .opt-label {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: .07em;
                    color: #777;
                    margin: 0;
                }
                .opt-val { color: #111; font-weight: 700; text-transform: none; letter-spacing: normal; }

                /* Couleurs : rond + nom, sans aucun cadre */
                .color-row { display: flex; flex-wrap: wrap; gap: 10px 14px; }

                .color-chip {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 5px;
                    background: none;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    transition: transform .15s;
                }
                .color-chip:hover:not(.disabled) { transform: translateY(-2px); }
                .color-chip.disabled { opacity: .4; cursor: not-allowed; }

                .swatch {
                    width: 30px; height: 30px;
                    border-radius: 50%;
                    border: 1.5px solid rgba(0,0,0,.08);
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: box-shadow .15s, transform .15s;
                }
                .color-chip.active .swatch {
                    box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px #111;
                    transform: scale(1.08);
                }

                .cross {
                    position: absolute;
                    top: 50%; left: 50%;
                    width: 2px; height: 26px;
                    background: #e53935;
                    transform: translate(-50%,-50%) rotate(45deg);
                }

                .swatch-label {
                    font-size: 10px;
                    font-weight: 500;
                    color: #888;
                    text-align: center;
                    max-width: 52px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .color-chip.active .swatch-label { color: #111; font-weight: 700; }

                /* Tailles */
                .sizes { display: flex; flex-wrap: wrap; gap: 7px; }
                .size-btn {
                    min-width: 40px; height: 40px;
                    padding: 0 10px;
                    border-radius: 10px;
                    border: 1.5px solid #e5e0d8;
                    background: #fff;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all .18s;
                }
                .size-btn.active { background: #111; border-color: #111; color: #fff; }
                .size-btn.disabled { color: #ccc; border-color: #eee; text-decoration: line-through; cursor: not-allowed; }

                /* Stock */
                .stock { font-size: 12px; font-weight: 600; margin: 0; }
                .text-red-500 { color: #e53935; }
                .text-orange-500 { color: #ff9800; }
                .text-green-600 { color: #4caf50; }

                /* Indicateur panier */
                .cart-ind { font-size: 11px; color: #555; font-weight: 500; margin: 0; }

                /* Erreurs */
                .err-msg {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    background: #fef2f2;
                    color: #e53935;
                    font-size: 11px;
                    font-weight: 500;
                    padding: 7px 10px;
                    border-radius: 8px;
                    border: 1px solid #fecaca;
                }

                /* ─── ACCORDÉON DESCRIPTION ─── */
                .desc-accordion {
                    border: 1px solid #ede9e3;
                    border-radius: 12px;
                    overflow: hidden;
                }

                .desc-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 13px 16px;
                    background: #fafaf8;
                    border: none;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    color: #111;
                    text-align: left;
                    transition: background .15s;
                }
                .desc-toggle:hover { background: #f3f0ea; }

                .desc-body {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height .3s cubic-bezier(0.4,0,0.2,1), padding .3s;
                    padding: 0 16px;
                    background: #fff;
                }
                .desc-body.open {
                    max-height: 400px;
                    padding: 12px 16px;
                }
                .desc-body ul {
                    list-style: disc;
                    padding-left: 16px;
                    color: #666;
                    font-size: 12px;
                    line-height: 1.6;
                    margin: 0;
                }
                .desc-body li { margin-bottom: 4px; }

                /* ─── SIMILAIRES ─── */
                .related-section { margin-top: 32px; }
                .section-header { text-align: center; margin-bottom: 18px; }
                .section-title { font-size: 19px; font-weight: 700; color: #111; margin-bottom: 6px; }
                .title-underline { width: 44px; height: 2px; background: #111; border-radius: 2px; margin: 0 auto; }

                .related-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
                @media (min-width: 640px) { .related-grid { grid-template-columns: repeat(3,1fr); } }
                @media (min-width: 1024px) { .related-grid { grid-template-columns: repeat(4,1fr); } }

                .view-more-btn {
                    display: block;
                    margin: 20px auto 0;
                    padding: 9px 22px;
                    border: 1.5px solid #e5e0d8;
                    border-radius: 40px;
                    background: #fff;
                    font-size: 13px; font-weight: 500; color: #111;
                    cursor: pointer; transition: all .2s;
                }
                .view-more-btn:hover { background: #111; color: #fff; border-color: #111; }

                /* ─── BARRE FLOTTANTE ─── */
                .fab-bar {
                    position: fixed;
                    bottom: 0; left: 0; right: 0;
                    background: rgba(255,255,255,.97);
                    backdrop-filter: blur(10px);
                    border-top: 1px solid #eee;
                    padding: 8px 16px;
                    z-index: 1000;
                    box-shadow: 0 -2px 12px rgba(0,0,0,.06);
                }
                .fab-bar > div,
                .fab-bar { display: flex; gap: 10px; }

                .fab {
                    flex: 1;
                    padding: 11px 12px;
                    border-radius: 40px;
                    font-size: 13px; font-weight: 700;
                    cursor: pointer; border: none;
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                    transition: all .2s;
                }
                .fab-cart { background: #f2efe9; color: #111; }
                .fab-cart:hover { background: #e8e4dc; }
                .fab-buy { background: #111; color: #fff; }
                .fab-buy:hover { background: #333; }
                .fab:disabled { opacity: .5; cursor: not-allowed; }
            `}</style>
        </>
    );
};

export default ProductDetails;