import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dummyProducts } from "../assets/assets";
import toast from "react-hot-toast";
import axios from "axios";

axios.defaults.withCredentials = true;
axios.defaults.baseURL = 'https://greencart-yxo9.onrender.com';

export const AppContext = createContext();

export const AppContextProvider = ({children}) => {

    const currency = import.meta.env.VITE_CURRENCY;

    const navigate = useNavigate();
    const [user, setUser] = useState(null)
    const [isSeller, setIsSeller] = useState(false)
    const [showUserLogin, setShowUserLogin] = useState(false)
    const [products, setProducts] = useState([])
    const [cartItems, setCartItems] = useState({})
    const [searchQuery, setSearchQuery] = useState({})
    const [wishlist, setWishlist] = useState([])

    // Générer une clé unique pour chaque variant
    const getCartKey = (productId, color = null, size = null) => {
        return `${productId}${color ? `_${color}` : ''}${size ? `_${size}` : ''}`
    }

    // Extraire le productId depuis une clé de panier
    const getProductIdFromKey = (key) => {
        return key.split('_')[0]
    }

    // Fetch Seller Status
    const fetchSeller = async () => {
        try {
            const { data } = await axios.get('/api/seller/is-auth');
            if (data.success) {
                setIsSeller(true)
            } else {
                setIsSeller(false)
            }
        } catch (error) {
            setIsSeller(false)
        }
    }

    // Fetch User Auth Status, User Data and Cart Items
    const fetchUser = async () => {
        try {
            const { data } = await axios.get('api/user/is-auth');
            if (data.success) {
                setUser(data.user)
                setCartItems(data.user.cartItems)
            }
        } catch (error) {
            setUser(null)
        }
    }

    // Fetch All Products
    const fetchProducts = async () => {
        try {
            const { data } = await axios.get('/api/product/list');
            if (data.success) {
                setProducts(data.products)
            } else {
                setProducts(dummyProducts)
            }
        } catch (error) {
            setProducts(dummyProducts)
        }
    }

    // Fetch Wishlist
    const fetchWishlist = async () => {
        if (!user) return;
        try {
            const { data } = await axios.get('/api/wishlist/list');
            if (data.success) {
                setWishlist(data.wishlist);
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Add to Wishlist
    const addToWishlist = async (productId) => {
        if (!user) {
            setShowUserLogin(true);
            return;
        }
        try {
            const { data } = await axios.post('/api/wishlist/add', { productId });
            if (data.success) {
                toast.success(data.message);
                fetchWishlist();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    // Remove from Wishlist
    const removeFromWishlist = async (productId) => {
        try {
            const { data } = await axios.post('/api/wishlist/remove', { productId });
            if (data.success) {
                toast.success(data.message);
                fetchWishlist();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    // Check if product is in wishlist
    const isInWishlist = (productId) => {
        return wishlist.some(item => item._id === productId);
    };

    // Add Product to Cart avec color et size (1 seule quantité)
    const addToCart = (productId, color = null, size = null) => {
        const key = getCartKey(productId, color, size);
        let cartData = structuredClone(cartItems);

        if (cartData[key]) {
            cartData[key] += 1;
        } else {
            cartData[key] = 1;
        }
        setCartItems(cartData);
        toast.success("Added to Cart");
    }

    // Add Product to Cart avec quantité personnalisée (pour le modal)
    const addToCartWithQuantity = (productId, quantity, color = null, size = null) => {
        const key = getCartKey(productId, color, size);
        let cartData = structuredClone(cartItems);

        if (cartData[key]) {
            cartData[key] += quantity;
        } else {
            cartData[key] = quantity;
        }
        setCartItems(cartData);
        toast.success(`${quantity} article(s) ajouté(s) au panier`);
    }

    // Update Cart Item Quantity
    const updateCartItem = (key, quantity) => {
        let cartData = structuredClone(cartItems);
        if (quantity <= 0) {
            delete cartData[key];
        } else {
            cartData[key] = quantity;
        }
        setCartItems(cartData);
        toast.success("Cart Updated");
    }

    // Remove Product from Cart (une unité)
    const removeFromCart = (key) => {
        let cartData = structuredClone(cartItems);
        if (cartData[key]) {
            cartData[key] -= 1;
            if (cartData[key] === 0) {
                delete cartData[key];
            }
        }
        toast.success("Removed from Cart");
        setCartItems(cartData);
    }

    // Get Cart Item Count
    const getCartCount = () => {
        let totalCount = 0;
        for (const item in cartItems) {
            totalCount += cartItems[item];
        }
        return totalCount;
    }

    // Get Cart Total Amount (arrondi à l'entier supérieur si décimal)
    const getCartAmount = () => {
        let totalAmount = 0;
        for (const key in cartItems) {
            const productId = getProductIdFromKey(key);
            let itemInfo = products.find((product) => product._id === productId);
            if (itemInfo && cartItems[key] > 0) {
                totalAmount += itemInfo.offerPrice * cartItems[key];
            }
        }
        // Si décimal, arrondir à l'entier supérieur
        if (totalAmount % 1 !== 0) {
            return Math.ceil(totalAmount);
        }
        return totalAmount;
    }

    useEffect(() => {
        fetchUser();
        fetchSeller();
        fetchProducts();
    }, []);

    useEffect(() => {
        if (user) {
            fetchWishlist();
        }
    }, [user]);

    // Update Database Cart Items
    useEffect(() => {
        const updateCart = async () => {
            try {
                const { data } = await axios.post('/api/cart/update', { cartItems });
                if (!data.success) {
                    toast.error(data.message);
                }
            } catch (error) {
                toast.error(error.message);
            }
        };

        if (user) {
            updateCart();
        }
    }, [cartItems]);

    const value = {
        navigate, user, setUser, setIsSeller, isSeller,
        showUserLogin, setShowUserLogin, products, currency,
        addToCart, addToCartWithQuantity, updateCartItem, removeFromCart, cartItems,
        searchQuery, setSearchQuery, getCartAmount, getCartCount,
        axios, fetchProducts, setCartItems, getCartKey, getProductIdFromKey,
        wishlist, addToWishlist, removeFromWishlist, isInWishlist, fetchWishlist,
        fetchUser
    };

    return <AppContext.Provider value={value}>
        {children}
    </AppContext.Provider>;
};

export const useAppContext = () => {
    return useContext(AppContext);
};
