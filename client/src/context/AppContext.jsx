import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";

// ─── Configuration Axios ──────────────────────────────────────────────────

// [MIGRATION cookie httpOnly] withCredentials: true = le navigateur envoie
// automatiquement le cookie httpOnly (posé par le serveur) sur chaque
// requête vers l'API, sans que le JS ait jamais besoin de le lire ou de
// le manipuler lui-même.
axios.defaults.withCredentials = true;

// [PHASE 3 - CORS] En production, on utilise une URL relative pour éviter
// les problèmes CORS (Vercel Rewrites proxyfie /api/* vers api.ramci.ci).
// En développement, on utilise le serveur local.
// Si VITE_API_URL est défini, on l'utilise (pour les environnements spécifiques).
const API_BASE_URL = import.meta.env.VITE_API_URL || 
                     (import.meta.env.PROD ? '' : 'http://localhost:4000');
axios.defaults.baseURL = API_BASE_URL;

// ─── Constantes ──────────────────────────────────────────────────────────

const getIsSeller = () => localStorage.getItem('isSeller') === 'true';
const getSellerData = () => {
    const sellerData = localStorage.getItem('sellerData');
    return sellerData ? JSON.parse(sellerData) : null;
};

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

// ─── Contexte ────────────────────────────────────────────────────────────

export const AppContext = createContext();

