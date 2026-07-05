import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";

axios.defaults.withCredentials = false;
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

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
    const [installPromptEvent, setInstallPromptEvent] = useState(null);
    const [canInstallPWA, setCanInstallPWA] = useState(false);
    const [isPWAInstalled, setIsPWAInstalled] = useState(
        window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    );

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

    const fetchOrders = async () => {
        if (!user) return;
        try {
            const { data } = await axios.get('/api/order/user');
            if (data.success) {
                setOrders(data.orders);
            }
        } catch (error) {
            console.error("Erreur chargement commandes:", error);
            setOrders([]);
        }
    };

    const fetchSeller = async () => {
        const token = getToken();
        if (!token) {
            setIsSeller(false);
            return;
        }
        
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
            } else {
                setIsSeller(false);
                localStorage.removeItem('isSeller');
                localStorage.removeItem('sellerData');
            }
        } catch (error) {
            console.error("Erreur fetchSeller:", error);
            setIsSeller(false);
            localStorage.removeItem('isSeller');
            localStorage.removeItem('sellerData');
        }
    };

    const fetchUser = async () => {
        const token = getToken();
        if (!token) return;
        
        if (window.location.pathname.includes('/seller')) {
            return;
        }
        
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
                await fetchOrders();
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
        }
    };

    // ✅ fetchProducts CORRIGÉ - Plus de dummyProducts
    const fetchProducts = async () => {
        try {
            const { data } = await axios.get('/api/product/list');
            if (data.success) {
                setProducts(data.products);
            } else {
                setProducts([]);
            }
        } catch (error) {
            console.error("Erreur chargement produits:", error);
            setProducts([]);
        }
    };

    const fetchWishlist = async () => {
        if (!user) return;
        if (window.location.pathname.includes('/seller')) return;
        
        try {
            const { data } = await axios.get('/api/wishlist/list');
            if (data.success) setWishlist(data.wishlist);
        } catch (error) {
            if (error.response?.data?.redirectToLogin) {
                setShowUserLogin(true);
            } else {
                console.error(error);
            }
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
            if (error.response?.data?.redirectToLogin) {
                setShowUserLogin(true);
                toast.error("Veuillez vous connecter");
            } else {
                toast.error(error.message);
            }
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
            if (error.response?.data?.redirectToLogin) {
                setShowUserLogin(true);
                toast.error("Veuillez vous connecter");
            } else {
                toast.error(error.message);
            }
        }
    };

    const isInWishlist = (productId) => {
        return wishlist.some(item => item._id === productId);
    };

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
        toast.success("Retiré du panier");
        setCartItems(cartData);
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
                setToken(data.token);
                setAuthToken(data.token);
                
                const localCart = loadCartFromLocalStorage();
                setUser(data.user);
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
            toast.error(error.response?.data?.message || error.message);
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
                setToken(data.token);
                setAuthToken(data.token);
                
                const localCart = loadCartFromLocalStorage();
                setUser(data.user);
                setCartItems(localCart);
                
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
            
            setCartItems(loadCartFromLocalStorage());
            setOrders([]);
            
            toast.success("Déconnexion réussie");
            navigate('/');
        } catch (error) {
            toast.error(error.message);
        }
    };

    const loginSeller = async (email, password) => {
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
                toast.success("Connexion vendeur réussie");
                navigate('/seller/dashboard');
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const logoutSeller = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('isSeller');
        localStorage.removeItem('sellerData');
        setToken(null);
        setAuthToken(null);
        setIsSeller(false);
        setUser(null);
        toast.success("Déconnexion vendeur réussie");
        navigate('/seller');
    };

    // 📲 Installation PWA (Android / Chrome / Edge)
    // Le navigateur envoie cet événement s'il juge le site installable.
    // On l'intercepte et on le stocke pour pouvoir l'appeler plus tard,
    // au clic sur notre propre bouton "Installer l'application".
    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setInstallPromptEvent(e);
            setCanInstallPWA(true);
        };
        const handleAppInstalled = () => {
            setInstallPromptEvent(null);
            setCanInstallPWA(false);
            setIsPWAInstalled(true);
            toast.success("Application installée avec succès");
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    // Déclenche la popup native d'installation.
    // Retourne 'accepted', 'dismissed', ou null si aucun prompt natif n'est disponible
    // (cas iOS/Safari notamment, où il faut alors rediriger vers le guide manuel).
    const installPWA = async () => {
        if (!installPromptEvent) return null;
        installPromptEvent.prompt();
        const { outcome } = await installPromptEvent.userChoice;
        setInstallPromptEvent(null);
        setCanInstallPWA(false);
        return outcome;
    };

    useEffect(() => {
        const token = getToken();
        const isOnSellerPage = window.location.pathname.includes('/seller');
        
        if (token) {
            if (isOnSellerPage) {
                fetchSeller();
            } else {
                fetchUser();
                fetchSeller();
            }
        } else {
            setCartItems(loadCartFromLocalStorage());
            if (!isOnSellerPage) {
                setIsSeller(false);
            }
        }
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
            try {
                const { data } = await axios.post('/api/cart/update', { cartItems });
                if (!data.success) {
                    toast.error(data.message);
                }
            } catch (error) {
                console.error(error);
            }
        };
        if (user) {
            updateCart();
        }
    }, [cartItems]);

    const value = {
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
        orders,
        canInstallPWA, isPWAInstalled, installPWA
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    return useContext(AppContext);
};