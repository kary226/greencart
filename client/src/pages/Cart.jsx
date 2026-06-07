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
                    } else if (data.success && data.order && data.order.isPaid) {
                        sessionStorage.removeItem('pendingOrderId');
                    }
                } catch (error) {
                    console.error(error);
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
                        // Redirection directe vers GeniusPay (même onglet)
                        window.location.href = data.checkout_url;
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

    return (
        <div className="cart-page">
            <div className="cart-container">
                <h1 className="cart-title">
                    Mon panier <span className="cart-count">{getCartCount()} articles</span>
                </h1>

                {/* Grille des produits */}
                <div className="cart-products">
                    <div className="cart-header">
                        <p>Détails du produit</p>
                        <p>Sous-total</p>
                        <p>Action</p>
                    </div>

                    {cartArray.map((product, index) => (
                        <div key={index} className="cart-item">
                            <div className="cart-item-info">
                                <div onClick={() => {
                                    navigate(`/products/${product.category?.toLowerCase() || 'all'}/${product._id}`);
                                    scrollTo(0, 0)
                                }} className="cart-item-img">
                                    <img src={product.image[0]} alt={product.name} />
                                </div>
                                <div className="cart-item-details">
                                    <p className="cart-item-name">{product.name}</p>
                                    <div className="cart-item-variants">
                                        {product.selectedColor && (
                                            <span className="variant-tag">🎨 {product.selectedColor}</span>
                                        )}
                                        {product.selectedSize && (
                                            <span className="variant-tag">📐 {product.selectedSize}</span>
                                        )}
                                    </div>
                                    <div className="cart-item-quantity">
                                        <p>Qté :</p>
                                        <select onChange={e => {
                                            const newQty = Number(e.target.value)
                                            if (product.variantStock !== null && newQty > product.variantStock) {
                                                toast.error(`Stock limité à ${product.variantStock} unités !`)
                                                return
                                            }
                                            updateCartItem(product.cartKey, newQty)
                                        }} value={product.quantity}>
                                            {Array(Math.min(product.variantStock || 10, 10)).fill('').map((_, i) => (
                                                <option key={i} value={i + 1}>{i + 1}</option>
                                            ))}
                                        </select>
                                        {product.variantStock !== null && (
                                            <span className={`stock-badge ${product.variantStock === 0 ? 'stock-out' :
                                                    product.variantStock <= 5 ? 'stock-low' : 'stock-ok'
                                                }`}>
                                                ({product.variantStock} en stock)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <p className="cart-item-subtotal">{product.offerPrice * product.quantity} {currency}</p>
                            <button onClick={() => removeFromCart(product.cartKey)} className="cart-item-remove">
                                <img src={assets.remove_icon} alt="remove" />
                            </button>
                        </div>
                    ))}

                    <button onClick={() => { navigate("/products"); scrollTo(0, 0) }} className="continue-shopping">
                        <img src={assets.arrow_right_icon_colored} alt="arrow" />
                        Continuer mes achats
                    </button>
                </div>
            </div>

            {/* BANDE FLOTTANTE POUR LE RÉCAPITULATIF */}
            {cartArray.length > 0 && (
                <div className="cart-floating-bar">
                    <div className="floating-content">
                        <div className="floating-total">
                            <span className="total-label">Total</span>
                            <span className="total-price">{finalAmount} {currency}</span>
                        </div>
                        <button onClick={placeOrder} className="floating-checkout-btn">
                            Procéder au paiement
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .cart-page {
                    margin-top: 64px;
                    padding-bottom: 90px;
                    background: #faf8f5;
                    min-height: 100vh;
                }

                .cart-container {
                    max-width: 768px;
                    margin: 0 auto;
                    padding: 20px 16px;
                }

                .cart-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: #111;
                    margin-bottom: 24px;
                }

                .cart-count {
                    font-size: 14px;
                    color: #888;
                    font-weight: normal;
                }

                .cart-products {
                    background: white;
                    border-radius: 20px;
                    padding: 20px;
                }

                .cart-header {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #f0ede8;
                    font-size: 13px;
                    color: #999;
                    font-weight: 500;
                }

                .cart-item {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr;
                    align-items: center;
                    padding: 16px 0;
                    border-bottom: 1px solid #f0ede8;
                }

                .cart-item-info {
                    display: flex;
                    gap: 16px;
                }

                .cart-item-img {
                    width: 80px;
                    height: 80px;
                    border-radius: 12px;
                    overflow: hidden;
                    cursor: pointer;
                    background: #f5f3f0;
                    flex-shrink: 0;
                }

                .cart-item-img img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .cart-item-details {
                    flex: 1;
                }

                .cart-item-name {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 6px;
                    font-size: 14px;
                }

                .cart-item-variants {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                    margin-bottom: 8px;
                }

                .variant-tag {
                    font-size: 10px;
                    background: #f5f3f0;
                    padding: 2px 8px;
                    border-radius: 20px;
                    color: #666;
                }

                .cart-item-quantity {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    color: #666;
                }

                .cart-item-quantity select {
                    border: 1px solid #e8e3dc;
                    border-radius: 8px;
                    padding: 4px 8px;
                    outline: none;
                    background: white;
                }

                .stock-badge {
                    font-size: 10px;
                }
                .stock-ok { color: #4caf50; }
                .stock-low { color: #ff9800; }
                .stock-out { color: #e53935; }

                .cart-item-subtotal {
                    text-align: center;
                    font-weight: 600;
                    color: #111;
                }

                .cart-item-remove {
                    background: none;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                }

                .cart-item-remove img {
                    width: 20px;
                    height: 20px;
                    opacity: 0.5;
                    transition: opacity 0.2s;
                }
                .cart-item-remove img:hover { opacity: 1; }

                .continue-shopping {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: none;
                    border: none;
                    margin-top: 20px;
                    color: #111;
                    font-weight: 500;
                    font-size: 13px;
                    cursor: pointer;
                }

                .continue-shopping img {
                    width: 16px;
                    transition: transform 0.2s;
                }
                .continue-shopping:hover img {
                    transform: translateX(-3px);
                }

                /* BANDE FLOTTANTE */
                .cart-floating-bar {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(255,255,255,0.98);
                    backdrop-filter: blur(10px);
                    border-top: 1px solid #eee;
                    padding: 12px 20px;
                    z-index: 100;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
                }

                .floating-content {
                    max-width: 768px;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 20px;
                }

                .floating-total {
                    display: flex;
                    flex-direction: column;
                }

                .total-label {
                    font-size: 11px;
                    color: #999;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .total-price {
                    font-size: 20px;
                    font-weight: 700;
                    color: #111;
                }

                .floating-checkout-btn {
                    background: #111;
                    color: white;
                    border: none;
                    padding: 14px 28px;
                    border-radius: 40px;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                .floating-checkout-btn:hover {
                    background: #333;
                    transform: scale(1.02);
                }
            `}</style>
        </div>
    )
}

export default Cart;