import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";
import toast from "react-hot-toast";
import CouponInput from "../components/CouponInput";

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

    const getCart = () => {
        let tempArray = []
        for (const key in cartItems) {
            const productId = getProductIdFromKey(key)
            const product = products.find((item) => item._id === productId)
            if (product) {
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

    const originalAmount = getCartAmount();
    const finalAmount = (discountedAmount !== null ? discountedAmount : originalAmount) + deliveryPrice;

    // Détection d'un paiement abandonné (retour sans payer)
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

    useEffect(() => {
        if (user) {
            getUserAddress()
        }
    }, [user])

    const placeOrder = async () => {
        try {
            if (!selectedAddress) {
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
                    setCartItems({})
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

                    if (data.success && data.checkout_url) {
                        // Stocker l'orderId
                        sessionStorage.setItem('pendingOrderId', data.orderId);
                        
                        // Ouvrir une popup centrée
                        const width = 500;
                        const height = 600;
                        const left = window.screenX + (window.outerWidth - width) / 2;
                        const top = window.screenY + (window.outerHeight - height) / 2;
                        
                        const popup = window.open(
                            data.checkout_url,
                            'GeniusPay',
                            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
                        );
                        
                        if (!popup) {
                            toast.error("Popup bloquée. Autorisez les popups pour ce site.");
                            return;
                        }
                        
                        // Surveiller la fermeture de la popup
                        const checkPopupClosed = setInterval(async () => {
                            if (popup.closed) {
                                clearInterval(checkPopupClosed);
                                // Vérifier si le paiement a été effectué
                                const { data: orderData } = await axios.get(`/api/order/${data.orderId}`);
                                if (orderData.success && orderData.order && orderData.order.isPaid) {
                                    toast.success('Paiement réussi ! Commande confirmée.');
                                    setCartItems({});
                                    localStorage.removeItem('greencart_cart');
                                    sessionStorage.removeItem('pendingOrderId');
                                    navigate('/my-orders');
                                } else {
                                    toast.error('Paiement annulé ou non finalisé');
                                    sessionStorage.removeItem('pendingOrderId');
                                    // Optionnel : annuler la commande
                                    try {
                                        await axios.post('/api/order/cancel', { orderId: data.orderId });
                                    } catch (err) {
                                        console.error("Erreur annulation:", err);
                                    }
                                }
                            }
                        }, 1000);
                        
                        // Nettoyage après 5 minutes maximum
                        setTimeout(() => {
                            clearInterval(checkPopupClosed);
                            if (popup && !popup.closed) {
                                popup.close();
                                toast.error('Temps de paiement dépassé');
                                sessionStorage.removeItem('pendingOrderId');
                            }
                        }, 300000);
                    } else {
                        toast.error(data.message || "Erreur lors de l'initiation du paiement");
                    }
                } catch (error) {
                    toast.dismiss("geniuspay");
                    console.error("Erreur GeniusPay:", error);
                    toast.error(error.response?.data?.message || "Erreur de connexion");
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

    return products.length > 0 && cartItems ? (
        <div className="flex flex-col md:flex-row mt-16 gap-6">
            <div className='flex-1 max-w-4xl bg-white rounded-lg p-5 shadow-sm'>
                <h1 className="text-3xl font-medium mb-6">
                    Mon panier <span className="text-sm text-primary">{getCartCount()} articles</span>
                </h1>

                <div className="grid grid-cols-[2fr_1fr_1fr] text-gray-500 text-base font-medium pb-3 border-b">
                    <p className="text-left">Détails du produit</p>
                    <p className="text-center">Sous-total</p>
                    <p className="text-center">Action</p>
                </div>

                {cartArray.map((product, index) => (
                    <div key={index} className="grid grid-cols-[2fr_1fr_1fr] text-gray-500 items-center text-sm md:text-base font-medium pt-3 border-t border-gray-200">
                        <div className="flex items-center md:gap-6 gap-3">
                            <div onClick={() => {
                                navigate(`/products/${product.category.toLowerCase()}/${product._id}`);
                                scrollTo(0, 0)
                            }} className="cursor-pointer w-24 h-24 flex items-center justify-center border border-gray-300 rounded">
                                <img className="max-w-full h-full object-cover" src={product.image[0]} alt={product.name} />
                            </div>
                            <div>
                                <p className="hidden md:block font-semibold">{product.name}</p>

                                <div className="flex gap-2 mt-1 flex-wrap">
                                    {product.selectedColor && (
                                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                            🎨 {product.selectedColor}
                                        </span>
                                    )}
                                    {product.selectedSize && (
                                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                            📐 {product.selectedSize}
                                        </span>
                                    )}
                                </div>

                                <div className="font-normal text-gray-500/70 mt-1">
                                    <div className='flex items-center gap-1'>
                                        <p>Qté :</p>
                                        <select onChange={e => {
                                            const newQty = Number(e.target.value)
                                            if (product.variantStock !== null && newQty > product.variantStock) {
                                                toast.error(`Stock limité à ${product.variantStock} unités !`)
                                                return
                                            }
                                            updateCartItem(product.cartKey, newQty)
                                        }} value={product.quantity} className='outline-none border rounded px-2 py-1'>
                                            {Array(Math.min(product.variantStock || 10, 10)).fill('').map((_, i) => (
                                                <option key={i} value={i + 1}>{i + 1}</option>
                                            ))}
                                        </select>

                                        {product.variantStock !== null && (
                                            <span className={`text-xs ml-1 ${product.variantStock === 0 ? 'text-red-500' :
                                                    product.variantStock <= 5 ? 'text-orange-500' :
                                                        'text-green-600'
                                                }`}>
                                                ({product.variantStock} en stock)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-center">{product.offerPrice * product.quantity} {currency}</p>
                        <button onClick={() => removeFromCart(product.cartKey)} className="cursor-pointer mx-auto">
                            <img src={assets.remove_icon} alt="remove" className="inline-block w-6 h-6" />
                        </button>
                    </div>
                ))}

                <button onClick={() => { navigate("/products"); scrollTo(0, 0) }} className="group cursor-pointer flex items-center mt-8 gap-2 text-primary font-medium">
                    <img className="group-hover:-translate-x-1 transition" src={assets.arrow_right_icon_colored} alt="arrow" />
                    Continuer mes achats
                </button>
            </div>

            <div className="max-w-[360px] w-full bg-white rounded-lg p-5 shadow-sm border border-gray-200 h-fit sticky top-20">
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
                                {addresses.map((address, index) => (
                                    <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-100">
                                        <p onClick={() => { setSelectedAddress(address); setShowAddress(false) }} className="flex-1 cursor-pointer">
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
                    Procéder au paiement
                </button>
            </div>
        </div>
    ) : null
}

export default Cart;