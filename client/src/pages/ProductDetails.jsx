import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { Link, useParams } from "react-router-dom";
import { assets } from "../assets/assets";
import ProductCard from "../components/ProductCard";
import ProductReviews from "../components/ProductReviews";
import toast from "react-hot-toast";

const ProductDetails = () => {

    const {products, navigate, currency, addToCart, cartItems, getCartKey} = useAppContext()
    const {id} = useParams()
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [thumbnail, setThumbnail] = useState(null);
    const [selectedColor, setSelectedColor] = useState(null)
    const [selectedSize, setSelectedSize] = useState(null)

    const product = products.find((item)=> item._id === id);

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
        if (stock === 0) return '❌ Rupture de stock'
        if (stock <= 5) return `⚠️ Plus que ${stock} en stock !`
        return `✅ En stock (${stock} disponibles)`
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
            toast.error('Ce variant est épuisé !')
            return
        }
        if (variantStock !== null && currentQty >= variantStock) {
            toast.error(`Stock limité à ${variantStock} unités !`)
            return
        }
        addToCart(product._id, selectedColor, selectedSize)
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
            toast.error('Ce variant est épuisé !')
            return
        }
        if (variantStock !== null && currentQty >= variantStock) {
            toast.error(`Stock limité à ${variantStock} unités !`)
            return
        }
        addToCart(product._id, selectedColor, selectedSize)
        navigate("/cart")
    }

    useEffect(()=>{
        if(products.length > 0 && product){
            let productsCopy = products.slice();
            productsCopy = productsCopy.filter((item)=> product.category === item.category)
            setRelatedProducts(productsCopy.slice(0,5))
        }
        setSelectedColor(null)
        setSelectedSize(null)
    },[products, id])

    useEffect(()=>{
        setThumbnail(product?.image[0] ? product.image[0] : null)
    },[product])

    return product && (
        <div className="mt-12">
            <p>
                <Link to={"/"}>Accueil</Link> /
                <Link to={"/products"}> Produits</Link> /
                <Link to={`/products/${product.category.toLowerCase()}`}> {product.category}</Link> /
                <span className="text-primary"> {product.name}</span>
            </p>

            <div className="flex flex-col md:flex-row gap-16 mt-4">
                <div className="flex gap-3">
                    <div className="flex flex-col gap-3">
                        {product.image.map((image, index) => (
                            <div key={index} onClick={() => setThumbnail(image)} className="border max-w-24 border-gray-500/30 rounded overflow-hidden cursor-pointer">
                                <img src={image} alt={`Aperçu ${index + 1}`} />
                            </div>
                        ))}
                    </div>
                    <div className="border border-gray-500/30 max-w-100 rounded overflow-hidden">
                        <img src={thumbnail} alt="Produit sélectionné" />
                    </div>
                </div>

                <div className="text-sm w-full md:w-1/2">
                    <h1 className="text-3xl font-medium">{product.name}</h1>

                    <div className="flex items-center gap-0.5 mt-1">
                        {Array(5).fill('').map((_, i) => (
                            <img key={i} src={i<4 ? assets.star_icon : assets.star_dull_icon} alt="" className="md:w-4 w-3.5"/>
                        ))}
                        <p className="text-base ml-2">(4)</p>
                    </div>

                    <div className="mt-6">
                        <p className="text-gray-500/70 line-through">Prix : {product.price} {currency}</p>
                        <p className="text-2xl font-medium"> {product.offerPrice} {currency}</p>
                    </div>

                    {/* Stock */}
                    {getStockLabel(variantStock) && (
                        <p className={`mt-3 font-medium text-sm ${getStockColor(variantStock)}`}>
                            {getStockLabel(variantStock)}
                        </p>
                    )}

                    {/* Couleurs */}
                    {uniqueColors.length > 0 && (
                        <div className="mt-6">
                            <p className="text-base font-medium mb-2">
                                Couleur : <span className="text-primary">{selectedColor || 'Non sélectionnée'}</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {uniqueColors.map((color, i) => (
                                    <button key={i} onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                                    disabled={!isColorAvailable(color)}
                                    className={`px-4 py-1.5 rounded-full border text-sm transition ${
                                        !isColorAvailable(color)
                                        ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                                        : selectedColor === color
                                        ? 'border-primary bg-primary text-white'
                                        : 'border-gray-300 hover:border-primary text-gray-600'
                                    }`}>
                                        {color}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tailles */}
                    {uniqueSizes.length > 0 && (
                        <div className="mt-6">
                            <p className="text-base font-medium mb-2">
                                Taille : <span className="text-primary">{selectedSize || 'Non sélectionnée'}</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {uniqueSizes.map((size, i) => (
                                    <button key={i} onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                                    disabled={!isSizeAvailable(size)}
                                    className={`w-12 h-12 rounded border text-sm font-medium transition ${
                                        !isSizeAvailable(size)
                                        ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                                        : selectedSize === size
                                        ? 'border-primary bg-primary text-white'
                                        : 'border-gray-300 hover:border-primary text-gray-600'
                                    }`}>
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="text-base font-medium mt-6">À propos du produit</p>
                    <ul className="list-disc ml-4 text-gray-500/70">
                        {product.description.map((desc, index) => (
                            <li key={index}>{desc}</li>
                        ))}
                    </ul>

                    <div className="flex items-center mt-10 gap-4 text-base">
                        <button onClick={handleAddToCart}
                        disabled={variantStock === 0}
                        className={`w-full py-3.5 cursor-pointer font-medium transition ${
                            variantStock === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-800/80 hover:bg-gray-200'
                        }`}>
                            Ajouter au panier
                        </button>
                        <button onClick={handleBuyNow}
                        disabled={variantStock === 0}
                        className={`w-full py-3.5 cursor-pointer font-medium transition ${
                            variantStock === 0
                            ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                            : 'bg-primary text-white hover:bg-primary-dull'
                        }`}>
                            Acheter maintenant
                        </button>
                    </div>

                    {/* Quantité déjà dans le panier */}
                    {currentQty > 0 && (
                        <p className="text-sm text-primary mt-3 font-medium">
                            ✅ {currentQty} article(s) déjà dans le panier
                        </p>
                    )}
                </div>
            </div>

            {/* Produits similaires */}
            <div className="flex flex-col items-center mt-20">
                <div className="flex flex-col items-center w-max">
                    <p className="text-3xl font-medium">Produits similaires</p>
                    <div className="w-20 h-0.5 bg-primary rounded-full mt-2"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-6 lg:grid-cols-5 mt-6 w-full">
                    {relatedProducts.filter((product)=>product.inStock).map((product, index)=>(
                        <ProductCard key={index} product={product}/>
                    ))}
                </div>
                <button onClick={()=> {navigate('/products'); scrollTo(0,0)}} className="mx-auto cursor-pointer px-12 my-16 py-2.5 border rounded text-primary hover:bg-primary/10 transition">Voir plus</button>
            </div>

            {/* Section des avis clients */}
            <ProductReviews productId={product._id} />
        </div>
    );
};

export default ProductDetails;