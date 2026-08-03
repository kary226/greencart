import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";
import CouponInput from "../components/CouponInput";
import {
    ShoppingBag, Trash2, ArrowRight, MapPin, Truck, CreditCard, Plus,
    Minus, MoreVertical, Heart, Tag, X, Check, ChevronDown
} from "lucide-react";

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
    const [appliedCoupon, setAppliedCoupon] = useState(null)
    const [discountedAmount, setDiscountedAmount] = useState(null)

    const [deliveryTypes, setDeliveryTypes] = useState([])
    const [selectedDeliveryType, setSelectedDeliveryType] = useState(null)
    const [deliveryPrice, setDeliveryPrice] = useState(0)
    const [loadingDelivery, setLoadingDelivery] = useState(false)

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
                toast.error("Veuillez sélectionner un moyen de paiement")
                return
            }

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
                    window.location.replace(data.url)
                } else {
                    toast.error(data.message)
                }
            } else if (paymentOption === "GeniusPay") {
                try {
                    toast.loading("Préparation du paiement...", { id: "geniuspay" });

                    const { data } = await axios.post('/api/order/geniuspay/initiate', {
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
                        discountAmount: appliedCoupon ? (originalAmount - discountedAmount) : 0
                    });

                    toast.dismiss("geniuspay");

                    if (data.success && data.checkout_url) {
                        sessionStorage.setItem('pendingOrderId', data.orderId);
                        window.location.href = data.checkout_url;
                    } else {
                        toast.error(data.message || "Erreur lors de l'initiation du paiement");
                    }
                } catch (error) {
                    toast.dismiss("geniuspay");
                    console.error("Erreur GeniusPay:", error);
                    toast.error(error.response?.data?.message || "Erreur de connexion au service de paiement");
                }
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    if (cartArray.length === 0) {
        return (
            <div className="min-h-screen bg-ivory-200 pt-24 pb-16 px-4">
                <div className="max-w-sm mx-auto text-center">
                    <div className="w-24 h-24 bg-blush-100 rounded-full flex items-center justify-center mx-auto mb-5 relative">
                        <ShoppingBag size={38} className="text-burgundy-400" />
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-burgundy-600 rounded-full flex items-center justify-center border-2 border-ivory-200">
                            <X size={14} className="text-white" strokeWidth={3} />
                        </div>
                    </div>
                    <h2 className="font-display text-xl font-semibold text-gray-900 mb-1.5">Votre panier est vide</h2>
                    <p className="text-gray-400 text-sm mb-7">Ajoutez des articles pour les voir apparaître ici.</p>
                    <button
                        onClick={() => navigate("/products")}
                        className="bg-burgundy-600 text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-burgundy-700 transition shadow-md shadow-burgundy-900/10"
                    >
                        Découvrir nos produits
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ivory-200 pt-16 pb-32 lg:pb-16">
            <div className="max-w-7xl mx-auto px-4">
                {/* En-tête */}
                <div className="flex items-center justify-between mb-5 pt-4">
                    <div>
                        <h1 className="font-display text-2xl font-semibold text-gray-900">Mon panier</h1>
                        <p className="text-gray-400 text-sm mt-0.5">{getCartCount()} article{getCartCount() > 1 ? 's' : ''}</p>
                    </div>
                    <button
                        onClick={clearCart}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-blush-200 text-gray-400 hover:text-burgundy-600 hover:border-burgundy-300 transition"
                        title="Vider le panier"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row lg:gap-8">
                    {/* Colonne gauche - Produits */}
                    <div className="flex-1">
                        {/* Tout sélectionner */}
                        <label className="flex items-center gap-2.5 mb-3 px-1 select-none cursor-pointer w-fit">
                            <span
                                onClick={(e) => { e.preventDefault(); toggleSelectAll(); }}
                                className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition shrink-0 ${
                                    allSelected ? 'bg-burgundy-600 border-burgundy-600' : 'border-blush-300 bg-white'
                                }`}
                            >
                                {allSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                                Tout sélectionner {selectedKeys.length > 0 && `(${selectedKeys.length})`}
                            </span>
                        </label>

                        <div className="space-y-3">
                            {cartArray.map((product) => {
                                const isSelected = selectedKeys.includes(product.cartKey)
                                return (
                                    <div
                                        key={product.cartKey}
                                        className={`bg-white rounded-2xl p-3 border transition ${
                                            isSelected ? 'border-blush-200' : 'border-blush-100 opacity-60'
                                        }`}
                                    >
                                        <div className="flex gap-3">
                                            <span
                                                onClick={() => toggleSelectOne(product.cartKey)}
                                                className={`w-5 h-5 mt-1 rounded-md flex items-center justify-center border-2 transition shrink-0 cursor-pointer ${
                                                    isSelected ? 'bg-burgundy-600 border-burgundy-600' : 'border-blush-300 bg-white'
                                                }`}
                                            >
                                                {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                                            </span>

                                            <div
                                                onClick={() => {
                                                    navigate(`/products/${product.category?.toLowerCase() || 'all'}/${product._id}`);
                                                    scrollTo(0, 0)
                                                }}
                                                className="w-20 h-20 rounded-xl overflow-hidden cursor-pointer bg-blush-50 flex-shrink-0"
                                            >
                                                <img src={product.image[0]} alt={product.name} className="w-full h-full object-cover" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="min-w-0">
                                                        <h3 className="font-medium text-gray-900 text-sm truncate">{product.name}</h3>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {product.selectedColor && (
                                                                <span className="text-[10px] bg-blush-100 text-burgundy-700 px-2 py-0.5 rounded-full">
                                                                    {product.selectedColor}
                                                                </span>
                                                            )}
                                                            {product.selectedSize && (
                                                                <span className="text-[10px] bg-blush-100 text-burgundy-700 px-2 py-0.5 rounded-full">
                                                                    Taille : {product.selectedSize}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="relative shrink-0">
                                                        <button
                                                            onClick={() => setOpenMenuKey(openMenuKey === product.cartKey ? null : product.cartKey)}
                                                            className="text-gray-300 hover:text-gray-600 transition p-1"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>
                                                        {openMenuKey === product.cartKey && (
                                                            <>
                                                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuKey(null)} />
                                                                <div className="absolute right-0 top-7 z-20 bg-white rounded-xl shadow-lg border border-blush-100 py-1 w-44">
                                                                    <button
                                                                        onClick={() => removeFromCart(product.cartKey)}
                                                                        className="flex items-center gap-2 w-full px-3.5 py-2 text-xs text-gray-600 hover:bg-blush-50 transition"
                                                                    >
                                                                        <Trash2 size={13} /> Supprimer
                                                                    </button>
                                                                    <button
                                                                        onClick={() => moveToWishlist(product)}
                                                                        className="flex items-center gap-2 w-full px-3.5 py-2 text-xs text-gray-600 hover:bg-blush-50 transition"
                                                                    >
                                                                        <Heart size={13} /> Déplacer en favoris
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap justify-between items-end mt-2.5 gap-2">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center border border-blush-200 rounded-lg overflow-hidden w-fit">
                                                            <button
                                                                onClick={() => {
                                                                    if (product.quantity > 1) {
                                                                        updateCartItem(product.cartKey, product.quantity - 1);
                                                                    }
                                                                }}
                                                                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-blush-50 transition disabled:opacity-40"
                                                                disabled={product.quantity <= 1}
                                                            >
                                                                <Minus size={13} />
                                                            </button>
                                                            <span className="w-8 text-center text-sm font-medium text-gray-900">
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
                                                                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-blush-50 transition disabled:opacity-40"
                                                                disabled={product.variantStock !== null && product.quantity >= product.variantStock}
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                        </div>
                                                        {product.variantStock !== null && product.variantStock <= 5 && (
                                                            <span className={`text-[10px] ${product.variantStock === 0 ? 'text-burgundy-600' : 'text-amber-600'}`}>
                                                                {product.variantStock === 0 ? 'Rupture de stock' : `Plus que ${product.variantStock}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="font-semibold text-gray-900 text-sm">{(product.offerPrice * product.quantity).toLocaleString()} {currency}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <button
                            onClick={() => { navigate("/products"); scrollTo(0, 0) }}
                            className="flex items-center gap-1.5 text-burgundy-700 hover:text-burgundy-800 transition text-sm font-medium mt-4"
                        >
                            <ArrowRight size={14} />
                            Continuer mes achats
                        </button>
                    </div>

                    {/* Colonne droite - Récapitulatif */}
                    <div className="lg:w-96 mt-6 lg:mt-0">
                        <div className="bg-white rounded-2xl p-5 border border-blush-200 lg:sticky lg:top-20">
                            <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">Récapitulatif</h2>

                            {/* Adresse */}
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin size={15} className="text-burgundy-600" />
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Adresse de livraison</span>
                                </div>
                                <div className="bg-blush-50 rounded-xl p-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <p className="text-xs text-gray-600 flex-1">{formatAddress(selectedAddress)}</p>
                                        <button onClick={() => setShowAddress(!showAddress)} className="text-burgundy-700 text-xs font-medium shrink-0">
                                            Changer
                                        </button>
                                    </div>
                                    {showAddress && (
                                        <div className="mt-2 pt-2 border-t border-blush-200 space-y-2">
                                            {addresses.map((address, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-xs">
                                                    <p className="text-gray-600 cursor-pointer hover:text-burgundy-700 flex-1" onClick={() => { setSelectedAddress(address); setShowAddress(false) }}>
                                                        {formatAddress(address)}
                                                    </p>
                                                    <button onClick={() => deleteAddress(address._id)} className="text-burgundy-400 text-[10px] hover:text-burgundy-600 ml-2">
                                                        Supprimer
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={() => navigate("/add-address")} className="flex items-center gap-1 text-burgundy-700 text-xs mt-2 font-medium">
                                                <Plus size={12} /> Ajouter une adresse
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Livraison */}
                            {deliveryTypes.length > 0 && selectedAddress?.communeId && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Truck size={15} className="text-burgundy-600" />
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mode de livraison</span>
                                    </div>
                                    <div className="relative">
                                        <select
                                            value={selectedDeliveryType?._id || ''}
                                            onChange={(e) => {
                                                const type = deliveryTypes.find(t => t._id === e.target.value);
                                                setSelectedDeliveryType(type);
                                            }}
                                            className="w-full appearance-none bg-blush-50 border border-transparent rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:border-burgundy-400 outline-none"
                                        >
                                            {deliveryTypes.map(type => <option key={type._id} value={type._id}>{type.name}</option>)}
                                        </select>
                                        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {/* Paiement */}
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CreditCard size={15} className="text-burgundy-600" />
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Moyen de paiement</span>
                                </div>
                                <div className="relative">
                                    <select
                                        onChange={e => setPaymentOption(e.target.value)}
                                        value={paymentOption}
                                        className="w-full appearance-none bg-blush-50 border border-transparent rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:border-burgundy-400 outline-none"
                                    >
                                        <option value="" disabled>Sélectionner un moyen de paiement</option>
                                        <option value="GeniusPay">Mobile Money (Orange, MTN, Moov)</option>
                                    </select>
                                    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Code promo */}
                            <div className="flex items-center gap-2 mb-2">
                                <Tag size={15} className="text-burgundy-600" />
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Code promo</span>
                            </div>
                            <CouponInput amount={originalAmount} items={selectedArray.map(p => ({ product: p._id, quantity: p.quantity }))} onCouponApplied={handleCouponApplied} />

                            {/* Totaux */}
                            <div className="mt-4 pt-3 border-t border-blush-100 space-y-1.5">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Sous-total ({selectedArray.length})</span>
                                    <span>{originalAmount.toLocaleString()} {currency}</span>
                                </div>
                                {appliedCoupon && (
                                    <div className="flex justify-between text-xs text-emerald-600">
                                        <span>Réduction ({appliedCoupon.code})</span>
                                        <span>- {appliedCoupon.discountAmount.toLocaleString()} {currency}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Frais de livraison</span>
                                    <span className={deliveryPrice === 0 ? 'text-emerald-600' : ''}>
                                        {loadingDelivery ? 'Chargement...' : deliveryPrice === 0 ? 'Gratuite' : `${deliveryPrice.toLocaleString()} ${currency}`}
                                    </span>
                                </div>
                                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-blush-100">
                                    <span>Total</span>
                                    <span className="text-burgundy-700">{finalAmount.toLocaleString()} {currency}</span>
                                </div>
                            </div>

                            <button
                                onClick={placeOrder}
                                disabled={selectedArray.length === 0}
                                className="w-full mt-5 bg-burgundy-600 text-white py-3.5 rounded-full font-semibold text-sm hover:bg-burgundy-700 transition shadow-md shadow-burgundy-900/10 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Passer la commande {selectedArray.length > 0 && `(${selectedArray.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Barre sticky mobile */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-blush-200 px-4 py-3 flex items-center justify-between gap-4 z-20">
                <div>
                    <p className="text-[11px] text-gray-400">Total ({selectedArray.length})</p>
                    <p className="font-bold text-gray-900">{finalAmount.toLocaleString()} {currency}</p>
                </div>
                <button
                    onClick={placeOrder}
                    disabled={selectedArray.length === 0}
                    className="flex-1 max-w-[220px] bg-burgundy-600 text-white py-3 rounded-full font-semibold text-sm hover:bg-burgundy-700 transition disabled:opacity-40"
                >
                    Passer la commande
                </button>
            </div>
        </div>
    )
}

export default Cart;