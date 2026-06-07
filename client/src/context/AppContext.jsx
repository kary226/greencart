import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dummyProducts } from "../assets/assets";
import toast from "react-hot-toast";
import axios from "axios";

axios.defaults.withCredentials = false;
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

const getToken = () => localStorage.getItem('token');

const setAuthToken = (token) => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete axios.defaults.headers.common['Authorization'];
    }
};

const initialToken = getToken();
if (initialToken) {
    setAuthToken(initialToken);
}

const RECENTLY_VIEWED_KEY = 'greencart_recently_viewed';
const CART_KEY = 'greencart_cart';
const MAX_RECENT_ITEMS = 5;

// Charger le panier depuis localStorage
const loadCartFromLocalStorage = () => {
    try {
        const savedCart = localStorage.getItem(CART_KEY);
        if (savedCart) {
            return JSON.parse(savedCart);
        }
    } catch (e) {
        console.error("Erreur chargement panier:", e);
    }
    return {};
};

export const AppContext = createContext();

export const AppContextProvider = ({ children }) => {

    const currency = import.meta.env.VITE_CURRENCY;
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [isSeller, setIsSeller] = useState(false);
    const [showUserLogin, setShowUserLogin] = useState(false);
    const [products, setProducts] = useState([]);
    const [cartItems, setCartItemsState] = useState(loadCartFromLocalStorage);
    const [searchQuery, setSearchQuery] = useState("");
    const [wishlist, setWishlist] = useState([]);
    const [recentlyViewed, setRecentlyViewed] = useState([]);
    const [orders, setOrders] = useState([]);

    // Sauvegarde automatique du panier dans localStorage
    const setCartItems = (newCart) => {
        setCartItemsState(newCart);
        localStorage.setItem(CART_KEY, JSON.stringify(newCart));
    };

    const getCartKey = (productId, color = null, size = null) => {
        return `${productId}${color ? `_${color}` : ''}${size ? `_${size}` : ''}`;
    };

    const getProductIdFromKey = (key) => {
        return key.split('_')[0];
    };

    // ==================== PRODUITS RÉCEMMENT VUS ====================

    const addToRecentlyViewed = (product) => {
        if (!product || !product._id) return;
        
        setRecentlyViewed(prev => {
            const filtered = prev.filter(item => item._id !== product._id);
            const updated = [product, ...filtered];
            const sliced = updated.slice(0, MAX_RECENT_ITEMS);
            localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(sliced));
            return sliced;
        });
    };

    const loadRecentlyViewed = () => {
        const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setRecentlyViewed(parsed);
            } catch (error) {
                console.error("Erreur chargement récemment vus:", error);
            }
        }
    };

    // ==================== COMMANDES ====================
    
    const fetchOrders = async () => {
        if (!user) return;
        try {
            const { data } = await axios.get('/api/order/user-orders');
            if (data.success) {
                setOrders(data.orders);
            }
        } catch (error) {
            console.error("Erreur chargement commandes:", error);
            setOrders([]);
        }
    };

    // ==================== AUTHENTIFICATION ====================

    const fetchSeller = async () => {
        try {
            const { data } = await axios.get('/api/seller/is-auth');
            if (data.success) setIsSeller(true);
            else setIsSeller(false);
        } catch (error) {
            setIsSeller(false);
        }
    };

    const fetchUser = async () => {
        try {
            const { data } = await axios.get('/api/user/is-auth');
            if (data.success) {
                setUser(data.user);
                // Ne pas écraser le panier local par le panier serveur
                if (data.user.cartItems && Object.keys(data.user.cartItems).length > 0) {
                    setCartItems(data.user.cartItems);
                }
                await fetchOrders();
            }
        } catch (error) {
            setUser(null);
        }
    };

    const fetchProducts = async () => {
        try {
            const { data } = await axios.get('/api/product/list');
            if (data.success) setProducts(data.products);
            else setProducts(dummyProducts);
        } catch (error) {
            setProducts(dummyProducts);
        }
    };

    const fetchWishlist = async () => {
        if (!user) return;
        try {
            const { data } = await axios.get('/api/wishlist/list');
            if (data.success) setWishlist(data.wishlist);
        } catch (error) {
            console.error(error);
        }
    };

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

    const isInWishlist = (productId) => {
        return wishlist.some(item => item._id === productId);
    };

    // addToCart SANS TOAST (pour éviter le double message)
    const addToCart = (productId, color = null, size = null) => {
        const key = getCartKey(productId, color, size);
        let cartData = structuredClone(cartItems);
        if (cartData[key]) {
            cartData[key] += 1;
        } else {
            cartData[key] = 1;
        }
        setCartItems(cartData);
    };

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
    };

    const updateCartItem = (key, quantity) => {
        let cartData = structuredClone(cartItems);
        if (quantity <= 0) {
            delete cartData[key];
        } else {
            cartData[key] = quantity;
        }
        setCartItems(cartData);
        toast.success("Panier mis à jour");
    };

    const removeFromCart = (key) => {
        let cartData = structuredClone(cartItems);
        if (cartData[key]) {
            cartData[key] -= 1;
            if (cartData[key] === 0) {
                delete cartData[key];
            }
        }
        setCartItems(cartData);
        toast.success("Retiré du panier");
    };

    const getCartCount = () => {
        let totalCount = 0;
        for (const item in cartItems) {
            if (cartItems[item] > 0) {
                totalCount += cartItems[item];
            }
        }
        return totalCount;
    };

    const getCartAmount = () => {
        let totalAmount = 0;
        for (const key in cartItems) {
            const productId = getProductIdFromKey(key);
            let itemInfo = products.find((product) => product._id === productId);
            if (itemInfo && cartItems[key] > 0) {
                totalAmount += itemInfo.offerPrice * cartItems[key];
            }
        }
        if (totalAmount % 1 !== 0) return Math.ceil(totalAmount);
        return totalAmount;
    };

    const loginUser = async (email, password) => {
        try {
            const { data } = await axios.post('/api/user/login', { email, password });
            if (data.success) {
                localStorage.setItem('token', data.token);
                setAuthToken(data.token);
                setUser(data.user);
                // Fusionner le panier local avec celui du serveur
                const localCart = loadCartFromLocalStorage();
                const serverCart = data.user.cartItems || {};
                const mergedCart = { ...serverCart, ...localCart };
                setCartItems(mergedCart);
                await fetchOrders();
                toast.success("Connexion réussie");
                navigate('/');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const registerUser = async (firstName, lastName, email, password) => {
        try {
            const { data } = await axios.post('/api/user/register', {
                firstName,
                lastName,
                email,
                password
            });
            if (data.success) {
                localStorage.setItem('token', data.token);
                setAuthToken(data.token);
                setUser(data.user);
                setCartItems({});
                toast.success("Inscription réussie");
                navigate('/');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const logoutUser = async () => {
        try {
            await axios.post('/api/user/logout');
            localStorage.removeItem('token');
            setAuthToken(null);
            setUser(null);
            setCartItems({});
            setOrders([]);
            toast.success("Déconnexion réussie");
            navigate('/');
        } catch (error) {
            toast.error(error.message);
        }
    };

    useEffect(() => {
        if (getToken()) {
            fetchUser();
        } else {
            // Utiliser le panier localStorage uniquement
            setCartItems(loadCartFromLocalStorage());
        }
        fetchSeller();
        fetchProducts();
        loadRecentlyViewed();
    }, []);

    useEffect(() => {
        if (user) {
            fetchWishlist();
            fetchOrders();
        }
    }, [user]);

    useEffect(() => {
        const updateCart = async () => {
            if (!user) return;
            try {
                await axios.post('/api/cart/update', { cartItems });
            } catch (error) {
                console.error("Erreur mise à jour panier:", error);
            }
        };
        updateCart();
    }, [cartItems, user]);

    const value = {
        navigate, user, setUser, setIsSeller, isSeller,
        showUserLogin, setShowUserLogin, products, currency,
        addToCart, addToCartWithQuantity, updateCartItem, removeFromCart, cartItems,
        searchQuery, setSearchQuery, getCartAmount, getCartCount,
        axios, fetchProducts, setCartItems, getCartKey, getProductIdFromKey,
        wishlist, addToWishlist, removeFromWishlist, isInWishlist, fetchWishlist,
        fetchUser, loginUser, registerUser, logoutUser,
        recentlyViewed, addToRecentlyViewed,
        orders
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    return useContext(AppContext);
};