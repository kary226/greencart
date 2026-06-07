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
    const { products, navigate, currency, addToCart, cartItems, getCartKey, addToRecentlyViewed } = useAppContext();
    const { id } = useParams();
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedColor, setSelectedColor] = useState(null);
    const [selectedSize, setSelectedSize] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);
    const scrollContainerRef = useRef(null);

    const [averageRating, setAverageRating] = useState(4);
    const [totalReviews, setTotalReviews] = useState(0);

    const product = products.find((item) => item._id === id);

    useEffect(() => {
        if (product) addToRecentlyViewed(product);
    }, [product]);

    const getProductCategory = () => {
        if (product?.categories?.length > 0) return product.categories[0];
        return product?.category;
    };

    const getProductDescription = () => {
        if (product?.description && Array.isArray(product.description))
            return product.description.join(' ').slice(0, 160);
        return product?.description || '';
    };

    const uniqueColors = product ? [...new Set(product.variants?.map(v => v.color).filter(Boolean))] : [];
    const uniqueSizes = product ? [...new Set(product.variants?.map(v => v.size).filter(Boolean))] : [];

    const getVariantStock = () => {
        if (!product?.variants?.length) return null;
        const variant = product.variants.find(v =>
            (selectedColor ? v.color === selectedColor : !v.color) &&
            (selectedSize ? v.size === selectedSize : !v.size)
        ) || product.variants.find(v =>
            (selectedColor ? v.color === selectedColor : true) &&
            (selectedSize ? v.size === selectedSize : true)
        );
        return variant ? variant.stock : null;
    };

    const isSizeAvailable = (size) => {
        if (!selectedColor) return product.variants.some(v => v.size === size && v.stock > 0);
        const variant = product.variants.find(v => v.color === selectedColor && v.size === size);
        return variant ? variant.stock > 0 : false;
    };

    const isColorAvailable = (color) => {
        if (!selectedSize) return product.variants.some(v => v.color === color && v.stock > 0);
        const variant = product.variants.find(v => v.color === color && v.size === selectedSize);
        return variant ? variant.stock > 0 : false;
    };

    const variantStock = getVariantStock();
    const cartKey = getCartKey(product?._id, selectedColor, selectedSize);
    const currentQty = cartItems[cartKey] || 0;
    const isOutOfStock = variantStock === 0;

    const getStockMeta = (stock) => {
        if (stock === null || stock === undefined) return null;
        if (stock === 0) return { label: 'Rupture de stock', type: 'out' };
        if (stock <= 5) return { label: `Plus que ${stock} en stock`, type: 'low' };
        return { label: `En stock`, type: 'ok' };
    };

    const stockMeta = getStockMeta(variantStock);

    const handleAddToCart = () => {
        if (uniqueColors.length > 0 && !selectedColor) { toast.error('Veuillez choisir une couleur'); return; }
        if (uniqueSizes.length > 0 && !selectedSize) { toast.error('Veuillez choisir une taille'); return; }
        if (variantStock !== null && variantStock === 0) { toast.error('Ce variant est épuisé'); return; }
        if (variantStock !== null && currentQty >= variantStock) { toast.error(`Stock limité à ${variantStock} unités`); return; }
        addToCart(product._id, selectedColor, selectedSize);
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    const handleBuyNow = () => {
        if (uniqueColors.length > 0 && !selectedColor) { toast.error('Veuillez choisir une couleur'); return; }
        if (uniqueSizes.length > 0 && !selectedSize) { toast.error('Veuillez choisir une taille'); return; }
        if (variantStock !== null && variantStock === 0) { toast.error('Ce variant est épuisé'); return; }
        if (variantStock !== null && currentQty >= variantStock) { toast.error(`Stock limité à ${variantStock} unités`); return; }
        addToCart(product._id, selectedColor, selectedSize);
        navigate("/cart");
    };

    const scrollImages = (direction) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -120 : 120, behavior: 'smooth' });
        }
    };

    const renderStars = (rating) => {
        const fullStars = Math.floor(rating);
        const hasHalf = (rating % 1) >= 0.5;
        return (
            <div className="stars-row">
                {[...Array(5)].map((_, i) => (
                    <span key={i} className={`star-dot ${i < fullStars ? 'filled' : (i === fullStars && hasHalf ? 'half' : 'empty')}`} />
                ))}
            </div>
        );
    };

    const handleReviewsData = (data) => {
        setAverageRating(data.averageRating);
        setTotalReviews(data.totalReviews);
    };

    useEffect(() => {
        if (products.length > 0 && product) {
            const cat = getProductCategory();
            const filtered = products.filter((item) => {
                const matches = item.category === cat || item.categories?.includes(cat);
                return matches && item._id !== product._id;
            });
            setRelatedProducts(filtered.slice(0, 5));
        }
        setSelectedColor(null);
        setSelectedSize(null);
        setCurrentImageIndex(0);
        setImageLoaded(false);
        setAverageRating(4);
        setTotalReviews(0);
    }, [products, id]);

    if (!product) return null;

    const discountPct = product.offerPrice && product.offerPrice < product.price
        ? Math.round(((product.price - product.offerPrice) / product.price) * 100)
        : null;

    return (
        <>
            <SEO
                title={product.name}
                description={getProductDescription()}
                keywords={`${product.name}, ${product.category}, vêtements, accessoires, Ramci, Côte d'Ivoire, Abidjan`}
                image={product.image[0]}
                url={`https://greencart-ci.vercel.app/products/${getProductCategory()?.toLowerCase()}/${product._id}`}
            />

            <div className="pdp-root">
                {/* Breadcrumb */}
                <nav className="pdp-breadcrumb">
                    <Link to="/">Accueil</Link>
                    <span className="sep">·</span>
                    <Link to="/products">Articles</Link>
                    <span className="sep">·</span>
                    <Link to={`/products/${getProductCategory()?.toLowerCase()}`}>{getProductCategory()}</Link>
                    <span className="sep">·</span>
                    <span className="crumb-current">{product.name}</span>
                </nav>

                {/* Main layout */}
                <div className="pdp-main">
                    {/* Gallery */}
                    <div className="pdp-gallery">
                        <div className="pdp-main-img-wrap">
                            <img
                                key={currentImageIndex}
                                src={product.image[currentImageIndex]}
                                alt={product.name}
                                className={`pdp-main-img ${imageLoaded ? 'loaded' : ''}`}
                                onLoad={() => setImageLoaded(true)}
                            />
                            {discountPct && (
                                <div className="img-badge">−{discountPct}%</div>
                            )}
                            {stockMeta?.type === 'low' && (
                                <div className="img-badge badge-low">{stockMeta.label}</div>
                            )}
                        </div>

                        {product.image.length > 1 && (
                            <div className="pdp-thumbs">
                                <button className="thumb-nav" onClick={() => scrollImages('left')}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                                </button>
                                <div className="thumb-scroll" ref={scrollContainerRef}>
                                    {product.image.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => { setCurrentImageIndex(idx); setImageLoaded(false); }}
                                            className={`thumb-item ${currentImageIndex === idx ? 'active' : ''}`}
                                        >
                                            <img src={img} alt={`${product.name} ${idx + 1}`} />
                                        </button>
                                    ))}
                                </div>
                                <button className="thumb-nav" onClick={() => scrollImages('right')}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Info panel */}
                    <div className="pdp-info">
                        <p className="pdp-category-tag">{getProductCategory()}</p>
                        <h1 className="pdp-title">{product.name}</h1>

                        <div className="pdp-rating-row">
                            {renderStars(averageRating)}
                            <span className="rating-num">{averageRating.toFixed(1)}</span>
                            <span className="rating-sep">·</span>
                            <span className="rating-count">{totalReviews} avis</span>
                        </div>

                        <div className="pdp-price-row">
                            <span className="pdp-price">{product.offerPrice ?? product.price} {currency}</span>
                            {discountPct && <span className="pdp-old-price">{product.price} {currency}</span>}
                        </div>

                        {stockMeta && (
                            <div className={`pdp-stock stock-${stockMeta.type}`}>
                                <span className="stock-dot" />
                                {stockMeta.label}
                            </div>
                        )}

                        <div className="pdp-divider" />

                        {uniqueColors.length > 0 && (
                            <div className="pdp-option-block">
                                <p className="option-heading">
                                    Couleur
                                    {selectedColor && <span className="option-val"> — {selectedColor}</span>}
                                </p>
                                <div className="option-chips">
                                    {uniqueColors.map((color, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                                            disabled={!isColorAvailable(color)}
                                            className={`chip ${selectedColor === color ? 'chip-active' : ''} ${!isColorAvailable(color) ? 'chip-disabled' : ''}`}
                                        >
                                            {color}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {uniqueSizes.length > 0 && (
                            <div className="pdp-option-block">
                                <p className="option-heading">
                                    Taille
                                    {selectedSize && <span className="option-val"> — {selectedSize}</span>}
                                </p>
                                <div className="option-chips">
                                    {uniqueSizes.map((size, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                                            disabled={!isSizeAvailable(size)}
                                            className={`chip size-chip ${selectedSize === size ? 'chip-active' : ''} ${!isSizeAvailable(size) ? 'chip-disabled' : ''}`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pdp-divider" />

                        <div className="pdp-desc">
                            <p className="desc-label">À propos</p>
                            <ul className="desc-list">
                                {product.description.map((d, i) => (
                                    <li key={i}>{d}</li>
                                ))}
                            </ul>
                        </div>

                        {currentQty > 0 && (
                            <p className="cart-hint">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                                {currentQty} article{currentQty > 1 ? 's' : ''} déjà dans le panier
                            </p>
                        )}
                    </div>
                </div>

                {/* Related */}
                <section className="related-section">
                    <div className="related-header">
                        <p className="related-eyebrow">Vous aimerez aussi</p>
                        <h2 className="related-title">Articles similaires</h2>
                    </div>
                    <div className="related-grid">
                        {relatedProducts.filter(p => p.inStock).map((p, i) => (
                            <ProductCard key={i} product={p} />
                        ))}
                    </div>
                    <div className="related-footer">
                        <button onClick={() => { navigate('/products'); scrollTo(0, 0); }} className="see-all-btn">
                            Découvrir tout
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </section>

                <ProductReviews productId={product._id} onDataChange={handleReviewsData} />
                <RecentlyViewed />
            </div>

            {/* Floating CTA */}
            <div className="pdp-fab">
                <div className="pdp-fab-inner">
                    <div className="pdp-fab-product">
                        <img src={product.image[0]} alt={product.name} className="fab-thumb" />
                        <div>
                            <p className="fab-name">{product.name}</p>
                            <p className="fab-price">{product.offerPrice ?? product.price} {currency}</p>
                        </div>
                    </div>
                    <div className="pdp-fab-btns">
                        <button
                            onClick={handleAddToCart}
                            disabled={isOutOfStock}
                            className={`fab-btn fab-cart ${addedToCart ? 'added' : ''}`}
                        >
                            {addedToCart ? (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                    Ajouté
                                </>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                                    Panier
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleBuyNow}
                            disabled={isOutOfStock}
                            className="fab-btn fab-buy"
                        >
                            Acheter maintenant
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

                :root {
                    --ink: #0f0f0f;
                    --ink-soft: #5a5a5a;
                    --ink-faint: #9a9a9a;
                    --bone: #f7f4f0;
                    --warm-white: #fdfcfa;
                    --border: #e8e4de;
                    --accent: #c8935a;
                    --accent-dark: #a87240;
                    --red: #c0392b;
                    --green: #2e7d32;
                    --orange: #e65100;
                }

                * { box-sizing: border-box; margin: 0; padding: 0; }

                .pdp-root {
                    font-family: 'DM Sans', sans-serif;
                    max-width: 1320px;
                    margin: 0 auto;
                    padding: 28px 20px 120px;
                    background: var(--warm-white);
                    color: var(--ink);
                }

                /* Breadcrumb */
                .pdp-breadcrumb {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    font-weight: 400;
                    color: var(--ink-faint);
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    margin-bottom: 40px;
                }
                .pdp-breadcrumb a {
                    color: var(--ink-faint);
                    text-decoration: none;
                    transition: color 0.2s;
                }
                .pdp-breadcrumb a:hover { color: var(--ink); }
                .pdp-breadcrumb .sep { color: var(--border); }
                .crumb-current { color: var(--ink); }

                /* Main layout */
                .pdp-main {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 48px;
                }
                @media (min-width: 768px) {
                    .pdp-main {
                        grid-template-columns: 1fr 1fr;
                        gap: 64px;
                        align-items: start;
                    }
                }
                @media (min-width: 1100px) {
                    .pdp-main {
                        grid-template-columns: 55% 1fr;
                    }
                }

                /* Gallery */
                .pdp-gallery { display: flex; flex-direction: column; gap: 16px; }

                .pdp-main-img-wrap {
                    position: relative;
                    border-radius: 24px;
                    overflow: hidden;
                    background: var(--bone);
                    aspect-ratio: 4/5;
                }
                .pdp-main-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    opacity: 0;
                    transition: opacity 0.5s ease;
                }
                .pdp-main-img.loaded { opacity: 1; }

                .img-badge {
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    background: var(--ink);
                    color: #fff;
                    font-size: 11px;
                    font-weight: 500;
                    letter-spacing: 0.08em;
                    padding: 6px 14px;
                    border-radius: 40px;
                }
                .badge-low {
                    background: var(--orange);
                    top: auto;
                    bottom: 20px;
                }

                .pdp-thumbs {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .thumb-nav {
                    width: 32px;
                    height: 32px;
                    flex-shrink: 0;
                    border-radius: 50%;
                    border: 1px solid var(--border);
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: var(--ink-soft);
                }
                .thumb-nav:hover { background: var(--ink); color: white; border-color: var(--ink); }

                .thumb-scroll {
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    scrollbar-width: none;
                    flex: 1;
                }
                .thumb-scroll::-webkit-scrollbar { display: none; }

                .thumb-item {
                    width: 72px;
                    height: 72px;
                    flex-shrink: 0;
                    border-radius: 14px;
                    overflow: hidden;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.25s;
                    padding: 0;
                    background: var(--bone);
                }
                .thumb-item img { width: 100%; height: 100%; object-fit: cover; }
                .thumb-item.active { border-color: var(--ink); }
                .thumb-item:hover:not(.active) { border-color: var(--border); transform: scale(1.04); }

                /* Info panel */
                .pdp-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    padding-top: 8px;
                }

                .pdp-category-tag {
                    font-size: 11px;
                    font-weight: 500;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: var(--accent);
                    margin-bottom: 12px;
                }

                .pdp-title {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 38px;
                    font-weight: 600;
                    line-height: 1.15;
                    color: var(--ink);
                    margin-bottom: 20px;
                    letter-spacing: -0.01em;
                }
                @media (min-width: 768px) {
                    .pdp-title { font-size: 44px; }
                }

                /* Stars */
                .pdp-rating-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 24px;
                }
                .stars-row { display: flex; gap: 4px; align-items: center; }
                .star-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    transition: background 0.2s;
                }
                .star-dot.filled { background: var(--accent); }
                .star-dot.half { background: linear-gradient(90deg, var(--accent) 50%, var(--border) 50%); }
                .star-dot.empty { background: var(--border); }
                .rating-num { font-size: 13px; font-weight: 500; color: var(--ink); }
                .rating-sep { color: var(--border); }
                .rating-count { font-size: 13px; color: var(--ink-faint); }

                /* Price */
                .pdp-price-row {
                    display: flex;
                    align-items: baseline;
                    gap: 14px;
                    margin-bottom: 16px;
                }
                .pdp-price {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 36px;
                    font-weight: 600;
                    color: var(--ink);
                    letter-spacing: -0.02em;
                }
                .pdp-old-price {
                    font-size: 16px;
                    color: var(--ink-faint);
                    text-decoration: line-through;
                }

                /* Stock */
                .pdp-stock {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    font-size: 12px;
                    font-weight: 500;
                    letter-spacing: 0.04em;
                    margin-bottom: 8px;
                }
                .stock-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                }
                .stock-ok .stock-dot { background: var(--green); }
                .stock-ok { color: var(--green); }
                .stock-low .stock-dot { background: var(--orange); }
                .stock-low { color: var(--orange); }
                .stock-out .stock-dot { background: var(--red); }
                .stock-out { color: var(--red); }

                /* Divider */
                .pdp-divider {
                    height: 1px;
                    background: var(--border);
                    margin: 28px 0;
                }

                /* Options */
                .pdp-option-block { margin-bottom: 28px; }
                .option-heading {
                    font-size: 12px;
                    font-weight: 500;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: var(--ink-soft);
                    margin-bottom: 14px;
                }
                .option-val {
                    color: var(--ink);
                    font-weight: 400;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .option-chips { display: flex; flex-wrap: wrap; gap: 8px; }

                .chip {
                    padding: 9px 20px;
                    border-radius: 40px;
                    border: 1.5px solid var(--border);
                    background: white;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    font-weight: 400;
                    color: var(--ink);
                    cursor: pointer;
                    transition: all 0.2s;
                    letter-spacing: 0.02em;
                }
                .chip:hover:not(.chip-disabled):not(.chip-active) {
                    border-color: var(--ink);
                    background: var(--bone);
                }
                .chip-active {
                    background: var(--ink);
                    border-color: var(--ink);
                    color: white;
                }
                .chip-disabled {
                    opacity: 0.35;
                    cursor: not-allowed;
                    text-decoration: line-through;
                }

                .size-chip {
                    width: 52px;
                    height: 52px;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 14px;
                    font-size: 13px;
                    font-weight: 500;
                }

                /* Description */
                .pdp-desc { margin-bottom: 8px; }
                .desc-label {
                    font-size: 12px;
                    font-weight: 500;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: var(--ink-soft);
                    margin-bottom: 14px;
                }
                .desc-list {
                    list-style: none;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .desc-list li {
                    font-size: 14px;
                    color: var(--ink-soft);
                    line-height: 1.6;
                    padding-left: 18px;
                    position: relative;
                }
                .desc-list li::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 8px;
                    width: 6px;
                    height: 1px;
                    background: var(--accent);
                }

                .cart-hint {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    color: var(--ink-soft);
                    background: var(--bone);
                    padding: 8px 14px;
                    border-radius: 10px;
                    margin-top: 8px;
                }

                /* Related */
                .related-section { margin-top: 96px; }
                .related-header { margin-bottom: 40px; }
                .related-eyebrow {
                    font-size: 11px;
                    font-weight: 500;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: var(--accent);
                    margin-bottom: 8px;
                }
                .related-title {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 36px;
                    font-weight: 600;
                    color: var(--ink);
                    letter-spacing: -0.01em;
                }

                .related-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }
                @media (min-width: 640px) {
                    .related-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; }
                }
                @media (min-width: 1024px) {
                    .related-grid { grid-template-columns: repeat(4, 1fr); gap: 24px; }
                }

                .related-footer { margin-top: 40px; display: flex; justify-content: center; }
                .see-all-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 13px 30px;
                    border: 1.5px solid var(--ink);
                    border-radius: 40px;
                    background: transparent;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--ink);
                    cursor: pointer;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    transition: all 0.25s;
                }
                .see-all-btn:hover {
                    background: var(--ink);
                    color: white;
                    gap: 12px;
                }

                /* Floating bar */
                .pdp-fab {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 1000;
                    padding: 0 16px 16px;
                    background: linear-gradient(to top, rgba(253,252,250,1) 70%, rgba(253,252,250,0));
                    pointer-events: none;
                }
                .pdp-fab-inner {
                    max-width: 1320px;
                    margin: 0 auto;
                    background: white;
                    border: 1px solid var(--border);
                    border-radius: 20px;
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
                    pointer-events: all;
                }
                .pdp-fab-product {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex: 1;
                    min-width: 0;
                }
                .fab-thumb {
                    width: 44px;
                    height: 44px;
                    border-radius: 10px;
                    object-fit: cover;
                    background: var(--bone);
                    flex-shrink: 0;
                }
                .fab-name {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--ink);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .fab-price {
                    font-size: 12px;
                    color: var(--ink-faint);
                    margin-top: 2px;
                }

                .pdp-fab-btns {
                    display: flex;
                    gap: 8px;
                    flex-shrink: 0;
                }
                .fab-btn {
                    padding: 11px 20px;
                    border-radius: 12px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    transition: all 0.2s;
                    white-space: nowrap;
                    letter-spacing: 0.01em;
                }
                .fab-cart {
                    background: var(--bone);
                    color: var(--ink);
                }
                .fab-cart:hover:not(:disabled) { background: #ede9e3; }
                .fab-cart.added { background: #e8f5e9; color: var(--green); }

                .fab-buy {
                    background: var(--ink);
                    color: white;
                }
                .fab-buy:hover:not(:disabled) { background: #2a2a2a; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }

                .fab-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                @media (max-width: 480px) {
                    .pdp-fab-product { display: none; }
                    .pdp-fab-btns { flex: 1; }
                    .fab-btn { flex: 1; justify-content: center; }
                }
            `}</style>
        </>
    );
};

export default ProductDetails;