import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import CouponInput from "../components/CouponInput";

const Checkout = () => {
    const { products, currency, cartItems, getCartAmount, getCartCount, getProductIdFromKey, axios, user, setCartItems } = useAppContext();
    const navigate = useNavigate();
    
    const [cartArray, setCartArray] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [showAddress, setShowAddress] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [paymentOption, setPaymentOption] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [discountedAmount, setDiscountedAmount] = useState(null);
    
    const [deliveryTypes, setDeliveryTypes] = useState([]);
    const [selectedDeliveryType, setSelectedDeliveryType] = useState(null);
    const [deliveryPrice, setDeliveryPrice] = useState(0);
    const [loadingDelivery, setLoadingDelivery] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

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
        let tempArray = [];
        for (const key in cartItems) {
            const productId = getProductIdFromKey(key);
            const product = products.find((item) => item._id === productId);
            if (product) {
                const parts = key.split('_');
                const color = parts[1] || null;
                const size = parts[2] || null;

                const variant = product.variants?.find(v =>
                    (color ? v.color === color : !v.color) &&
                    (size ? v.size === size : !v.size)
                ) || product.variants?.find(v =>
                    (color ? v.color === color : true) &&
                    (size ? v.size === size : true)
                );

                tempArray.push({
                    ...product,
                    cartKey: key,
                    quantity: cartItems[key],
                    selectedColor: color,
                    selectedSize: size,
                    variantStock: variant ? variant.stock : null
                });
            }
        }
        setCartArray(tempArray);
    };

    const getUserAddress = async () => {
        try {
            const { data } = await axios.get('/api/address/get');
            if (data.success) {
                setAddresses(data.addresses);
                if (data.addresses.length > 0) {
                    setSelectedAddress(data.addresses[0]);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchDeliveryTypes = async () => {
        try {
            const { data } = await axios.get('/api/delivery/types');
            if (data.success && data.types.length > 0) {
                setDeliveryTypes(data.types);
                setSelectedDeliveryType(data.types[0]);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchDeliveryPrice = async () => {
        if (!selectedAddress?.communeId || !selectedDeliveryType?._id) {
            setDeliveryPrice(0);
            return;
        }
        setLoadingDelivery(true);
        try {
            const { data } = await axios.get(`/api/delivery/price/${selectedAddress.communeId}/${selectedDeliveryType._id}`);
            if (data.success && data.price) {
                setDeliveryPrice(data.price.price);
            } else {
                setDeliveryPrice(0);
            }
        } catch (error) {
            console.error(error);
            setDeliveryPrice(0);
        } finally {
            setLoadingDelivery(false);
        }
    };

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
        fetchDeliveryTypes();
    }, []);

    useEffect(() => {
        if (selectedAddress && selectedDeliveryType) {
            fetchDeliveryPrice();
        }
    }, [selectedAddress, selectedDeliveryType]);

    useEffect(() => {
        if (products.length > 0 && cartItems) {
            getCart();
        }
    }, [products, cartItems]);

    useEffect(() => {
        if (user) {
            getUserAddress();
        } else {
            navigate('/cart');
        }
    }, [user]);

    useEffect(() => {
        if (cartArray.length === 0 && products.length > 0) {
            navigate('/cart');
        }
    }, [cartArray, products]);

    const placeOrder = async () => {
        if (isProcessing) return;
        
        try {
            if (!selectedAddress) {
                toast.error("Veuillez sélectionner une adresse");
                return;
            }

            if (!paymentOption) {
                toast.error("Veuillez sélectionner un moyen de paiement");
                return;
            }

            setIsProcessing(true);
            toast.loading("Traitement en cours...", { id: "order" });

            const items = cartArray.map(item => ({
                product: item._id,
                quantity: item.quantity,
                selectedColor: item.selectedColor,
                selectedSize: item.selectedSize,
                offerPrice: item.offerPrice
            }));

            if (appliedCoupon) {
                await axios.post('/api/coupon/apply', {
                    couponId: appliedCoupon.id,
                    userId: user._id
                });
            }

            if (paymentOption === "GeniusPay") {
                const { data } = await axios.post('/api/order/geniuspay/initiate', {
                    userId: user._id,
                    items: items,
                    address: selectedAddress._id,
                    amount: finalAmount,
                    deliveryPrice: deliveryPrice,
                    deliveryType: selectedDeliveryType?.name,
                    couponApplied: appliedCoupon ? appliedCoupon.code : null,
                    discountAmount: appliedCoupon ? (originalAmount - discountedAmount) : 0
                });
                
                toast.dismiss("order");
                
                if (data.success) {
                    window.location.href = data.checkout_url;
                } else {
                    toast.error(data.message);
                    setIsProcessing(false);
                }
            }
        } catch (error) {
            toast.dismiss("order");
            toast.error(error.response?.data?.message || error.message);
            setIsProcessing(false);
        }
    };

    if (cartArray.length === 0) return null;

    return (
        <div className="checkout-page">
            <div className="checkout-container">
                <h1 className="checkout-title">Finaliser ma commande</h1>

                <div className="checkout-layout">
                    {/* Colonne gauche - Récapitulatif des produits */}
                    <div className="checkout-products">
                        <h2 className="section-title">Vos articles ({getCartCount()})</h2>
                        
                        {cartArray.map((product, index) => (
                            <div key={index} className="checkout-product-item">
                                <img src={product.image[0]} alt={product.name} className="checkout-product-img" />
                                <div className="checkout-product-info">
                                    <p className="checkout-product-name">{product.name}</p>
                                    <div className="checkout-product-variants">
                                        {product.selectedColor && (
                                            <span className="variant-badge">Couleur: {product.selectedColor}</span>
                                        )}
                                        {product.selectedSize && (
                                            <span className="variant-badge">Taille: {product.selectedSize}</span>
                                        )}
                                    </div>
                                    <p className="checkout-product-qty">Quantité: {product.quantity}</p>
                                </div>
                                <p className="checkout-product-price">{product.offerPrice * product.quantity} {currency}</p>
                            </div>
                        ))}
                    </div>

                    {/* Colonne droite - Paiement */}
                    <div className="checkout-summary">
                        <h2 className="section-title">Récapitulatif</h2>
                        
                        <div className="summary-section">
                            <p className="summary-label">Adresse de livraison</p>
                            <div className="address-row">
                                <p className="address-text">{formatAddress(selectedAddress)}</p>
                                <button onClick={() => setShowAddress(!showAddress)} className="change-btn">
                                    Changer
                                </button>
                            </div>
                            {showAddress && (
                                <div className="address-dropdown">
                                    {addresses.map((address, index) => (
                                        <div key={index} className="address-option">
                                            <p onClick={() => { setSelectedAddress(address); setShowAddress(false) }} className="address-option-text">
                                                {formatAddress(address)}
                                            </p>
                                            <button onClick={() => deleteAddress(address._id)} className="delete-address-btn">
                                                Supprimer
                                            </button>
                                        </div>
                                    ))}
                                    <p onClick={() => navigate("/add-address")} className="add-address-btn">
                                        + Ajouter une adresse
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Type de livraison */}
                        {deliveryTypes.length > 0 && selectedAddress?.communeId && (
                            <div className="summary-section">
                                <p className="summary-label">Mode de livraison</p>
                                <select
                                    value={selectedDeliveryType?._id || ''}
                                    onChange={(e) => {
                                        const type = deliveryTypes.find(t => t._id === e.target.value);
                                        setSelectedDeliveryType(type);
                                    }}
                                    className="delivery-select"
                                >
                                    {deliveryTypes.map(type => (
                                        <option key={type._id} value={type._id}>{type.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Moyen de paiement */}
                        <div className="summary-section">
                            <p className="summary-label">Moyen de paiement</p>
                            <select
                                onChange={e => setPaymentOption(e.target.value)}
                                value={paymentOption}
                                className="payment-select"
                            >
                                <option value="" disabled>Sélectionner un moyen de paiement</option>
                                <option value="GeniusPay">Mobile Money (Wave, Orange, MTN)</option>
                            </select>
                        </div>

                        <CouponInput amount={originalAmount} onCouponApplied={handleCouponApplied} />

                        {/* Totaux */}
                        <div className="totals-section">
                            <div className="total-row">
                                <span>Sous-total</span>
                                <span>{originalAmount} {currency}</span>
                            </div>
                            {appliedCoupon && (
                                <div className="total-row discount">
                                    <span>Réduction ({appliedCoupon.code})</span>
                                    <span>- {appliedCoupon.discountAmount} {currency}</span>
                                </div>
                            )}
                            <div className="total-row">
                                <span>Frais de livraison</span>
                                <span className={deliveryPrice === 0 ? 'free' : ''}>
                                    {loadingDelivery ? 'Chargement...' : deliveryPrice === 0 ? 'Gratuit' : `${deliveryPrice} ${currency}`}
                                </span>
                            </div>
                            <div className="total-row grand-total">
                                <span>Total</span>
                                <span>{finalAmount} {currency}</span>
                            </div>
                        </div>

                        <button 
                            onClick={placeOrder} 
                            disabled={isProcessing || !paymentOption || !selectedAddress}
                            className="confirm-btn"
                        >
                            {isProcessing ? "Traitement..." : "Confirmer et payer"}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .checkout-page {
                    margin-top: 64px;
                    padding-bottom: 40px;
                    background: #faf8f5;
                    min-height: 100vh;
                }

                .checkout-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px 16px;
                }

                .checkout-title {
                    font-size: 28px;
                    font-weight: 600;
                    color: #111;
                    margin-bottom: 32px;
                }

                .checkout-layout {
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                @media (min-width: 1024px) {
                    .checkout-layout {
                        flex-direction: row;
                    }
                }

                .checkout-products {
                    flex: 1;
                    background: white;
                    border-radius: 20px;
                    padding: 24px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }

                .checkout-summary {
                    width: 100%;
                    background: white;
                    border-radius: 20px;
                    padding: 24px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    height: fit-content;
                    position: sticky;
                    top: 80px;
                }

                @media (min-width: 1024px) {
                    .checkout-summary {
                        width: 380px;
                    }
                }

                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #111;
                    margin-bottom: 20px;
                }

                .checkout-product-item {
                    display: flex;
                    gap: 16px;
                    padding: 16px 0;
                    border-bottom: 1px solid #f0ede8;
                }

                .checkout-product-item:last-child {
                    border-bottom: none;
                }

                .checkout-product-img {
                    width: 70px;
                    height: 70px;
                    border-radius: 12px;
                    object-fit: cover;
                    background: #f5f3f0;
                }

                .checkout-product-info {
                    flex: 1;
                }

                .checkout-product-name {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 6px;
                    font-size: 14px;
                }

                .checkout-product-variants {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                    margin-bottom: 6px;
                }

                .variant-badge {
                    font-size: 10px;
                    background: #f5f3f0;
                    padding: 2px 8px;
                    border-radius: 20px;
                    color: #666;
                }

                .checkout-product-qty {
                    font-size: 12px;
                    color: #888;
                }

                .checkout-product-price {
                    font-weight: 600;
                    color: #111;
                    white-space: nowrap;
                }

                .summary-section {
                    margin-bottom: 24px;
                }

                .summary-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                }

                .address-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                }

                .address-text {
                    font-size: 14px;
                    color: #333;
                    flex: 1;
                    line-height: 1.4;
                }

                .change-btn {
                    background: none;
                    border: none;
                    color: #111;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                }

                .address-dropdown {
                    margin-top: 12px;
                    background: #faf8f5;
                    border-radius: 12px;
                    padding: 8px;
                }

                .address-option {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                }

                .address-option-text {
                    flex: 1;
                    cursor: pointer;
                    font-size: 13px;
                }

                .delete-address-btn {
                    background: none;
                    border: none;
                    color: #e53935;
                    font-size: 11px;
                    cursor: pointer;
                }

                .add-address-btn {
                    text-align: center;
                    padding: 10px;
                    color: #111;
                    font-weight: 500;
                    font-size: 13px;
                    cursor: pointer;
                    margin-top: 8px;
                }

                .delivery-select, .payment-select {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #e8e3dc;
                    border-radius: 12px;
                    background: white;
                    font-size: 14px;
                    outline: none;
                }

                .totals-section {
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px solid #f0ede8;
                }

                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    font-size: 14px;
                    color: #666;
                }

                .total-row.discount {
                    color: #4caf50;
                }

                .grand-total {
                    font-size: 18px;
                    font-weight: 700;
                    color: #111;
                    border-top: 1px solid #f0ede8;
                    margin-top: 8px;
                    padding-top: 12px;
                }

                .free {
                    color: #4caf50;
                }

                .confirm-btn {
                    width: 100%;
                    padding: 14px;
                    background: #111;
                    color: white;
                    border: none;
                    border-radius: 40px;
                    font-weight: 600;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-top: 24px;
                }

                .confirm-btn:hover:not(:disabled) {
                    background: #333;
                    transform: scale(1.02);
                }

                .confirm-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};

export default Checkout;