export const AppContextProvider = ({ children }) => {

    const currency = import.meta.env.VITE_CURRENCY;
    const navigate = useNavigate();

    // ─── État utilisateur (client) ──────────────────────────────────────

    const [user, setUser] = useState(null);
    const [isSeller, setIsSeller] = useState(getIsSeller);
    const [showUserLogin, setShowUserLogin] = useState(false);

    // ─── [PHASE 3] État staff (admin) ──────────────────────────────────

    const [staffUser, setStaffUser] = useState(null);
    const [staffPermissions, setStaffPermissions] = useState([]);

    // ─── État catalogue ──────────────────────────────────────────────────

    const [products, setProducts] = useState([]);
    const [cartItems, setCartItemsState] = useState(loadCartFromLocalStorage);
    const [searchQuery, setSearchQuery] = useState("");
    const [wishlist, setWishlist] = useState([]);
    const [recentlyViewed, setRecentlyViewed] = useState([]);

    // ─── État commandes / colis ──────────────────────────────────────────

    const [orders, setOrders] = useState([]);
    const [colisShein, setColisShein] = useState([]);
    const [colisSheinActif, setColisSheinActif] = useState(false);

    // ─── État PWA ────────────────────────────────────────────────────────

    const [installPromptEvent, setInstallPromptEvent] = useState(null);
    const [canInstallPWA, setCanInstallPWA] = useState(false);
    const [isPWAInstalled, setIsPWAInstalled] = useState(
        window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    );

    // ─── Helpers panier ──────────────────────────────────────────────────

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

    // ─── Recently viewed ──────────────────────────────────────────────────

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

    // ─── Fetch : Commandes ───────────────────────────────────────────────

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

    // ─── Fetch : Colis Shein ─────────────────────────────────────────────

    const fetchColisShein = async () => {
        if (!user) return;
        if (window.location.pathname.includes('/seller')) return;
        try {
            const { data } = await axios.get('/api/shein-cart/user');
            if (data.success) setColisShein(data.colis);
        } catch (error) {
            console.error("Erreur chargement colis SHEIN:", error);
            setColisShein([]);
        }
    };

    // ─── Fetch : Seller ──────────────────────────────────────────────────

    const fetchSeller = async () => {
        try {
            const { data } = await axios.get('/api/seller/is-auth');
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

    // ─── Fetch : Staff User (PHASE 3) ────────────────────────────────────

    const fetchStaffUser = async () => {
        try {
            const { data } = await axios.get('/api/staff/is-auth');
            if (data.success && data.staffUser) {
                setStaffUser(data.staffUser);
                setStaffPermissions(data.staffUser.permissions || []);
                return data.staffUser;
            }
        } catch (error) {
            // Pas de session staff – on laisse staffUser à null
        }
        return null;
    };

    // ─── Fetch : User (client) ──────────────────────────────────────────

    const fetchUser = async (silent = false) => {
        if (window.location.pathname.includes('/seller')) {
            return;
        }

        try {
            const { data } = await axios.get('/api/user/is-auth');
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
            if (!silent && !window.location.pathname.includes('/seller')) {
                if (error.response?.data?.redirectToLogin) {
                    setShowUserLogin(true);
                }
            }
            setUser(null);
        }
    };

    // ─── Fetch : Produits ─────────────────────────────────────────────────

    const fetchProducts = async () => {
        try {
            const { data } = await axios.get('/api/product/catalogue');
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

    // ─── Wishlist ─────────────────────────────────────────────────────────

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

    // ─── [PHASE 3] Permissions ───────────────────────────────────────────

    const hasPermission = (permission) => {
        if (staffUser?.role === 'super_admin') return true;
        return staffPermissions.includes(permission);
    };

    const hasAnyPermission = (permissions) => {
        if (staffUser?.role === 'super_admin') return true;
        return permissions.some(p => staffPermissions.includes(p));
    };

    // ─── Authentification ────────────────────────────────────────────────

    const loginUser = async (email, password) => {
        try {
            const { data } = await axios.post('/api/user/login', { email, password });
            if (data.success) {
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
            localStorage.removeItem('isSeller');
            localStorage.removeItem('sellerData');
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
                localStorage.setItem('isSeller', 'true');
                if (data.seller) {
                    localStorage.setItem('sellerData', JSON.stringify(data.seller));
                }
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
        localStorage.removeItem('isSeller');
        localStorage.removeItem('sellerData');
        setIsSeller(false);
        setUser(null);
        toast.success("Déconnexion vendeur réussie");
        navigate('/seller');
    };

    // ─── PWA ──────────────────────────────────────────────────────────────

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

    const installPWA = async () => {
        if (!installPromptEvent) return null;
        installPromptEvent.prompt();
        const { outcome } = await installPromptEvent.userChoice;
        setInstallPromptEvent(null);
        setCanInstallPWA(false);
        return outcome;
    };

    // ─── Notifications Push ──────────────────────────────────────────────

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribeToPushNotifications = async (silent = false) => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            if (!silent) toast.error("Les notifications ne sont pas supportées sur cet appareil/navigateur");
            return { success: false, reason: 'unsupported' };
        }
        if (!user) {
            if (!silent) toast.error("Connectez-vous pour activer les notifications");
            return { success: false, reason: 'not-logged-in' };
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                if (!silent) toast.error("Notifications refusées.");
                return { success: false, reason: 'denied' };
            }

            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
                });
            }

            const subJson = subscription.toJSON();
            await axios.post('/api/push/subscribe', {
                userId: user._id,
                subscription: {
                    endpoint: subJson.endpoint,
                    keys: subJson.keys
                }
            });

            if (!silent) toast.success("Notifications activées 🔔");
            return { success: true };
        } catch (error) {
            console.error("Erreur abonnement push:", error);
            if (!silent) toast.error("Impossible d'activer les notifications");
            return { success: false, reason: 'error' };
        }
    };

    // ─── Réabonnement push silencieux ────────────────────────────────────

    useEffect(() => {
        if (user && 'Notification' in window && Notification.permission === 'granted') {
            subscribeToPushNotifications(true);
        }
    }, [user]);

    // ─── Effets de chargement initiaux ──────────────────────────────────

    useEffect(() => {
        const isOnSellerPage = window.location.pathname.includes('/seller');
        const isOnAdminPage = window.location.pathname.startsWith('/admin') || 
                              window.location.pathname.startsWith('/staff');

        if (isOnAdminPage) {
            fetchStaffUser();
        }

        if (isOnSellerPage) {
            fetchSeller();
        } else {
            fetchUser(true);
            fetchSeller();
        }
        fetchProducts();
        loadRecentlyViewed();

        (async () => {
            try {
                const { data } = await axios.get('/api/setting/colisSheinActif');
                setColisSheinActif(data.success && data.data === true);
            } catch {
                setColisSheinActif(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (user) {
            fetchWishlist();
            fetchOrders();
            fetchColisShein();
        }
    }, [user]);

    // ─── Synchronisation panier serveur ──────────────────────────────────

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

    // ─── Nettoyage panier (produits indisponibles) ──────────────────────

    const lastCheckedCartIdsRef = useRef('');
    useEffect(() => {
        const ids = [...new Set(Object.keys(cartItems).map(getProductIdFromKey))];
        if (ids.length === 0) return;

        const signature = [...ids].sort().join(',');
        if (signature === lastCheckedCartIdsRef.current) return;
        lastCheckedCartIdsRef.current = signature;

        (async () => {
            try {
                const { data } = await axios.post('/api/product/check-availability', { ids });
                if (!data.success) return;

                const availableSet = new Set(data.availableIds);
                const unavailableKeys = Object.keys(cartItems).filter(
                    key => !availableSet.has(getProductIdFromKey(key))
                );

                if (unavailableKeys.length > 0) {
                    const cleaned = { ...cartItems };
                    unavailableKeys.forEach(key => delete cleaned[key]);
                    setCartItems(cleaned);
                    toast.error(
                        unavailableKeys.length === 1
                            ? "Un article n'est plus disponible et a été retiré de votre panier"
                            : `${unavailableKeys.length} articles ne sont plus disponibles et ont été retirés de votre panier`
                    );
                }
            } catch {
                // Silencieux : une vérif ratée ne doit pas toucher au panier.
            }
        })();
    }, [cartItems]);

    // ─── Valeur du contexte ──────────────────────────────────────────────

    const value = {
        // Client
        navigate, user, setUser,
        setIsSeller, isSeller,
        showUserLogin, setShowUserLogin,
        products, currency,
        cartItems, setCartItems,
        getCartKey, getProductIdFromKey,
        addToCart, addToCartWithQuantity, updateCartItem, removeFromCart,
        getCartAmount, getCartCount,
        searchQuery, setSearchQuery,
        wishlist, addToWishlist, removeFromWishlist, isInWishlist, fetchWishlist,
        recentlyViewed, addToRecentlyViewed,
        orders,
        colisShein, fetchColisShein, colisSheinActif, setColisSheinActif,
        // Authentification
        fetchUser, loginUser, registerUser, logoutUser,
        loginSeller, logoutSeller,
        // PWA / Push
        canInstallPWA, isPWAInstalled, installPWA,
        subscribeToPushNotifications,
        // [PHASE 3] Staff / Admin
        staffUser, setStaffUser,
        staffPermissions,
        hasPermission,
        hasAnyPermission,
        fetchStaffUser,
        // Utilitaires
        axios, fetchProducts,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    return useContext(AppContext);
};