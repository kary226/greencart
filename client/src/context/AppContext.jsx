import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { dummyProducts } from "../assets/assets";
import toast from "react-hot-toast";
import axios from "axios";

// ⚡ Configuration axios avec timeout et retry
axios.defaults.withCredentials = false;
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;
axios.defaults.timeout = 10000; // 10 secondes

// ⚡ Cache des requêtes
const queryCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ⚡ Fonction de cache avec expiration
const getCachedData = (key) => {
    const cached = queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    queryCache.delete(key);
    return null;
};

const setCachedData = (key, data) => {
    queryCache.set(key, { data, timestamp: Date.now() });
};

const getToken = () => localStorage.getItem('token');
const getIsSeller = () => localStorage.getItem('isSeller') === 'true';
const getSellerData = () => {
    const sellerData = localStorage.getItem('sellerData');
    return sellerData ? JSON.parse(sellerData) : null;
};

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

const loadCartFromLocalStorage = () => {
    const savedCart = localStorage.getItem(CART_KEY);
    if (savedCart) {
        try {
            return JSON.parse(savedCart);
        } catch (e) {
            return {};
        }
    }
    return {};
};

export const AppContext = createContext();

export const AppContextProvider = ({ children }) => {

    const currency = import.meta.env.VITE_CURRENCY;
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [token, setToken] = useState(getToken());
    const [isSeller, setIsSeller] = useState(getIsSeller);
    const [showUserLogin, setShowUserLogin] = useState(false);
    const [products, setProducts] = useState([]);
    const [cartItems, setCartItemsState] = useState(loadCartFromLocalStorage);
    const [searchQuery, setSearchQuery] = useState("");
    const [wishlist, setWishlist] = useState([]);
    const [recentlyViewed, setRecentlyViewed] = useState([]);
    const [orders, setOrders] = useState([]);
    
    // ⚡ Ref pour éviter les appels multiples
    const isInitialized = useRef(false);
    const fetchPromises = useRef({});

    const setCartItems = useCallback((newCart) => {
        setCartItemsState(newCart);
        localStorage.setItem(CART_KEY, JSON.stringify(newCart));
    }, []);

    const getCartKey = useCallback((productId, color = null, size = null) => {
        return `${productId}${color ? `_${color}` : ''}${size ? `_${size}` : ''}`;
    }, []);

    const getProductIdFromKey = useCallback((key) => {
        return key.split('_')[0];
    }, []);

    const addToRecentlyViewed = useCallback((product) => {
        if (!product || !product._id) return;
        
        setRecentlyViewed(prev => {
            const filtered = prev.filter(item => item._id !== product._id);
            const updated = [product, ...filtered];
            const sliced = updated.slice(0, MAX_RECENT_ITEMS);
            localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(sliced));
            return sliced;
        });
    }, []);

    // ⚡ Optimisation : fetchOrders avec cache
    const fetchOrders = useCallback(async (force = false) => {
        if (!user) return;
        
        const cacheKey = 'orders';
        if (!force) {
            const cached = getCachedData(cacheKey);
            if (cached) {
                setOrders(cached);
                return;
            }
        }
        
        // ⚡ Éviter les appels simultanés
        if (fetchPromises.current[cacheKey]) {
            return fetchPromises.current[cacheKey];
        }
        
        fetchPromises.current[cacheKey] = (async () => {
            try {
                const { data } = await axios.get('/api/order/user');
                if (data.success) {
                    setOrders(data.orders);
                    setCachedData(cacheKey, data.orders);
                    return data.orders;
                }
            } catch (error) {
                console.error("Erreur chargement commandes:", error);
                setOrders([]);
            } finally {
                delete fetchPromises.current[cacheKey];
            }
        })();
        
        return fetchPromises.current[cacheKey];
    }, [user]);

    // ⚡ Optimisation : fetchSeller avec cache
    const fetchSeller = useCallback(async (force = false) => {
        const token = getToken();
        if (!token) {
            setIsSeller(false);
            return;
        }
        
        const cacheKey = 'seller';
        if (!force) {
            const cached = getCachedData(cacheKey);
            if (cached) {
                setIsSeller(cached.isSeller);
                return;
            }
        }
        
        if (fetchPromises.current[cacheKey]) {
            return fetchPromises.current[cacheKey];
        }
        
        fetchPromises.current[cacheKey] = (async () => {
            try {
                const { data } = await axios.get('/api/seller/is-auth', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (data.success) {
                    setIsSeller(true);
                    localStorage.setItem('isSeller', 'true');
                    if (data.seller) {
                        localStorage.setItem('sellerData', JSON.stringify(data.seller));
                    }
                    setCachedData(cacheKey, { isSeller: true });
                } else {
                    setIsSeller(false);
                    localStorage.removeItem('isSeller');
                    localStorage.removeItem('sellerData');
                    setCachedData(cacheKey, { isSeller: false });
                }
            } catch (error) {
                console.error("Erreur fetchSeller:", error);
                setIsSeller(false);
                localStorage.removeItem('isSeller');
                localStorage.removeItem('sellerData');
            } finally {
                delete fetchPromises.current[cacheKey];
            }
        })();
        
        return fetchPromises.current[cacheKey];
    }, []);

    // ⚡ Optimisation : fetchUser avec cache
    const fetchUser = useCallback(async (force = false) => {
        const token = getToken();
        if (!token) return;
        
        if (window.location.pathname.includes('/seller')) {
            return;
        }
        
        const cacheKey = 'user';
        if (!force) {
            const cached = getCachedData(cacheKey);
            if (cached) {
                setUser(cached.user);
                const mergedCart = { ...cached.cartItems, ...loadCartFromLocalStorage() };
                setCartItems(mergedCart);
                return;
            }
        }
        
        if (fetchPromises.current[cacheKey]) {
            return fetchPromises.current[cacheKey];
        }
        
        fetchPromises.current[cacheKey] = (async () => {
            try {
                const { data } = await axios.get('/api/user/is-auth', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (data.success) {
                    setUser(data.user);
                    const localCart = loadCartFromLocalStorage();
                    const serverCart = data.user.cartItems || {};
                    const mergedCart = { ...serverCart, ...localCart };
                    setCartItems(mergedCart);
                    setCachedData(cacheKey, { user: data.user, cartItems: serverCart });
                    await fetchOrders(true);
                } else {
                    setUser(null);
                }
            } catch (error) {
                if (!window.location.pathname.includes('/seller')) {
                    if (error.response?.data?.redirectToLogin) {
                        setShowUserLogin(true);
                    }
                }
                setUser(null);
            } finally {
                delete fetchPromises.current[cacheKey];
            }
        })();
        
        return fetchPromises.current[cacheKey];
    }, [fetchOrders, setCartItems]);

    // ⚡ Optimisation : fetchProducts avec cache
    const fetchProducts = useCallback(async (force = false) => {
        const cacheKey = 'products';
        if (!force) {
            const cached = getCachedData(cacheKey);
            if (cached) {
                setProducts(cached);
                return;
            }
        }
        
        if (fetchPromises.current[cacheKey]) {
            return fetchPromises.current[cacheKey];
        }
        
        fetchPromises.current[cacheKey] = (async () => {
            try {
                const { data } = await axios.get('/api/product/list');
                if (data.success) {
                    setProducts(data.products);
                    setCachedData(cacheKey, data.products);
                } else {
                    setProducts(dummyProducts);
                }
            } catch (error) {
                setProducts(dummyProducts);
            } finally {
                delete fetchPromises.current[cacheKey];
            }
        })();
        
        return fetchPromises.current[cacheKey];
    }, []);

    // ⚡ Optimisation : fetchWishlist avec cache
    const fetchWishlist = useCallback(async (force = false) => {
        if (!user) return;
        if (window.location.pathname.includes('/seller')) return;
        
        const cacheKey = 'wishlist';
        if (!force) {
            const cached = getCachedData(cacheKey);
            if (cached) {
                setWishlist(cached);
                return;
            }
        }
        
        if (fetchPromises.current[cacheKey]) {
            return fetchPromises.current[cacheKey];
        }
        
        fetchPromises.current[cacheKey] = (async () => {
            try {
                const { data } = await axios.get('/api/wishlist/list');
                if (data.success) {
                    setWishlist(data.wishlist);
                    setCachedData(cacheKey, data.wishlist);
                }
            } catch (error) {
                if (error.response?.data?.redirectToLogin) {
                    setShowUserLogin(true);
                } else {
                    console.error(error);
                }
            } finally {
                delete fetchPromises.current[cacheKey];
            }
        })();
        
        return fetchPromises.current[cacheKey];
    }, [user]);

    // ⚡ Optimisation : addToWishlist avec invalidation du cache
    const addToWishlist = useCallback(async (productId) => {
        if (!user) {
            setShowUserLogin(true);
            return;
        }
        try {
            const { data } = await axios.post('/api/wishlist/add', { productId });
            if (data.success) {
                toast.success(data.message);
                queryCache.delete('wishlist');
                fetchWishlist(true);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            if (error.response?.data?.redirectToLogin) {
                setShowUserLogin(true);
                toast.error("Veuillez vous connecter");
            } else {
                toast.error(error.message);
            }
        }
    }, [user, fetchWishlist]);

    const removeFromWishlist = useCallback(async (productId) => {
        try {
            const { data } = await axios.post('/api/wishlist/remove', { productId });
            if (data.success) {
                toast.success(data.message);
                queryCache.delete('wishlist');
                fetchWishlist(true);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            if (error.response?.data?.redirectToLogin) {
                setShowUserLogin(true);
                toast.error("Veuillez vous connecter");
            } else {
                toast.error(error.message);
            }
        }
    }, [fetchWishlist]);

    // ⚡ Optimisation : isInWishlist avec useMemo
    const isInWishlist = useCallback((productId) => {
        return wishlist.some(item => item._id === productId);
    }, [wishlist]);

    const addToCart = useCallback((productId, color = null, size = null) => {
        const key = getCartKey(productId, color, size);
        let cartData = structuredClone(cartItems);
        if (cartData[key]) {
            cartData[key] += 1;
        } else {
            cartData[key] = 1;
        }
        setCartItems(cartData);
    }, [cartItems, getCartKey, setCartItems]);

    const addToCartWithQuantity = useCallback((productId, quantity, color = null, size = null) => {
        const key = getCartKey(productId, color, size);
        let cartData = structuredClone(cartItems);
        if (cartData[key]) {
            cartData[key] += quantity;
        } else {
            cartData[key] = quantity;
        }
        setCartItems(cartData);
        toast.success(`${quantity} article(s) ajouté(s) au panier`);
    }, [cartItems, getCartKey, setCartItems]);

    const updateCartItem = useCallback((key, quantity) => {
        let cartData = structuredClone(cartItems);
        if (quantity <= 0) {
            delete cartData[key];
        } else {
            cartData[key] = quantity;
        }
        setCartItems(cartData);
        toast.success("Panier mis à jour");
    }, [cartItems, setCartItems]);

    const removeFromCart = useCallback((key) => {
        let cartData = structuredClone(cartItems);
        if (cartData[key]) {
            cartData[key] -= 1;
            if (cartData[key] === 0) {
                delete cartData[key];
            }
        }
        toast.success("Retiré du panier");
        setCartItems(cartData);
    }, [cartItems, setCartItems]);

    // ⚡ Optimisation : getCartCount avec useMemo
    const getCartCount = useCallback(() => {
        let totalCount = 0;
        for (const item in cartItems) {
            if (cartItems[item] > 0) {
                totalCount += cartItems[item];
            }
        }
        return totalCount;
    }, [cartItems]);

    // ⚡ Optimisation : getCartAmount avec useMemo
    const getCartAmount = useCallback(() => {
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
    }, [cartItems, products, getProductIdFromKey]);

    // ✅ LOGIN USER OPTIMISÉ
    const loginUser = useCallback(async (email, password) => {
        try {
            const { data } = await axios.post('/api/user/login', { email, password });
            if (data.success) {
                localStorage.setItem('token', data.token);
                setToken(data.token);
                setAuthToken(data.token);
                
                const localCart = loadCartFromLocalStorage();
                setUser(data.user);
                
                const serverCart = data.user.cartItems || {};
                const mergedCart = { ...serverCart, ...localCart };
                setCartItems(mergedCart);
                
                // ⚡ Invalider le cache
                queryCache.clear();
                
                await fetchOrders(true);
                toast.success("Connexion réussie");
                navigate('/');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    }, [fetchOrders, navigate, setCartItems]);

    // ✅ REGISTER USER OPTIMISÉ
    const registerUser = useCallback(async (firstName, lastName, email, password) => {
        try {
            const { data } = await axios.post('/api/user/register', {
                firstName,
                lastName,
                email,
                password
            });
            if (data.success) {
                localStorage.setItem('token', data.token);
                setToken(data.token);
                setAuthToken(data.token);
                
                const localCart = loadCartFromLocalStorage();
                setUser(data.user);
                setCartItems(localCart);
                
                queryCache.clear();
                
                toast.success("Inscription réussie");
                navigate('/');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    }, [navigate, setCartItems]);

    // ✅ LOGOUT USER OPTIMISÉ
    const logoutUser = useCallback(async () => {
        try {
            if (cartItems && Object.keys(cartItems).length > 0) {
                localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
            }
            
            await axios.post('/api/user/logout');
            localStorage.removeItem('token');
            localStorage.removeItem('isSeller');
            localStorage.removeItem('sellerData');
            setToken(null);
            setAuthToken(null);
            setUser(null);
            setIsSeller(false);
            
            queryCache.clear();
            
            setCartItems(loadCartFromLocalStorage());
            setOrders([]);
            
            toast.success("Déconnexion réussie");
            navigate('/');
        } catch (error) {
            toast.error(error.message);
        }
    }, [cartItems, navigate, setCartItems]);

    const loginSeller = useCallback(async (email, password) => {
        try {
            const { data } = await axios.post('/api/seller/login', { email, password });
            if (data.success) {
                localStorage.setItem('token', data.token);
                setToken(data.token);
                localStorage.setItem('isSeller', 'true');
                if (data.seller) {
                    localStorage.setItem('sellerData', JSON.stringify(data.seller));
                }
                setAuthToken(data.token);
                setIsSeller(true);
                setUser(data.seller);
                
                queryCache.clear();
                
                toast.success("Connexion vendeur réussie");
                navigate('/seller/dashboard');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    }, [navigate]);

    const logoutSeller = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('isSeller');
        localStorage.removeItem('sellerData');
        setToken(null);
        setAuthToken(null);
        setIsSeller(false);
        setUser(null);
        
        queryCache.clear();
        
        toast.success("Déconnexion vendeur réussie");
        navigate('/seller');
    }, [navigate]);

    // ⚡ Optimisation : initialisation unique avec AbortController
    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;
        
        const abortController = new AbortController();
        
        const init = async () => {
            const token = getToken();
            const isOnSellerPage = window.location.pathname.includes('/seller');
            
            if (token) {
                if (isOnSellerPage) {
                    await fetchSeller(true);
                } else {
                    await Promise.all([
                        fetchUser(true),
                        fetchSeller(true)
                    ]);
                }
            } else {
                setCartItems(loadCartFromLocalStorage());
                if (!isOnSellerPage) {
                    setIsSeller(false);
                }
            }
            
            await fetchProducts(true);
            loadRecentlyViewed();
        };
        
        init();
        
        return () => {
            abortController.abort();
        };
    }, [fetchUser, fetchSeller, fetchProducts, setCartItems]);

    // ⚡ Optimisation : fetch wishlist et orders seulement quand user change
    useEffect(() => {
        if (user) {
            fetchWishlist(true);
            fetchOrders(true);
        }
    }, [user, fetchWishlist, fetchOrders]);

    // ⚡ Optimisation : update cart avec debounce
    useEffect(() => {
        if (!user) return;
        
        const timeoutId = setTimeout(async () => {
            try {
                const { data } = await axios.post('/api/cart/update', { cartItems });
                if (!data.success) {
                    toast.error(data.message);
                }
            } catch (error) {
                console.error(error);
            }
        }, 500); // ⚡ Debounce de 500ms
        
        return () => clearTimeout(timeoutId);
    }, [cartItems, user]);

    // ⚡ Optimisation : nettoyage du cache périodique
    useEffect(() => {
        const cleanup = setInterval(() => {
            const now = Date.now();
            for (const [key, value] of queryCache) {
                if (now - value.timestamp > CACHE_DURATION) {
                    queryCache.delete(key);
                }
            }
        }, 60000); // Nettoyer toutes les minutes
        
        return () => clearInterval(cleanup);
    }, []);

    // ⚡ Optimisation : value avec useMemo
    const value = useMemo(() => ({
        navigate, user, setUser, token, setToken,
        setIsSeller, isSeller,
        showUserLogin, setShowUserLogin, products, currency,
        addToCart, addToCartWithQuantity, updateCartItem, removeFromCart, cartItems,
        searchQuery, setSearchQuery, getCartAmount, getCartCount,
        axios, fetchProducts, setCartItems, getCartKey, getProductIdFromKey,
        wishlist, addToWishlist, removeFromWishlist, isInWishlist, fetchWishlist,
        fetchUser, loginUser, registerUser, logoutUser,
        loginSeller, logoutSeller,
        recentlyViewed, addToRecentlyViewed,
        orders
    }), [
        navigate, user, setUser, token, setToken,
        setIsSeller, isSeller,
        showUserLogin, setShowUserLogin, products, currency,
        addToCart, addToCartWithQuantity, updateCartItem, removeFromCart, cartItems,
        searchQuery, setSearchQuery, getCartAmount, getCartCount,
        fetchProducts, setCartItems, getCartKey, getProductIdFromKey,
        wishlist, addToWishlist, removeFromWishlist, isInWishlist, fetchWishlist,
        fetchUser, loginUser, registerUser, logoutUser,
        loginSeller, logoutSeller,
        recentlyViewed, addToRecentlyViewed,
        orders
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    return useContext(AppContext);
};