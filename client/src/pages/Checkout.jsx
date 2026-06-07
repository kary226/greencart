import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";
import toast from "react-hot-toast";
import CouponInput from "../components/CouponInput";

const Checkout = () => {
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
            <div className="mt-16 text-center py-20">
                <p className="text-gray-400 mb-4">Votre panier est vide</p>
                <button onClick={() => navigate("/products")} className="px-6 py-2 bg-primary text-white rounded-lg">
                    Découvrir nos produits
                </button>
            </div>
        );
    }

    return (
        <div className="mt-16 pb-16">
            <div className="max-w-6xl mx-auto px-4">
                <h1 className="text-3xl font-medium mb-6">Finaliser ma commande</h1>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Colonne gauche - Liste des produits */}
                    <div className='flex-1 bg-white rounded-lg p-5 shadow-sm'>
                        <h2 className="text-xl font-medium mb-4">Vos articles ({getCartCount()})</h2>

                        {cartArray.map((product, index) => (
                            <div key={index} className="flex gap-4 py-4 border-b border-gray-200">
                                <img className="w-20 h-20 object-cover rounded-lg" src={product.image[0]} alt={product.name} />
                                <div className="flex-1">
                                    <p className="font-semibold">{product.name}</p>
                                    <div className="flex gap-2 mt-1 flex-wrap">
                                        {product.selectedColor && (
                                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">Couleur: {product.selectedColor}</span>
                                        )}
                                        {product.selectedSize && (
                                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">Taille: {product.selectedSize}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">Quantité: {product.quantity}</p>
                                </div>
                                <p className="font-medium">{product.offerPrice * product.quantity} {currency}</p>
                            </div>
                        ))}
                    </div>

                    {/* Colonne droite - Récapitulatif */}
                    <div className="lg:w-96 w-full bg-white rounded-lg p-5 shadow-sm border border-gray-200 h-fit sticky top-20">
                        <h2 className="text-xl font-medium">Récapitulatif</h2>
                        <hr className="border-gray-200 my-5" />

                        <div className="mb-6">
                            <p className="text-sm font-medium uppercase">Adresse de livraison</p>
                            <div className="relative flex justify-between items-start mt-2">
                                <p className="text-gray-500">{formatAddress(selectedAddress)}</p>
                                <button onClick={() => setShowAddress(!showAddress)} className="text-primary hover:underline cursor-pointer">
                                    Changer
                                </button>
                                {showAddress && (
                                    <div className="absolute top-12 py-1 bg-white border border-gray-300 text-sm w-full z-10 rounded-lg shadow-lg">
                                        {addresses.map((address, index)=>(
                                            <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-100">
                                                <p onClick={() => {setSelectedAddress(address); setShowAddress(false)}} className="flex-1 cursor-pointer">
                                                    {formatAddress(address)}
                                                </p>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteAddress(address._id);
                                                    }}
                                                    className="text-red-500 text-xs px-2 py-1 hover:bg-red-50 rounded"
                                                >
                                                    Supprimer
                                                </button>
                                            </div>
                                        ))}
                                        <p onClick={() => navigate("/add-address")} className="text-primary text-center cursor-pointer p-2 hover:bg-primary/10 rounded-b-lg">
                                            Ajouter une adresse
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Type de livraison */}
                            {deliveryTypes.length > 0 && selectedAddress?.communeId && (
                                <div className="mt-4">
                                    <p className="text-sm font-medium uppercase">Mode de livraison</p>
                                    <select
                                        value={selectedDeliveryType?._id || ''}
                                        onChange={(e) => {
                                            const type = deliveryTypes.find(t => t._id === e.target.value)
                                            setSelectedDeliveryType(type)
                                        }}
                                        className="w-full border border-gray-300 bg-white px-3 py-2 mt-2 outline-none rounded-lg"
                                    >
                                        {deliveryTypes.map(type => (
                                            <option key={type._id} value={type._id}>{type.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <p className="text-sm font-medium uppercase mt-6">Moyen de paiement</p>
                            <select 
                                onChange={e => setPaymentOption(e.target.value)} 
                                value={paymentOption}
                                className="w-full border border-gray-300 bg-white px-3 py-2 mt-2 outline-none rounded-lg"
                            >
                                <option value="" disabled>Sélectionner un moyen de paiement</option>
                                <option value="GeniusPay">Mobile Money (Wave, Orange, MTN)</option>
                            </select>
                        </div>

                        <hr className="border-gray-200" />

                        <CouponInput amount={originalAmount} onCouponApplied={handleCouponApplied} />

                        <div className="text-gray-500 mt-4 space-y-2">
                            <p className="flex justify-between">
                                <span>Prix</span><span>{originalAmount} {currency}</span>
                            </p>
                            {appliedCoupon && (
                                <p className="flex justify-between text-green-600">
                                    <span>Réduction ({appliedCoupon.code})</span>
                                    <span>- {appliedCoupon.discountAmount} {currency}</span>
                                </p>
                            )}
                            <p className="flex justify-between">
                                <span>Frais de livraison</span>
                                <span className={deliveryPrice === 0 ? 'text-green-600' : 'text-gray-700'}>
                                    {loadingDelivery ? 'Chargement...' : deliveryPrice === 0 ? 'Gratuit' : `${deliveryPrice} ${currency}`}
                                </span>
                            </p>
                            <p className="flex justify-between text-lg font-medium mt-3">
                                <span>Montant total :</span><span>{finalAmount} {currency}</span>
                            </p>
                        </div>

                        <button onClick={placeOrder} className="w-full py-3 mt-6 cursor-pointer bg-primary text-white font-medium hover:bg-primary-dull transition rounded-lg">
                            Confirmer et payer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Checkout;