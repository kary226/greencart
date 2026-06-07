import { useEffect, useState, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import ProductReviews from "../components/ProductReviews";
import toast from "react-hot-toast";
import SEO from "../components/SEO";
import RecentlyViewed from "../components/RecentlyViewed";
import { ShoppingCart, Zap, ChevronLeft, ChevronRight, Star } from "lucide-react";

const ProductDetails = () => {

    const { products, navigate, currency, addToCart, cartItems, getCartKey, addToRecentlyViewed } = useAppContext();
    const { id } = useParams();
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedColor, setSelectedColor] = useState(null);
    const [selectedSize, setSelectedSize] = useState(null);
    const scrollContainerRef = useRef(null);
    
    const [averageRating, setAverageRating] = useState(4);
    const [totalReviews, setTotalReviews] = useState(0);

    const product = products.find((item) => item._id === id);

    useEffect(() => {
        if (product) {
            addToRecentlyViewed(product);
        }
    }, [product]);

    const getProductCategory = () => {
        if (product?.categories && product.categories.length > 0) {
            return product.categories[0];
        }
        return product?.category;
    };

    const getProductDescription = () => {
        if (product?.description && Array.isArray(product.description)) {
            return product.description.join(' ').slice(0, 160);
        }
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
        if (!selectedColor) {
            return product.variants.some(v => v.size === size && v.stock > 0);
        }
        const variant = product.variants.find(v => v.color === selectedColor && v.size === size);
        return variant ? variant.stock > 0 : false;
    };

    const isColorAvailable = (color) => {
        if (!selectedSize) {
            return product.variants.some(v => v.color === color && v.stock > 0);
        }
        const variant = product.variants.find(v => v.color === color && v.size === selectedSize);
        return variant ? variant.stock > 0 : false;
    };

    const variantStock = getVariantStock();
    const cartKey = getCartKey(product?._id, selectedColor, selectedSize);
    const currentQty = cartItems[cartKey] || 0;

    const getStockLabel = (stock) => {
        if (stock === null || stock === undefined) return null;
        if (stock === 0) return 'Rupture de stock';
        if (stock <= 5) return `Plus que ${stock} en stock`;
        return `En stock (${stock} disponibles)`;
    };

    const getStockColor = (stock) => {
        if (stock === null || stock === undefined) return '';
        if (stock === 0) return 'text-red-600';
        if (stock <= 5) return 'text-orange-500';
        return 'text-green-600';
    };

    const handleAddToCart = () => {
        if (uniqueColors.length > 0 && !selectedColor) {
            toast.error('Veuillez choisir une couleur');
            return;
        }
        if (uniqueSizes.length > 0 && !selectedSize) {
            toast.error('Veuillez choisir une taille');
            return;
        }
        if (variantStock !== null && variantStock === 0) {
            toast.error('Ce variant est épuisé');
            return;
        }
        if (variantStock !== null && currentQty >= variantStock) {
            toast.error(`Stock limité à ${variantStock} unités`);
            return;
        }
        addToCart(product._id, selectedColor, selectedSize);
    };

    const handleBuyNow = () => {
        if (uniqueColors.length > 0 && !selectedColor) {
            toast.error('Veuillez choisir une couleur');
            return;
        }
        if (uniqueSizes.length > 0 && !selectedSize) {
            toast.error('Veuillez choisir une taille');
            return;
        }
        if (variantStock !== null && variantStock === 0) {
            toast.error('Ce variant est épuisé');
            return;
        }
        if (variantStock !== null && currentQty >= variantStock) {
            toast.error(`Stock limité à ${variantStock} unités`);
            return;
        }
        addToCart(product._id, selectedColor, selectedSize);
        navigate("/cart");
    };

    const isOutOfStock = variantStock === 0;

    const scrollImages = (direction) => {
        if (scrollContainerRef.current) {
            const scrollAmount = direction === 'left' ? -120 : 120;
            scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    const renderStars = (rating) => {
        const fullStars = Math.floor(rating);
        const hasHalfStar = (rating % 1) >= 0.5;
        
        return (
            <div className="flex gap-1">
                {[...Array(5)].map((_, i) => {
                    if (i < fullStars) {
                        return <Star key={i} size={18} className="fill-red-500 text-red-500" />;
                    } else if (i === fullStars && hasHalfStar) {
                        return <Star key={i} size={18} className="fill-red-500 text-red-500" style={{ clipPath: 'inset(0 50% 0 0)' }} />;
                    } else {
                        return <Star key={i} size={18} className="text-gray-300" />;
                    }
                })}
            </div>
        );
    };

    const handleReviewsData = (data) => {
        setAverageRating(data.averageRating);
        setTotalReviews(data.totalReviews);
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
            setRelatedProducts(productsCopy.slice(0, 5));
        }
        setSelectedColor(null);
        setSelectedSize(null);
        setCurrentImageIndex(0);
        setAverageRating(4);
        setTotalReviews(0);
    }, [products, id]);

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
            
            <div className="min-h-screen bg-white pt-20 pb-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                        <Link to="/" className="hover:text-black">Accueil</Link>
                        <span>/</span>
                        <Link to="/products" className="hover:text-black">Articles</Link>
                        <span>/</span>
                        <Link to={`/products/${getProductCategory()?.toLowerCase()}`} className="hover:text-black">
                            {getProductCategory()}
                        </Link>
                        <span>/</span>
                        <span className="text-gray-900 font-medium">{product.name}</span>
                    </nav>

                    {/* Product Main */}
                    <div className="grid lg:grid-cols-2 gap-12 mb-16">
                        {/* Galerie d'images */}
                        <div className="space-y-4">
                            <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden">
                                <img 
                                    src={product.image[currentImageIndex]} 
                                    alt={product.name} 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            
                            {product.image.length > 1 && (
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => scrollImages('left')} 
                                        className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="flex-1 flex gap-3 overflow-x-auto scrollbar-hide" ref={scrollContainerRef}>
                                        {product.image.map((img, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => setCurrentImageIndex(idx)}
                                                className={`w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition ${
                                                    currentImageIndex === idx ? 'border-red-500' : 'border-transparent'
                                                }`}
                                            >
                                                <img src={img} alt={`Vue ${idx + 1}`} className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => scrollImages('right')} 
                                        className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Informations produit */}
                        <div className="space-y-6">
                            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

                            {/* Rating */}
                            <div className="flex items-center gap-3">
                                {renderStars(averageRating)}
                                <span className="text-sm font-medium text-gray-900">{averageRating}/5</span>
                                <span className="text-sm text-gray-400">({totalReviews} avis)</span>
                            </div>

                            {/* Prix - en colonne (ancien prix barré au-dessus) */}
                            <div className="space-y-1">
                                {product.offerPrice && product.offerPrice < product.price && (
                                    <div className="text-sm text-gray-400 line-through">
                                        {product.price} {currency}
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl font-bold text-gray-900">
                                        {product.offerPrice && product.offerPrice < product.price ? product.offerPrice : product.price} {currency}
                                    </span>
                                    {product.offerPrice && product.offerPrice < product.price && (
                                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                                            -{Math.round(((product.price - product.offerPrice) / product.price) * 100)}%
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Stock */}
                            {getStockLabel(variantStock) && (
                                <div className={`text-sm font-medium ${getStockColor(variantStock)}`}>
                                    {getStockLabel(variantStock)}
                                </div>
                            )}

                            {/* Couleurs */}
                            {uniqueColors.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-sm font-medium text-gray-700">
                                        Couleur : <span className="text-gray-900">{selectedColor || 'Non sélectionnée'}</span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueColors.map((color, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                                                disabled={!isColorAvailable(color)}
                                                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                                                    !isColorAvailable(color) ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through' :
                                                    selectedColor === color ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            >
                                                {color}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tailles */}
                            {uniqueSizes.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-sm font-medium text-gray-700">
                                        Taille : <span className="text-gray-900">{selectedSize || 'Non sélectionnée'}</span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueSizes.map((size, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                                                disabled={!isSizeAvailable(size)}
                                                className={`w-12 h-12 rounded-xl text-sm font-medium transition ${
                                                    !isSizeAvailable(size) ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through' :
                                                    selectedSize === size ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <p className="text-sm font-semibold text-gray-900">À propos du produit</p>
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                    {product.description.map((desc, index) => (
                                        <li key={index}>{desc}</li>
                                    ))}
                                </ul>
                            </div>

                            {currentQty > 0 && (
                                <p className="text-sm text-green-600 font-medium">
                                    {currentQty} article(s) déjà dans le panier
                                </p>
                            )}

                            {/* Actions */}
                            <div className="flex gap-4 pt-4">
                                <button 
                                    onClick={handleAddToCart}
                                    disabled={isOutOfStock}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ShoppingCart size={18} />
                                    Ajouter au panier
                                </button>
                                <button 
                                    onClick={handleBuyNow}
                                    disabled={isOutOfStock}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Zap size={18} />
                                    Acheter maintenant
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Articles similaires */}
                    {relatedProducts.length > 0 && (
                        <div className="mt-16">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-900">Articles similaires</h2>
                                <div className="w-20 h-1 bg-red-500 rounded-full mx-auto mt-2"></div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                                {relatedProducts.filter((p) => p.inStock).map((p, idx) => (
                                    <ProductCard key={idx} product={p} />
                                ))}
                            </div>
                            <div className="text-center mt-8">
                                <button 
                                    onClick={() => { navigate('/products'); scrollTo(0, 0); }} 
                                    className="px-8 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition"
                                >
                                    Voir plus
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Avis produits */}
                    <ProductReviews productId={product._id} onDataChange={handleReviewsData} />

                    {/* Récemment vus */}
                    <RecentlyViewed />
                </div>
            </div>
        </>
    );
};

export default ProductDetails;