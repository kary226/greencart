import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";
import toast from "react-hot-toast";
import CouponInput from "../components/CouponInput";
import { ShoppingBag, Trash2, ArrowRight, MapPin, Truck, CreditCard, Tag, ChevronDown, Plus, X } from "lucide-react";

const Cart = () => {
    const { products, currency, cartItems, removeFromCart, getCartCount, updateCartItem, navigate, getCartAmount, axios, user, setCartItems, getProductIdFromKey } = useAppContext()
    const [cartArray, setCartArray] = useState([])
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

    const getCart = ()=>{
        let tempArray = []
        for(const key in cartItems){
            const productId = getProductIdFromKey(key)
            const product = products.find((item)=>item._id === productId)
            if(product){
                const parts = key.split('_')
                const color = parts[1] || null
                const size = parts[2] || null

                const variant = product.variants?.find(v =>
                    (color ? v.color === color : !v.color) &&
                    (size ? v.size === size : !v.size)
                ) || product.variants?.find(v =>
                    (color ? v.color === color : true) &&
                    (size ? v.size === size : true)
                )

                tempArray.push({
                    ...product,
                    cartKey: key,
                    quantity: cartItems[key],
                    selectedColor: color,
                    selectedSize: size,
                    variantStock: variant ? variant.stock : null
                })
            }
        }
        setCartArray(tempArray)
    }

    const getUserAddress = async ()=>{
        try {
            const {data} = await axios.get('/api/address/get');
            if (data.success){
                setAddresses(data.addresses)
                if(data.addresses.length > 0){
                    setSelectedAddress(data.addresses[0])
                }
            }else{
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

    const originalAmount = getCartAmount();
    const finalAmount = (discountedAmount !== null ? discountedAmount : originalAmount) + deliveryPrice;

    // Détection d'un paiement abandonné
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

    useEffect(()=>{
        if(products.length > 0 && cartItems){
            getCart()
        }
    },[products, cartItems])

    useEffect(()=>{
        if(user){
            getUserAddress()
        }
    },[user])

    const placeOrder = async () => {
        try {
            if(!selectedAddress){
                return toast.error("Veuillez sélectionner une adresse")
            }

            if (!paymentOption) {
                toast.error("Veuillez sélectionner un moyen de paiement")
                return
            }

            const items = cartArray.map(item => ({
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

            if(paymentOption === "COD"){
                const {data} = await axios.post('/api/order/cod', {
                    userId: user._id,
                    items,
                    address: selectedAddress._id,
                    couponApplied: appliedCoupon ? appliedCoupon.code : null,
                    discountAmount: appliedCoupon ? (originalAmount - discountedAmount) : 0,
                    deliveryPrice: deliveryPrice,
                    deliveryType: selectedDeliveryType?.name
                })
                if(data.success){
                    toast.success(data.message)
                    setCartItems({})
                    navigate('/my-orders')
                }else{
                    toast.error(data.message)
                }
            }else if(paymentOption === "Online"){
                const {data} = await axios.post('/api/order/stripe', {
                    userId: user._id,
                    items,
                    address: selectedAddress._id,
                    couponApplied: appliedCoupon ? appliedCoupon.code : null,
                    discountAmount: appliedCoupon ? (originalAmount - discountedAmount) : 0,
                    deliveryPrice: deliveryPrice,
                    deliveryType: selectedDeliveryType?.name
                })
                if(data.success){
                    window.location.replace(data.url)
                }else{
                    toast.error(data.message)
                }
            }else if(paymentOption === "GeniusPay"){
                try {
                    toast.loading("Préparation du paiement...", { id: "geniuspay" });
                    
                    const { data } = await axios.post('/api/order/geniuspay/initiate', {
                        userId: user._id,
                        items: cartArray.map(item => ({ 
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
                    
                    if(data.success && data.checkout_url){
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
            <div className="min-h-screen bg-white pt-20 pb-16 px-4">
                <div className="max-w-md mx-auto text-center">
                    <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShoppingBag size={48} className="text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Votre panier est vide</h2>
                    <p className="text-gray-500 mb-6">Ajoutez des produits à votre panier pour continuer</p>
                    <button 
                        onClick={() => navigate("/products")} 
                        className="bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition shadow-lg"
                    >
                        Découvrir nos produits
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white pt-20 pb-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* En-tête */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Mon panier</h1>
                    <p className="text-gray-500 mt-1">{getCartCount()} article(s)</p>
                    <div className="w-20 h-1 bg-red-500 rounded-full mt-3"></div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Colonne gauche - Produits */}
                    <div className="lg:col-span-2 space-y-4">
                        {cartArray.map((product, index) => (
                            <div key={index} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
                                <div className="flex gap-4">
                                    <div 
                                        onClick={() => {
                                            navigate(`/products/${product.category?.toLowerCase() || 'all'}/${product._id}`);
                                            scrollTo(0, 0)
                                        }} 
                                        className="w-24 h-24 rounded-xl overflow-hidden cursor-pointer bg-gray-50 flex-shrink-0"
                                    >
                                        <img src={product.image[0]} alt={product.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{product.name}</h3>
                                                <div className="flex gap-2 mt-1">
                                                    {product.selectedColor && (
                                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                            {product.selectedColor}
                                                        </span>
                                                    )}
                                                    {product.selectedSize && (
                                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                            {product.selectedSize}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeFromCart(product.cartKey)} 
                                                className="text-gray-400 hover:text-red-500 transition"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-end mt-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-gray-500">Qté :</span>
                                                <select 
                                                    onChange={e => {
                                                        const newQty = Number(e.target.value)
                                                        if (product.variantStock !== null && newQty > product.variantStock) {
                                                            toast.error(`Stock limité à ${product.variantStock} unités !`)
                                                            return
                                                        }
                                                        updateCartItem(product.cartKey, newQty)
                                                    }} 
                                                    value={product.quantity}
                                                    className="border border-gray-200 rounded-lg px-3 py-1 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                                >
                                                    {Array(Math.min(product.variantStock || 10, 10)).fill('').map((_, i) => (
                                                        <option key={i} value={i + 1}>{i + 1}</option>
                                                    ))}
                                                </select>
                                                {product.variantStock !== null && (
                                                    <span className={`text-xs ${product.variantStock === 0 ? 'text-red-500' : product.variantStock <= 5 ? 'text-orange-500' : 'text-green-600'}`}>
                                                        ({product.variantStock} en stock)
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-bold text-gray-900">{product.offerPrice * product.quantity} {currency}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button 
                            onClick={() => { navigate("/products"); scrollTo(0, 0) }} 
                            className="flex items-center gap-2 text-gray-500 hover:text-black transition mt-4"
                        >
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition" />
                            Continuer mes achats
                        </button>
                    </div>

                    {/* Colonne droite - Récapitulatif */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-50 rounded-2xl p-6 sticky top-24">
                            <h2 className="text-xl font-bold text-gray-900 mb-6">Récapitulatif</h2>
                            
                            {/* Adresse */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <MapPin size={18} className="text-red-500" />
                                    <span className="text-sm font-medium text-gray-700">Adresse de livraison</span>
                                </div>
                                <div className="bg-white rounded-xl p-3">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm text-gray-600 flex-1">{formatAddress(selectedAddress)}</p>
                                        <button onClick={() => setShowAddress(!showAddress)} className="text-red-500 text-sm font-medium hover:text-red-600">
                                            Changer
                                        </button>
                                    </div>
                                    {showAddress && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                            {addresses.map((address, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-sm">
                                                    <p className="text-gray-600 cursor-pointer hover:text-black" onClick={() => { setSelectedAddress(address); setShowAddress(false) }}>
                                                        {formatAddress(address)}
                                                    </p>
                                                    <button onClick={() => deleteAddress(address._id)} className="text-red-400 text-xs hover:text-red-600">
                                                        Supprimer
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={() => navigate("/add-address")} className="flex items-center gap-1 text-red-500 text-sm mt-2">
                                                <Plus size={14} /> Ajouter une adresse
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Livraison */}
                            {deliveryTypes.length > 0 && selectedAddress?.communeId && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Truck size={18} className="text-red-500" />
                                        <span className="text-sm font-medium text-gray-700">Mode de livraison</span>
                                    </div>
                                    <select 
                                        value={selectedDeliveryType?._id || ''} 
                                        onChange={(e) => {
                                            const type = deliveryTypes.find(t => t._id === e.target.value);
                                            setSelectedDeliveryType(type);
                                        }}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    >
                                        {deliveryTypes.map(type => <option key={type._id} value={type._id}>{type.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Paiement */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <CreditCard size={18} className="text-red-500" />
                                    <span className="text-sm font-medium text-gray-700">Moyen de paiement</span>
                                </div>
                                <select 
                                    onChange={e => setPaymentOption(e.target.value)} 
                                    value={paymentOption}
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                >
                                    <option value="" disabled>Sélectionner un moyen de paiement</option>
                                    <option value="GeniusPay">Mobile Money (Wave, Orange, MTN)</option>
                                </select>
                            </div>

                            <CouponInput amount={originalAmount} onCouponApplied={handleCouponApplied} />

                            {/* Totaux */}
                            <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Sous-total</span>
                                    <span>{originalAmount} {currency}</span>
                                </div>
                                {appliedCoupon && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Réduction ({appliedCoupon.code})</span>
                                        <span>- {appliedCoupon.discountAmount} {currency}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Frais de livraison</span>
                                    <span className={deliveryPrice === 0 ? 'text-green-600' : ''}>
                                        {loadingDelivery ? 'Chargement...' : deliveryPrice === 0 ? 'Gratuit' : `${deliveryPrice} ${currency}`}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                                    <span>Total</span>
                                    <span className="text-red-500">{finalAmount} {currency}</span>
                                </div>
                            </div>

                            <button 
                                onClick={placeOrder} 
                                className="w-full mt-6 bg-black text-white py-3 rounded-full font-semibold hover:bg-gray-800 transition shadow-lg"
                            >
                                Confirmer et payer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Cart;