import React, { Suspense, lazy, useEffect } from 'react';
import Navbar from './components/Navbar';
import { Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import { Toaster } from "react-hot-toast";
import Footer from './components/Footer';
import { useAppContext } from './context/AppContext';
import Login from './components/Login';
import AllProducts from './pages/AllProducts';
import ProductCategory from './pages/ProductCategory';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import AddAddress from './pages/AddAddress';
import MyOrders from './pages/MyOrders';
import OrderDetail from './pages/OrderDetail';
import Wishlist from './pages/Wishlist';
import Account from './pages/Account';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AllCategories from './pages/AllCategories';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentError from './pages/PaymentError';
import Loading from './components/Loading';
import BottomNav from './components/BottomNav';
import InstallApp from './pages/InstallApp';
import NotificationPrompt from './components/Notificationprompt';
import PageLoader from './components/PageLoader';

// ─── Lazy loading (Phase 1) ──────────────────────────────────────────

// Seller (ancien espace – conservé pour transition)
const SellerLogin = lazy(() => import('./components/seller/SellerLogin'));
const SellerLayout = lazy(() => import('./pages/seller/SellerLayout'));
const Dashboard = lazy(() => import('./pages/seller/Dashboard'));
const AddProduct = lazy(() => import('./pages/seller/AddProduct'));
const ProductList = lazy(() => import('./pages/seller/ProductList'));
const Orders = lazy(() => import('./pages/seller/Orders'));
const ClientsManager = lazy(() => import('./pages/seller/ClientsManager'));
const BannerManager = lazy(() => import('./pages/seller/BannerManager'));
const CategoryManager = lazy(() => import('./pages/seller/CategoryManager'));
const CouponManager = lazy(() => import('./pages/seller/CouponManager'));
const LocationManager = lazy(() => import('./pages/seller/LocationManager'));
const DeliveryManager = lazy(() => import('./pages/seller/DeliveryManager'));
const SettingsManager = lazy(() => import('./pages/seller/SettingsManager'));
const ColisSheinManager = lazy(() => import('./pages/seller/ColisSheinManager'));

// Staff / Admin (ancien espace – conservé pour transition)
const StaffLogin = lazy(() => import('./pages/staff/StaffLogin'));
const StaffActivation = lazy(() => import('./pages/staff/StaffActivation'));
const AdminComptes = lazy(() => import('./pages/admin/AdminComptes'));
const AdminBoutiques = lazy(() => import('./pages/admin/AdminBoutiques'));
const AdminCommandes = lazy(() => import('./pages/admin/AdminCommandes'));
const AdminRetours = lazy(() => import('./pages/admin/AdminRetours'));
const AdminRetraits = lazy(() => import('./pages/admin/AdminRetraits'));
const AdminJournal = lazy(() => import('./pages/admin/AdminJournal'));

// ─── [PHASE 3] Nouveau Super Admin Layout ────────────────────────────

// Layout unifié
const SuperAdminLayout = lazy(() => import('./components/SuperAdminLayout'));

// Pages admin unifiées
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminClients = lazy(() => import('./pages/admin/Clients'));
const AdminBanners = lazy(() => import('./pages/admin/Banners'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'));
const AdminLocations = lazy(() => import('./pages/admin/Locations'));
const AdminDeliveries = lazy(() => import('./pages/admin/Deliveries'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminApprovals = lazy(() => import('./pages/admin/Approvals'));

// Commerçant
const CommercantLayout = lazy(() => import('./pages/commercant/CommercantLayout'));
const DashboardCommercant = lazy(() => import('./pages/commercant/Dashboard'));
const Boutique = lazy(() => import('./pages/commercant/Boutique'));
const Produits = lazy(() => import('./pages/commercant/Produits'));
const Commandes = lazy(() => import('./pages/commercant/Commandes'));
const ProduitForm = lazy(() => import('./pages/commercant/ProduitForm'));
const CodesPromo = lazy(() => import('./pages/commercant/CodesPromo'));
const Portefeuille = lazy(() => import('./pages/commercant/Portefeuille'));
const DemandeRetrait = lazy(() => import('./pages/commercant/DemandeRetrait'));

// Livreur
const MesLivraisons = lazy(() => import('./pages/livreur/MesLivraisons'));
const LivraisonDetail = lazy(() => import('./pages/livreur/LivraisonDetail'));
const Collectes = lazy(() => import('./pages/livreur/Collectes'));

// Assistant Shein
const Conversations = lazy(() => import('./pages/assistant/Conversations'));
const ChatDetail = lazy(() => import('./pages/assistant/ChatDetail'));

// Colis Shein (client)
const ValiderPanierShein = lazy(() => import('./pages/ValiderPanierShein'));
const ColisSheinConversation = lazy(() => import('./pages/ColisSheinConversation'));
const ColisSheinDetailPage = lazy(() => import('./pages/ColisSheinDetailPage'));
const MesColisShein = lazy(() => import('./pages/MesColisShein'));

// Boutique vitrine publique
const BoutiqueVitrine = lazy(() => import('./pages/BoutiqueVitrine'));

// ─── ScrollToTop intelligent ──────────────────────────────────────────

const useSmartScroll = () => {
  const location = useLocation();
  const navigationKey = location.key;

  useEffect(() => {
    const savedPosition = sessionStorage.getItem(`scrollPos-${navigationKey}`);
    if (savedPosition !== null) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedPosition, 10));
      });
    } else {
      window.scrollTo(0, 0);
    }

    const handleBeforeUnload = () => {
      sessionStorage.setItem(`scrollPos-${navigationKey}`, window.scrollY.toString());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      sessionStorage.setItem(`scrollPos-${navigationKey}`, window.scrollY.toString());
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [navigationKey]);
};

// ─── App ──────────────────────────────────────────────────────────────

const App = () => {
  const location = useLocation();
  const { showUserLogin, user } = useAppContext();

  useSmartScroll();

  // Détection des espaces
  const isSellerPath = location.pathname.includes("/seller");
  const isStaffPath = location.pathname.startsWith("/staff");
  const isLivreurPath = location.pathname.startsWith("/livreur");
  const isCommercantPath = location.pathname.startsWith("/commercant");
  const isAdminPath = location.pathname.startsWith("/admin");
  const isAssistantPath = location.pathname.startsWith("/assistant");

  const isColisSheinPath =
    location.pathname === "/mes-colis-shein" ||
    location.pathname === "/valider-panier-shein" ||
    location.pathname.startsWith("/colis-shein/");

  const isChatFullScreenPath = location.pathname.startsWith("/colis-shein/");

  // Affichage des éléments
  const showFooter = !isSellerPath && !isStaffPath && !isColisSheinPath && !isLivreurPath && !isCommercantPath && !isAdminPath && !isAssistantPath;
  const showBottomNav = !isSellerPath && !isStaffPath && !isLivreurPath && !isCommercantPath && !isAdminPath && !isAssistantPath && !isChatFullScreenPath && !(showUserLogin && !user);
  const showNavbar = !isSellerPath && !isStaffPath && !isChatFullScreenPath && !isLivreurPath && !isCommercantPath && !isAdminPath && !isAssistantPath && !(showUserLogin && !user);

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>

      {showNavbar && <Navbar />}
      {showUserLogin && !user ? <Login /> : null}
      {!isSellerPath && !isStaffPath && !isChatFullScreenPath && !isLivreurPath && !isCommercantPath && !isAdminPath && <NotificationPrompt />}

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2500,
          style: {
            background: '#111111',
            color: '#ffffff',
            borderRadius: '40px',
            padding: '12px 20px',
            fontSize: '13px',
            fontWeight: '500',
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#ffffff' },
          },
          error: {
            iconTheme: { primary: '#e53935', secondary: '#ffffff' },
            style: { background: '#111111', color: '#ffffff' },
          },
          loading: {
            style: { background: '#111111', color: '#ffffff' },
          },
        }}
      />

      <div className={`${isSellerPath || isStaffPath || isChatFullScreenPath || isLivreurPath || isCommercantPath || isAdminPath || isAssistantPath ? "" : "px-4 pb-20"}`}>
        <Suspense fallback={<PageLoader />}>
          <Routes>

            {/* ─── Routes publiques ────────────────────────────────────── */}
            <Route path='/' element={<Home />} />
            <Route path='/products' element={<AllProducts />} />
            <Route path='/products/:category' element={<ProductCategory />} />
            <Route path='/products/:category/:id' element={<ProductDetails />} />
            <Route path='/cart' element={<Cart />} />
            <Route path='/add-address' element={<AddAddress />} />
            <Route path='/my-orders' element={<MyOrders />} />
            <Route path='/my-orders/:orderId' element={<OrderDetail />} />
            <Route path='/loader' element={<Loading />} />
            <Route path='/categories' element={<AllCategories />} />
            <Route path='/wishlist' element={<Wishlist />} />
            <Route path='/account' element={<Account />} />
            <Route path='/payment/success' element={<PaymentSuccess />} />
            <Route path='/payment/error' element={<PaymentError />} />
            <Route path='/forgot-password' element={<ForgotPassword />} />
            <Route path='/reset-password' element={<ResetPassword />} />
            <Route path='/install' element={<InstallApp />} />
            <Route path='/boutique/:id' element={<BoutiqueVitrine />} />

            {/* ─── Colis Shein (client) ────────────────────────────────── */}
            <Route path='/valider-panier-shein' element={<ValiderPanierShein />} />
            <Route path='/mes-colis-shein' element={<MesColisShein />} />
            <Route path='/colis-shein/:id' element={<ColisSheinConversation />} />
            <Route path='/colis-shein/:id/detail' element={<ColisSheinDetailPage />} />

            {/* ─── [PHASE 3] NOUVEAU SUPER ADMIN ──────────────────────── */}
            <Route path='/admin' element={<SuperAdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path='dashboard' element={<AdminDashboard />} />
              <Route path='products' element={<AdminProducts />} />
              <Route path='products/add' element={<AddProduct />} />
              <Route path='products/edit/:id' element={<AddProduct />} />
              <Route path='orders' element={<AdminOrders />} />
              <Route path='clients' element={<AdminClients />} />
              <Route path='banners' element={<AdminBanners />} />
              <Route path='categories' element={<AdminCategories />} />
              <Route path='coupons' element={<AdminCoupons />} />
              <Route path='locations' element={<AdminLocations />} />
              <Route path='deliveries' element={<AdminDeliveries />} />
              <Route path='settings' element={<AdminSettings />} />
              <Route path='settings/thresholds' element={<AdminSettings />} />
              <Route path='approvals' element={<AdminApprovals />} />
              <Route path='staff' element={<AdminComptes />} />
              <Route path='boutiques' element={<AdminBoutiques />} />
              <Route path='audit' element={<AdminJournal />} />
              <Route path='withdrawals' element={<AdminRetraits />} />
              <Route path='returns' element={<AdminRetours />} />
            </Route>

            {/* ─── Ancien Staff / Admin (transition) ──────────────────── */}
            <Route path='/staff/login' element={<StaffLogin />} />
            <Route path='/staff/activation/:token' element={<StaffActivation />} />
            <Route path='/staff/admin/comptes' element={<AdminComptes />} />
            <Route path='/staff/admin/boutiques' element={<AdminBoutiques />} />
            <Route path='/staff/admin/commandes' element={<AdminCommandes />} />
            <Route path='/staff/admin/retours' element={<AdminRetours />} />
            <Route path='/staff/admin/retraits' element={<AdminRetraits />} />
            <Route path='/staff/admin/journal' element={<AdminJournal />} />

            {/* ─── Commerçant ──────────────────────────────────────────── */}
            <Route path='/commercant' element={<CommercantLayout />}>
              <Route path='dashboard' element={<DashboardCommercant />} />
              <Route path='boutique' element={<Boutique />} />
              <Route path='produits' element={<Produits />} />
              <Route path='commandes' element={<Commandes />} />
              <Route path='produits/ajouter' element={<ProduitForm />} />
              <Route path='produits/editer/:id' element={<ProduitForm />} />
              <Route path='codes-promo' element={<CodesPromo />} />
              <Route path='portefeuille' element={<Portefeuille />} />
              <Route path='retraits' element={<DemandeRetrait />} />
            </Route>

            {/* ─── Livreur ────────────────────────────────────────────── */}
            <Route path='/livreur/mes-livraisons' element={<MesLivraisons />} />
            <Route path='/livreur/collectes' element={<Collectes />} />
            <Route path='/livreur/commande/:orderId' element={<LivraisonDetail />} />

            {/* ─── Assistant Shein ────────────────────────────────────── */}
            <Route path='/assistant/conversations' element={<Conversations />} />
            <Route path='/assistant/conversation/:id' element={<ChatDetail />} />

            {/* ─── Ancien Seller (transition) ────────────────────────── */}
            <Route path='/seller' element={<SellerLayout />}>
              <Route index element={<Dashboard />} />
              <Route path='add-product' element={<AddProduct />} />
              <Route path='product-list' element={<ProductList />} />
              <Route path='orders' element={<Orders />} />
              <Route path='clients' element={<ClientsManager />} />
              <Route path='banners' element={<BannerManager />} />
              <Route path='categories' element={<CategoryManager />} />
              <Route path='coupons' element={<CouponManager />} />
              <Route path='locations' element={<LocationManager />} />
              <Route path='delivery' element={<DeliveryManager />} />
              <Route path='settings' element={<SettingsManager />} />
              <Route path='colis-shein' element={<ColisSheinManager />} />
            </Route>

          </Routes>
        </Suspense>
      </div>

      {showFooter && <Footer />}
      {showBottomNav && <BottomNav />}
    </div>
  );
};

export default App;