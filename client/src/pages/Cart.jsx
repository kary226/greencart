import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";
import CouponInput from "../components/CouponInput";
import {
    ShoppingBag, Trash2, ArrowRight, MapPin, Truck, CreditCard, Plus,
    Minus, MoreVertical, Heart, Tag, X, Check, Home, Zap, PackageCheck, Edit2, Loader2
} from "lucide-react";
import { getPresetImageUrl } from "../utils/cloudinaryImage";

const Cart = () => {
    const {
        products, currency, cartItems, removeFromCart, getCartCount, updateCartItem,
        navigate, axios, user, setCartItems, getProductIdFromKey, getCartKey,
        addToWishlist
    } = useAppContext()
    const [cartArray, setCartArray] = useState([])
    const [selectedKeys, setSelectedKeys] = useState([])
    const [openMenuKey, setOpenMenuKey] = useState(null)
    const [addresses, setAddresses] = useState([])
    const [showAddress, setShowAddress] = useState(false)
    const [selectedAddress, setSelectedAddress] = useState(null)
    const [paymentOption, setPaymentOption] = useState("")
    const [placingOrder, setPlacingOrder] = useState(false)
    const [appliedCoupon, setAppliedCoupon] = useState(null)
    const [discountedAmount, setDiscountedAmount] = useState(null)

    // Interrupteur de sécurité — pas pour choisir entre GeniusPay et Jèko
    // (GeniusPay est retiré), juste pour pouvoir couper les paiements en
    // urgence depuis Réglages si Jèko a un problème, sans redéployer.
    const [jekoActive, setJekoActive] = useState(true)
    const [jekoPaymentMethod, setJekoPaymentMethod] = useState('')
    useEffect(() => {
        axios.get('/api/setting/paymentMethodsEnabled')
            .then(({ data }) => { if (data.success && data.data?.jeko === false) setJekoActive(false) })
            .catch(() => {}) // pas configuré → reste actif, comportement par défaut
    }, [])

    const [deliveryTypes, setDeliveryTypes] = useState([])
    const [selectedDeliveryType, setSelectedDeliveryType] = useState(null)
    const [deliveryPrice, setDeliveryPrice] = useState(0)
    const [deliveryPricesByType, setDeliveryPricesByType] = useState({})
    const [loadingDelivery, setLoadingDelivery] = useState(false)

    // Icône par type de livraison (déduite du nom — purement visuel)
    const deliveryIcon = (name = '') => {
        const n = name.toLowerCase();
        if (n.includes('express') || n.includes('rapide')) return Zap;
        if (n.includes('relais') || n.includes('point')) return PackageCheck;
        return Home;
    };


    const formatAddress = (address) => {
        if (!address) return "Aucune adresse trouvée";
        const parts = [];
        if (address.street) parts.push(address.street);
        if (address.communeName) parts.push(address.communeName);
        if (address.cityName) parts.push(address.cityName);
        return parts.join(", ");
    };

    const deleteAddress = async (addressId) => {
        try {
            const { data } = await axios.post('/api/address/delete', { addressId, userId: user._id });
            if (data.success) {
                toast.success('Adresse supprimée');
                getUserAddress();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    // ✅ FIX (inchangé) : on ne devine plus couleur/taille par position dans le
    // split, on reconstruit la clé attendue pour CHAQUE variante via getCartKey()
    // et on cherche celle qui correspond exactement à la clé stockée.
    const getCart = () => {
        let tempArray = []
        for (const key in cartItems) {
            const productId = getProductIdFromKey(key)
            const product = products.find((item) => item._id === productId)
            if (product) {
                let color = null
                let size = null
                let variant = null

                const hasVariants = product.variants && product.variants.length > 0

                if (hasVariants) {
                    variant = product.variants.find(v => getCartKey(productId, v.color, v.size) === key)
                    if (variant) {
                        color = variant.color
                        size = variant.size
                    }
                }

                const variantStock = hasVariants
                    ? (variant ? variant.stock : 0)
                    : (product.stock ?? null)

                tempArray.push({
                    ...product,
                    cartKey: key,
                    quantity: cartItems[key],
                    selectedColor: color,
                    selectedSize: size,
                    variantStock
                })
            }
        }
        setCartArray(tempArray)
    }

    const getUserAddress = async () => {
        try {
            const { data } = await axios.get('/api/address/get');
            if (data.success) {
                setAddresses(data.addresses)
                if (data.addresses.length > 0) {
                    setSelectedAddress(data.addresses[0])
                }
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const fetchDeliveryTypes = async () => {
        try {
            const { data } = await axios.get('/api/delivery/types');
            if (data.success && data.types.length > 0) {
                setDeliveryTypes(data.types)
                setSelectedDeliveryType(data.types[0])
            }
        } catch (error) {
            console.error(error)
        }
    }

    const fetchDeliveryPrice = async () => {
        if (!selectedAddress?.communeId || !selectedDeliveryType?._id) {
            setDeliveryPrice(0)
            return
        }
        setLoadingDelivery(true)
        try {
            const { data } = await axios.get(`/api/delivery/price/${selectedAddress.communeId}/${selectedDeliveryType._id}`)
            if (data.success && data.price) {
                setDeliveryPrice(data.price.price)
            } else {
                setDeliveryPrice(0)
            }
        } catch (error) {
            console.error(error)
            setDeliveryPrice(0)
        } finally {
            setLoadingDelivery(false)
        }
    }

    // Additif, purement pour l'affichage : le prix de CHAQUE option de
    // livraison pour la commune choisie, afin de les lister comme des cartes
    // (au lieu d'un <select> caché). Ne remplace pas fetchDeliveryPrice
    // ci-dessus, qui reste la source de vérité utilisée à la commande.
    const fetchAllDeliveryPrices = async () => {
        if (!selectedAddress?.communeId || deliveryTypes.length === 0) {
            setDeliveryPricesByType({})
            return
        }
        try {
            const results = await Promise.all(
                deliveryTypes.map(async (type) => {
                    try {
                        const { data } = await axios.get(`/api/delivery/price/${selectedAddress.communeId}/${type._id}`)
                        return [type._id, data.success && data.price ? data.price.price : null]
                    } catch {
                        return [type._id, null]
                    }
                })
            )
            setDeliveryPricesByType(Object.fromEntries(results))
        } catch (error) {
            console.error(error)
        }
    }

    const handleCouponApplied = (coupon) => {
        setAppliedCoupon(coupon);
        if (coupon) {
            setDiscountedAmount(coupon.newAmount);
        } else {
            setDiscountedAmount(null);
        }
    };

    // ✅ Sélection multiple (visuel + calcul) : par défaut TOUT est sélectionné,
    // donc le comportement par défaut est identique à avant (tout le panier est
    // commandé). Décocher un article est une capacité en plus, pas un changement
    // du comportement existant.
    const selectedArray = cartArray.filter(p => selectedKeys.includes(p.cartKey))
    const allSelected = cartArray.length > 0 && selectedKeys.length === cartArray.length

    const toggleSelectAll = () => {
        setSelectedKeys(allSelected ? [] : cartArray.map(p => p.cartKey))
    }
    const toggleSelectOne = (key) => {
        setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
    }

    const originalAmount = selectedArray.reduce((sum, p) => sum + p.offerPrice * p.quantity, 0);
    const finalAmount = (discountedAmount !== null ? discountedAmount : originalAmount) + deliveryPrice;

    useEffect(() => {
        const pendingOrderId = sessionStorage.getItem('pendingOrderId');
        if (pendingOrderId && user) {
            const checkAbandonedOrder = async () => {
                try {
                    const { data } = await axios.get(`/api/order/${pendingOrderId}`);
                    if (data.success && data.order && !data.order.isPaid) {
                        toast.error('Paiement annulé. Veuillez réessayer.');
                        sessionStorage.removeItem('pendingOrderId');
                        try {
                            await axios.post('/api/order/cancel', { orderId: pendingOrderId });
                        } catch (err) {
                            console.error("Erreur annulation:", err);
                        }
                    } else if (data.success && data.order && data.order.isPaid) {
                        sessionStorage.removeItem('pendingOrderId');
                    }
                } catch (error) {
                    console.error("Erreur vérification commande abandonnée:", error);
                }
            };
            checkAbandonedOrder();
        }
    }, [user]);

    useEffect(() => {
        fetchDeliveryTypes()
    }, [])

    useEffect(() => {
        if (selectedAddress && selectedDeliveryType) {
            fetchDeliveryPrice()
        }
    }, [selectedAddress, selectedDeliveryType])

    useEffect(() => {
        fetchAllDeliveryPrices()
    }, [selectedAddress, deliveryTypes])

    useEffect(() => {
        if (products.length > 0 && cartItems) {
            getCart()
        }
    }, [products, cartItems])

    // Nouveaux articles (ex: après ajout au panier) → sélectionnés par défaut.
    // Les articles retirés du panier sont retirés de la sélection.
    useEffect(() => {
        const keys = cartArray.map(p => p.cartKey)
        setSelectedKeys(prev => {
            const kept = prev.filter(k => keys.includes(k))
            const added = keys.filter(k => !prev.includes(k))
            return [...kept, ...added]
        })
    }, [cartArray])

    useEffect(() => {
        if (user) {
            getUserAddress()
        }
    }, [user])

    const moveToWishlist = async (product) => {
        setOpenMenuKey(null)
        await addToWishlist(product._id)
        removeFromCart(product.cartKey)
        toast.success('Déplacé dans vos favoris')
    }

    const clearCart = () => {
        if (!window.confirm('Vider tout le panier ?')) return
        setCartItems({})
        toast.success('Panier vidé')
    }

    const placeOrder = async () => {
        try {
            if (selectedArray.length === 0) {
                return toast.error("Sélectionnez au moins un article")
            }
            if (!selectedAddress) {
                return toast.error("Veuillez sélectionner une adresse")
            }

            if (!paymentOption) {
                toast.error("Veuillez choisir un moyen de paiement")
                return
            }
            if (paymentOption === "Jeko" && !jekoPaymentMethod) {
                toast.error("Veuillez choisir votre opérateur Mobile Money")
                return
            }

            // [FIX UX] Un seul état de chargement, posé dès la validation passée et
            // levé uniquement sur erreur — jamais avant la redirection effective vers
            // la page sécurisée, pour ne pas laisser un "trou" où rien ne semble se
            // passer entre la réponse de l'API et l'arrivée réelle sur Jèko.
            setPlacingOrder(true)

            const items = selectedArray.map(item => ({
                product: item._id,
                quantity: item.quantity,
                selectedColor: item.selectedColor,
                selectedSize: item.selectedSize,
                offerPrice: item.offerPrice
            }))

            if (appliedCoupon) {
                await axios.post('/api/coupon/apply', {
                    couponId: appliedCoupon.id,
                    userId: user._id
                });
            }

            const totalWithDelivery = finalAmount

            if (paymentOption === "COD") {
                const { data } = await axios.post('/api/order/cod', {
                    userId: user._id,
                    items,
                    address: selectedAddress._id,
                    couponApplied: appliedCoupon ? appliedCoupon.code : null,
                    discountAmount: appliedCoupon ? (originalAmount - discountedAmount) : 0,
                    deliveryPrice: deliveryPrice,
                    deliveryType: selectedDeliveryType?.name
                })
                if (data.success) {
                    toast.success(data.message)
                    selectedArray.forEach(item => removeFromCart(item.cartKey))
                    navigate('/my-orders')
                } else {
                    setPlacingOrder(false)
                    toast.error(data.message)
                }
            } else if (paymentOption === "Online") {
                const { data } = await axios.post('/api/order/stripe', {
                    userId: user._id,
                    items,
                    address: selectedAddress._id,
                    couponApplied: appliedCoupon ? appliedCoupon.code : null,
                    discountAmount: appliedCoupon ? (originalAmount - discountedAmount) : 0,
                    deliveryPrice: deliveryPrice,
                    deliveryType: selectedDeliveryType?.name
                })
                if (data.success) {
                    // Navigation complète vers Stripe — on laisse placingOrder à true,
                    // le bouton reste "en chargement" jusqu'à ce que la page quitte.
                    window.location.replace(data.url)
                } else {
                    setPlacingOrder(false)
                    toast.error(data.message)
                }
            } else if (paymentOption === "Jeko") {
                try {
                    const { data } = await axios.post('/api/order/jeko/initiate', {
                        userId: user._id,
                        items: selectedArray.map(item => ({
                            product: item._id,
                            quantity: item.quantity,
                            selectedColor: item.selectedColor,
                            selectedSize: item.selectedSize,
                            offerPrice: item.offerPrice
                        })),
                        address: selectedAddress._id,
                        amount: totalWithDelivery,
                        deliveryPrice: deliveryPrice,
                        deliveryType: selectedDeliveryType?.name,
                        couponApplied: appliedCoupon ? appliedCoupon.code : null,
                        discountAmount: appliedCoupon ? (originalAmount - discountedAmount) : 0,
                        jekoPaymentMethod: jekoPaymentMethod,
                    });

                    if (data.success && data.checkout_url) {
                        sessionStorage.setItem('pendingOrderId', data.orderId);
                        window.location.href = data.checkout_url;
                    } else {
                        setPlacingOrder(false)
                        toast.error(data.message || "Erreur lors de l'initiation du paiement");
                    }
                } catch (error) {
                    setPlacingOrder(false)
                    console.error("Erreur Jèko:", error);
                    toast.error(error.response?.data?.message || "Erreur de connexion au service de paiement");
                }
            }
        } catch (error) {
            setPlacingOrder(false)
            toast.error(error.message)
        }
    }

    if (cartArray.length === 0) {
        return (
            <div className="min-h-screen bg-ink-50 pt-24 pb-16 px-4">
                <div className="max-w-sm mx-auto text-center">
                    <div className="w-20 h-20 bg-ramses-50 rounded-full flex items-center justify-center mx-auto mb-5">
                        <ShoppingBag size={32} className="text-ramses-600" />
                    </div>
                    <h2 className="rs-h1 mb-2">Votre panier est vide</h2>
                    <p className="text-ink-400 text-[14px] mb-7">Ajoutez des articles pour les voir apparaître ici.</p>
                    <button onClick={() => navigate("/products")} className="rs-btn rs-btn--primary">
                        Découvrir nos produits
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-50 pt-6 pb-36 lg:pb-16">
            <div className="max-w-7xl mx-auto px-4">

                {/* ── En-tête ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-4 mb-5">
                    <div>
                        <h1 className="rs-display">Mon panier</h1>
                        <p className="text-ink-400 text-[13px] mt-1">
                            {getCartCount()} article{getCartCount() > 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={clearCart}
                        className="rs-icon-btn text-ink-400 hover:text-ramses-600"
                        aria-label="Vider le panier"
                        title="Vider le panier"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row lg:gap-8">

                    {/* ── Colonne articles ───────────────────────────────── */}
                    <div className="flex-1">

                        {/* Case « tout sélectionner » : vrai <button role="checkbox">.
                            La version d'origine était un <span onClick> imbriqué dans
                            un <label>, donc inatteignable au clavier — sur un panier,
                            la sélection décide de ce qui est commandé. */}
                        <button
                            type="button"
                            role="checkbox"
                            aria-checked={allSelected}
                            onClick={toggleSelectAll}
                            className="flex items-center gap-2.5 mb-3 px-1 py-2 select-none w-fit"
                        >
                            <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition shrink-0 ${
                                    allSelected ? 'bg-ramses-600 border-ramses-600' : 'border-ink-300 bg-ink-0'
                                }`}
                            >
                                {allSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                            </span>
                            <span className="text-[14px] font-semibold text-ink-700">
                                Tout sélectionner {selectedKeys.length > 0 && `(${selectedKeys.length})`}
                            </span>
                        </button>

                        <ul className="grid gap-3 list-none p-0 m-0">
                            {cartArray.map((product) => {
                                const isSelected = selectedKeys.includes(product.cartKey)
                                return (
                                    <li
                                        key={product.cartKey}
                                        className={`rs-card !p-3 transition ${isSelected ? 'border-ink-200' : ''}`}
                                    >
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={isSelected}
                                                aria-label={`Sélectionner ${product.name}`}
                                                onClick={() => toggleSelectOne(product.cartKey)}
                                                className="mt-1 shrink-0 self-start"
                                            >
                                                <span
                                                    className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition ${
                                                        isSelected ? 'bg-ramses-600 border-ramses-600' : 'border-ink-300 bg-ink-0'
                                                    }`}
                                                >
                                                    {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                                                </span>
                                            </button>

                                            <div
                                                onClick={() => {
                                                    navigate(`/products/${product.category?.toLowerCase() || 'all'}/${product._id}`);
                                                    scrollTo(0, 0)
                                                }}
                                                className="w-20 h-20 rounded-xl overflow-hidden cursor-pointer bg-ink-50 flex-shrink-0"
                                            >
                                                <img src={getPresetImageUrl(product.image[0], "thumbnail")} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="min-w-0">
                                                        {/* Nom non tronqué : sur mobile, « Robe mi-longue… »
                                                            coupé au premier mot ne permet pas de distinguer
                                                            deux variantes du même produit. */}
                                                        <h3 className="font-semibold text-ink-900 text-[13.5px] leading-snug line-clamp-2">
                                                            {product.name}
                                                        </h3>
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {product.selectedColor && (
                                                                <span className="text-[10px] font-semibold bg-ink-50 text-ink-600 px-2 py-0.5 rounded-full">
                                                                    {product.selectedColor}
                                                                </span>
                                                            )}
                                                            {product.selectedSize && (
                                                                <span className="text-[10px] font-semibold bg-ink-50 text-ink-600 px-2 py-0.5 rounded-full">
                                                                    Taille : {product.selectedSize}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="relative shrink-0">
                                                        <button
                                                            onClick={() => setOpenMenuKey(openMenuKey === product.cartKey ? null : product.cartKey)}
                                                            className="rs-icon-btn !w-9 !h-9 text-ink-300"
                                                            aria-label={`Actions pour ${product.name}`}
                                                            aria-expanded={openMenuKey === product.cartKey}
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>
                                                        {openMenuKey === product.cartKey && (
                                                            <>
                                                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuKey(null)} />
                                                                <div className="absolute right-0 top-9 z-20 bg-ink-0 rounded-xl shadow-lg border border-ink-100 py-1 w-48">
                                                                    <button
                                                                        onClick={() => removeFromCart(product.cartKey)}
                                                                        className="flex items-center gap-2.5 w-full px-3.5 min-h-[40px] text-[13px] text-ink-600 hover:bg-ink-50 transition"
                                                                    >
                                                                        <Trash2 size={14} /> Supprimer
                                                                    </button>
                                                                    <button
                                                                        onClick={() => moveToWishlist(product)}
                                                                        className="flex items-center gap-2.5 w-full px-3.5 min-h-[40px] text-[13px] text-ink-600 hover:bg-ink-50 transition"
                                                                    >
                                                                        <Heart size={14} /> Déplacer en favoris
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap justify-between items-end mt-2.5 gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center border border-ink-200 rounded-lg overflow-hidden w-fit">
                                                            <button
                                                                onClick={() => {
                                                                    if (product.quantity > 1) {
                                                                        updateCartItem(product.cartKey, product.quantity - 1);
                                                                    }
                                                                }}
                                                                className="w-9 h-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 transition disabled:text-ink-300"
                                                                disabled={product.quantity <= 1}
                                                                aria-label="Diminuer la quantité"
                                                            >
                                                                <Minus size={14} />
                                                            </button>
                                                            <span className="w-9 text-center text-[14px] font-bold text-ink-900 tabular-nums">
                                                                {product.quantity}
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    const maxStock = product.variantStock !== null && product.variantStock !== undefined
                                                                        ? product.variantStock
                                                                        : 10;
                                                                    if (product.quantity < maxStock) {
                                                                        updateCartItem(product.cartKey, product.quantity + 1);
                                                                    } else {
                                                                        toast.error(`Stock limité à ${maxStock} unités !`);
                                                                    }
                                                                }}
                                                                className="w-9 h-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 transition disabled:text-ink-300"
                                                                disabled={product.variantStock !== null && product.quantity >= product.variantStock}
                                                                aria-label="Augmenter la quantité"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                        {product.variantStock !== null && product.variantStock <= 5 && (
                                                            <span className={`text-[11px] font-semibold ${product.variantStock === 0 ? 'text-ink-400' : 'text-warn-500'}`}>
                                                                {product.variantStock === 0 ? 'Rupture de stock' : `Plus que ${product.variantStock}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="rs-money text-[15px]">
                                                        {(product.offerPrice * product.quantity).toLocaleString()} {currency}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>

                        <button
                            onClick={() => { navigate("/products"); scrollTo(0, 0) }}
                            className="flex items-center gap-1.5 text-ink-700 hover:text-ramses-600 transition text-[14px] font-semibold mt-4 min-h-[44px]"
                        >
                            <ArrowRight size={15} />
                            Continuer mes achats
                        </button>
                    </div>

                    {/* ── Colonne récapitulatif ──────────────────────────── */}
                    <div className="lg:w-96 mt-6 lg:mt-0">
                        <div className="rs-card lg:sticky lg:top-20">
                            <h2 className="rs-h1 mb-4">Récapitulatif</h2>

                            {/* Adresse */}
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin size={15} className="text-ramses-600" />
                                    <span className="rs-label text-ink-400">Adresse de livraison</span>
                                </div>
                                <div className="bg-ink-50 rounded-xl p-3.5">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            {user?.name && <p className="text-[14px] font-semibold text-ink-900">{user.name}</p>}
                                            <p className="text-[12px] text-ink-500 mt-0.5">{formatAddress(selectedAddress)}</p>
                                        </div>
                                        <button
                                            onClick={() => setShowAddress(!showAddress)}
                                            aria-expanded={showAddress}
                                            className="flex items-center gap-1 text-ramses-700 text-[12px] font-semibold shrink-0 min-h-[32px]"
                                        >
                                            <Edit2 size={12} /> Modifier
                                        </button>
                                    </div>
                                    {showAddress && (
                                        <div className="mt-3 pt-3 border-t border-ink-200 grid gap-1.5">
                                            {addresses.map((address, idx) => {
                                                const actif = selectedAddress?._id === address._id
                                                return (
                                                    /* <button> et non <div onClick> : choisir son adresse
                                                       de livraison doit être possible au clavier. */
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setSelectedAddress(address); setShowAddress(false) }}
                                                            aria-pressed={actif}
                                                            className={`flex-1 text-left text-[12px] rounded-lg px-2.5 py-2.5 transition ${
                                                                actif ? 'bg-ink-0 border border-ramses-300 text-ink-900' : 'text-ink-600 hover:bg-ink-0'
                                                            }`}
                                                        >
                                                            {formatAddress(address)}
                                                        </button>
                                                        <button
                                                            onClick={() => deleteAddress(address._id)}
                                                            className="text-ink-400 hover:text-ramses-600 text-[11px] shrink-0 px-2 min-h-[32px]"
                                                            aria-label="Supprimer cette adresse"
                                                        >
                                                            Supprimer
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                            <button
                                                onClick={() => navigate("/add-address")}
                                                className="flex items-center gap-1.5 text-ramses-700 text-[12px] font-semibold px-2.5 min-h-[40px]"
                                            >
                                                <Plus size={13} /> Ajouter une adresse
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Livraison */}
                            {deliveryTypes.length > 0 && selectedAddress?.communeId && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Truck size={15} className="text-ramses-600" />
                                        <span className="rs-label text-ink-400">Mode de livraison</span>
                                    </div>
                                    <div className="grid gap-2" role="radiogroup" aria-label="Mode de livraison">
                                        {deliveryTypes.map((type) => {
                                            const Icon = deliveryIcon(type.name);
                                            const isSelected = selectedDeliveryType?._id === type._id;
                                            const price = deliveryPricesByType[type._id];
                                            return (
                                                <button
                                                    key={type._id}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={isSelected}
                                                    onClick={() => setSelectedDeliveryType(type)}
                                                    className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 border transition text-left ${
                                                        isSelected ? 'border-ramses-600 bg-ramses-50' : 'border-ink-100 bg-ink-0 hover:border-ink-200'
                                                    }`}
                                                >
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                        isSelected ? 'bg-ramses-600 text-white' : 'bg-ink-50 text-ink-500'
                                                    }`}>
                                                        <Icon size={15} />
                                                    </span>
                                                    <span className="flex-1 min-w-0">
                                                        <span className="block text-[14px] font-semibold text-ink-800 truncate">{type.name}</span>
                                                        {type.description && <span className="block text-[11px] text-ink-400 truncate">{type.description}</span>}
                                                    </span>
                                                    <span className="text-[14px] font-bold text-ink-900 shrink-0 tabular-nums">
                                                        {price === null || price === undefined ? '—' : price === 0 ? 'Gratuit' : `${price.toLocaleString()} ${currency}`}
                                                    </span>
                                                    <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                        isSelected ? 'border-ramses-600' : 'border-ink-300'
                                                    }`}>
                                                        {isSelected && <span className="w-2 h-2 rounded-full bg-ramses-600" />}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Paiement — Jèko exige l'opérateur AVANT l'appel API (pas de
                                page générique de choix côté eux comme avait GeniusPay), donc
                                la liste des opérateurs est directement le moyen de paiement,
                                sans étape intermédiaire "Jèko" à cliquer d'abord.
                                Badges colorés (couleur de marque + initiale) plutôt que les
                                vrais logos, qui sont des marques déposées qu'on ne reproduit
                                pas dans le code. */}
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CreditCard size={15} className="text-ramses-600" />
                                    <span className="rs-label text-ink-400">Moyen de paiement</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {!jekoActive ? (
                                        <p className="col-span-2 text-[13px] text-ink-500 bg-ink-50 rounded-lg py-3 px-3">
                                            Les paiements en ligne sont momentanément indisponibles. Réessayez un peu plus tard.
                                        </p>
                                    ) : [
                                        { key: 'orange', label: 'Orange Money', initial: 'O', bg: '#FF6600' },
                                        { key: 'wave', label: 'Wave', initial: 'W', bg: '#1DA1F2' },
                                        { key: 'mtn', label: 'MTN MoMo', initial: 'M', bg: '#FFCC00', text: '#1a1a1a' },
                                        { key: 'moov', label: 'Moov Money', initial: 'M', bg: '#F26522' },
                                        { key: 'djamo', label: 'Djamo', initial: 'd', bg: '#6C3AC7' },
                                    ].map(({ key, label, initial, bg, text }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            role="radio"
                                            aria-checked={jekoPaymentMethod === key}
                                            onClick={() => { setJekoPaymentMethod(key); setPaymentOption('Jeko'); }}
                                            className={`flex items-center gap-2.5 text-[13px] font-semibold rounded-lg py-3 px-3 border-2 transition text-left ${
                                                jekoPaymentMethod === key ? 'border-ramses-600 bg-ramses-50 text-ramses-700' : 'border-ink-100 text-ink-600 hover:border-ink-200'
                                            }`}
                                        >
                                            <span
                                                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold text-[13px]"
                                                style={{ background: bg, color: text || '#fff' }}
                                            >
                                                {initial}
                                            </span>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Code promo */}
                            <div className="flex items-center gap-2 mb-2">
                                <Tag size={15} className="text-ramses-600" />
                                <span className="rs-label text-ink-400">Code promo</span>
                            </div>
                            <CouponInput amount={originalAmount} items={selectedArray.map(p => ({ product: p._id, quantity: p.quantity }))} onCouponApplied={handleCouponApplied} />

                            {/* Totaux */}
                            <div className="mt-4 pt-3 border-t border-ink-100 grid gap-1.5">
                                <div className="flex justify-between text-[13px] text-ink-500">
                                    <span>Sous-total ({selectedArray.length})</span>
                                    <span className="tabular-nums">{originalAmount.toLocaleString()} {currency}</span>
                                </div>
                                {appliedCoupon && (
                                    <div className="flex justify-between text-[13px] text-ok-500 font-semibold">
                                        <span>Réduction ({appliedCoupon.code})</span>
                                        <span className="tabular-nums">− {appliedCoupon.discountAmount.toLocaleString()} {currency}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-[13px] text-ink-500">
                                    <span>Frais de livraison</span>
                                    <span className={`tabular-nums ${deliveryPrice === 0 ? 'text-ok-500 font-semibold' : ''}`}>
                                        {loadingDelivery ? 'Calcul…' : deliveryPrice === 0 ? 'Gratuite' : `${deliveryPrice.toLocaleString()} ${currency}`}
                                    </span>
                                </div>
                                <div className="flex justify-between items-baseline pt-2.5 mt-1 border-t border-ink-100">
                                    <span className="text-[14px] font-bold text-ink-900">Total</span>
                                    <span className="rs-money text-[20px]">{finalAmount.toLocaleString()} {currency}</span>
                                </div>
                            </div>

                            <button
                                onClick={placeOrder}
                                disabled={selectedArray.length === 0 || placingOrder}
                                className="rs-btn rs-btn--primary rs-btn--block mt-5"
                            >
                                {placingOrder ? (
                                    <><Loader2 size={17} className="animate-spin" /> Redirection en cours…</>
                                ) : (
                                    <>Passer la commande {selectedArray.length > 0 && `(${selectedArray.length})`}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Barre sticky mobile ────────────────────────────────────── */}
            <div
                className="lg:hidden fixed bottom-0 left-0 right-0 bg-ink-0 border-t border-ink-100 px-4 pt-3 flex items-center justify-between gap-4 z-20"
                style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            >
                <div className="min-w-0">
                    <p className="text-[11.5px] text-ink-400">Total ({selectedArray.length})</p>
                    <p className="rs-money text-[17px]">{finalAmount.toLocaleString()} {currency}</p>
                </div>
                <button
                    onClick={placeOrder}
                    disabled={selectedArray.length === 0 || placingOrder}
                    className="rs-btn rs-btn--primary flex-1 max-w-[220px]"
                >
                    {placingOrder ? (
                        <><Loader2 size={16} className="animate-spin" /> Redirection…</>
                    ) : (
                        'Passer la commande'
                    )}
                </button>
            </div>
        </div>
    )
}

export default Cart;