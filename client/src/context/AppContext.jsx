import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";

// [MIGRATION cookie httpOnly] withCredentials: true = le navigateur envoie
// automatiquement le cookie httpOnly (posé par le serveur) sur chaque
// requête vers l'API, sans que le JS ait jamais besoin de le lire ou de
// le manipuler lui-même. Fonctionne maintenant que client (www.ramci.ci)
// et API (api.ramci.ci) partagent le même domaine racine ramci.ci.
axios.defaults.withCredentials = true;
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

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

export const AppContext = createContext();

export const AppContextProvider = ({ children }) => {

    const currency = import.meta.env.VITE_CURRENCY;
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [isSeller, setIsSeller] = useState(getIsSeller);
    const [showUserLogin, setShowUserLogin] = useState(false);
    const [products, setProducts] = useState([]);
    const [cartItems, setCartItemsState] = useState(loadCartFromLocalStorage);
    const [searchQuery, setSearchQuery] = useState("");
    const [wishlist, setWishlist] = useState([]);
    const [recentlyViewed, setRecentlyViewed] = useState([]);
    const [orders, setOrders] = useState([]);
    const [colisShein, setColisShein] = useState([]);
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

    // Même logique que fetchWishlist/fetchOrders — sert à alimenter le badge
    // "Colis" du BottomNav (nombre de colis SHEIN encore actifs).
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
            // silent = true lors du chargement initial de la page : un 401
            // à ce moment-là signifie simplement "visiteur non connecté",
            // ce n'est pas une session expirée à signaler. On ne montre la
            // popup de reconnexion que pour les appels explicites (après une
            // action utilisateur), pas au chargement silencieux de la page.
            if (!silent && !window.location.pathname.includes('/seller')) {
                if (error.response?.data?.redirectToLogin) {
                    setShowUserLogin(true);
                }
            }
            setUser(null);
        }
    };

    // ✅ fetchProducts CORRIGÉ - Plus de dummyProducts
    // [CORRECTIF ARCHITECTURE] Anciennement /api/product/list SANS paramètre,
    // donc les 12 articles les plus récents seulement. Or cet état alimente
    // le panier (y compris le CALCUL DU TOTAL), la fiche produit, les pages
    // catégorie et la recherche : au-delà de 12 articles, une fiche s'ouvrait
    // vide et une ligne de panier inconnue était comptée pour zéro.
    // /api/product/catalogue renvoie tout le catalogue, sans les champs
    // lourds (description, vidéo) ni les champs internes.
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

    // 🔔 Notifications push
    // Convertit la clé publique VAPID (format base64url) en Uint8Array,
    // format attendu par l'API PushManager du navigateur.
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

    // Demande la permission (si pas déjà accordée/refusée), crée l'abonnement push
    // auprès du navigateur, puis l'enregistre côté serveur pour cet utilisateur.
    // À appeler depuis un clic explicite (bouton "Activer les notifications"),
    // jamais automatiquement au chargement de la page.
    //
    // [FIX] Paramètre `silent` : utilisé par la resynchronisation automatique
    // (voir useEffect ci-dessous) pour réabonner l'utilisateur sans spammer
    // de toast à chaque refresh de la page. Un clic explicite sur un bouton
    // continue lui d'afficher les toasts normalement (silent = false par défaut).
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
                if (!silent) toast.error("Notifications refusées. Vous pouvez les activer depuis les réglages du navigateur.");
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

    // Si la permission a déjà été accordée lors d'une session précédente,
    // on refait silencieusement l'abonnement (il peut expirer côté navigateur),
    // sans re-demander la permission à l'utilisateur.
    // [FIX] `silent = true` : avant, cet effet appelait subscribeToPushNotifications()
    // sans argument, donc le toast "Notifications activées 🔔" s'affichait à
    // CHAQUE refresh de page (le useEffect se redéclenche dès que `user` reprend
    // une nouvelle référence, ex: fetchUser() au chargement). On garde le
    // réabonnement silencieux, mais sans le toast qui n'a de sens que lors
    // d'une activation explicite par l'utilisateur.
    useEffect(() => {
        if (user && 'Notification' in window && Notification.permission === 'granted') {
            subscribeToPushNotifications(true);
        }
    }, [user]);

    useEffect(() => {
        const isOnSellerPage = window.location.pathname.includes('/seller');

        if (isOnSellerPage) {
            fetchSeller();
        } else {
            fetchUser(true); // silent = true : pas de popup de connexion si visiteur anonyme
            fetchSeller();
        }
        fetchProducts();
        loadRecentlyViewed();
    }, []);

    useEffect(() => {
        if (user) {
            fetchWishlist();
            fetchOrders();
            fetchColisShein();
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

    // ✅ Nettoyage panier : un produit du panier peut avoir été archivé ou
    // supprimé depuis. On ne peut pas se fier à `products` (liste publique
    // paginée, 12 articles par défaut) pour ça — un produit valide hors de
    // cette page serait faussement considéré comme indisponible. On
    // interroge donc /check-availability avec les IDs réellement présents
    // dans le panier. `lastCheckedCartIdsRef` évite de re-vérifier en boucle
    // le même ensemble d'IDs à chaque re-render.
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

    const value = {
        navigate, user, setUser,
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
        colisShein, fetchColisShein,
        canInstallPWA, isPWAInstalled, installPWA,
        subscribeToPushNotifications
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    return useContext(AppContext);
};