import React, { Suspense, lazy, useEffect } from 'react'
import Navbar from './components/Navbar'
import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
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

// ⚡ PHASE 1 - Code splitting (React.lazy)
// Ces zones ne sont utilisées que par une partie des visiteurs (vendeurs,
// staff, commerçants, livreurs, assistants Shein). Les charger dynamiquement
// évite qu'un client qui vient simplement acheter un produit télécharge
// aussi le code de toutes les interfaces de gestion.

// Zone Seller
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

// Zone Staff / Admin
const StaffLogin = lazy(() => import('./pages/staff/StaffLogin'));
const StaffActivation = lazy(() => import('./pages/staff/StaffActivation'));
const AdminComptes = lazy(() => import('./pages/admin/AdminComptes'));

// Zone Commerçant
const CommercantLayout = lazy(() => import('./pages/commercant/CommercantLayout'));
const DashboardCommercant = lazy(() => import('./pages/commercant/Dashboard'));
const Boutique = lazy(() => import('./pages/commercant/Boutique'));
const Produits = lazy(() => import('./pages/commercant/Produits'));
const ProduitForm = lazy(() => import('./pages/commercant/ProduitForm'));
const CodesPromo = lazy(() => import('./pages/commercant/CodesPromo'));
const Portefeuille = lazy(() => import('./pages/commercant/Portefeuille'));
const DemandeRetrait = lazy(() => import('./pages/commercant/DemandeRetrait'));

// Zone Livreur
const MesLivraisons = lazy(() => import('./pages/livreur/MesLivraisons'));
const LivraisonDetail = lazy(() => import('./pages/livreur/LivraisonDetail'));

// Zone Assistant Shein (back-office)
const Conversations = lazy(() => import('./pages/assistant/Conversations'));
const ChatDetail = lazy(() => import('./pages/assistant/ChatDetail'));

// Zone ColisShein (côté client — fonctionnalité optionnelle, pas du parcours
// d'achat principal, donc également séparée du bundle initial)
const ValiderPanierShein = lazy(() => import('./pages/ValiderPanierShein'));
const ColisSheinConversation = lazy(() => import('./pages/ColisSheinConversation'));
const ColisSheinDetailPage = lazy(() => import('./pages/ColisSheinDetailPage'));
const MesColisShein = lazy(() => import('./pages/MesColisShein'));

// 🔝 ScrollToTop intelligent
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

const App = () => {

  const location = useLocation();
  const isSellerPath = location.pathname.includes("seller");
  const isStaffPath = location.pathname.startsWith("/staff");
  const isLivreurPath = location.pathname.startsWith("/livreur");
  const isCommercantPath = location.pathname.startsWith("/commercant");
  
  const isColisSheinPath =
    location.pathname === "/mes-colis-shein" ||
    location.pathname === "/valider-panier-shein" ||
    location.pathname.startsWith("/colis-shein/");
    
  const isChatFullScreenPath = location.pathname.startsWith("/colis-shein/");
  const { showUserLogin, isSeller, user } = useAppContext()

  useSmartScroll();

  const showFooter = !isSellerPath && !isStaffPath && !isColisSheinPath && !isLivreurPath && !isCommercantPath;
  const showBottomNav = !isSellerPath && !isStaffPath && !isLivreurPath && !isCommercantPath && !isChatFullScreenPath && !(showUserLogin && !user);

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>

      {!isSellerPath && !isStaffPath && !isChatFullScreenPath && !isLivreurPath && !isCommercantPath && !(showUserLogin && !user) && <Navbar />}
      
      {showUserLogin && !user ? <Login /> : null}

      {!isSellerPath && !isStaffPath && !isChatFullScreenPath && !isLivreurPath && !isCommercantPath && <NotificationPrompt />}

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
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#e53935',
              secondary: '#ffffff',
            },
            style: {
              background: '#111111',
              color: '#ffffff',
            },
          },
          loading: {
            style: {
              background: '#111111',
              color: '#ffffff',
            },
          },
        }}
      />

      <div className={`${isSellerPath || isStaffPath || isChatFullScreenPath || isLivreurPath || isCommercantPath ? "" : "px-4 pb-20"}`}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/products' element={<AllProducts />} />
            <Route path='/products/:category' element={<ProductCategory />} />
            <Route path='/products/:category/:id' element={<ProductDetails />} />
            <Route path='/cart' element={<Cart />} />
            <Route path='/add-address' element={<AddAddress />} />
            <Route path='/my-orders' element={<MyOrders />} />
            <Route path='/loader' element={<Loading />} />
            <Route path='/categories' element={<AllCategories />} />
            <Route path='/wishlist' element={<Wishlist />} />
            <Route path='/account' element={<Account />} />
            <Route path='/payment/success' element={<PaymentSuccess />} />
            <Route path='/payment/error' element={<PaymentError />} />
            <Route path='/forgot-password' element={<ForgotPassword />} />
            <Route path='/reset-password' element={<ResetPassword />} />
            <Route path='/install' element={<InstallApp />} />
            <Route path='/valider-panier-shein' element={<ValiderPanierShein />} />
            <Route path='/mes-colis-shein' element={<MesColisShein />} />
            <Route path='/colis-shein/:id' element={<ColisSheinConversation />} />
            <Route path='/colis-shein/:id/detail' element={<ColisSheinDetailPage />} />
            
            
            {/* Routes Staff */}
            <Route path='/staff/login' element={<StaffLogin />} />
            <Route path='/staff/activation/:token' element={<StaffActivation />} />
            <Route path='/staff/admin/comptes' element={<AdminComptes />} />

            {/* ✅ PHASE 3 - Routes Commerçant */}
            <Route path='/commercant' element={<CommercantLayout />}>
              <Route path='dashboard' element={<DashboardCommercant />} />
              <Route path='boutique' element={<Boutique />} />
              <Route path='produits' element={<Produits />} />
              <Route path='produits/ajouter' element={<ProduitForm />} />
              <Route path='produits/editer/:id' element={<ProduitForm />} />
              <Route path='codes-promo' element={<CodesPromo />} />
              <Route path='portefeuille' element={<Portefeuille />} />
              <Route path='retraits' element={<DemandeRetrait />} />
            </Route>

            {/* ✅ PHASE 4 - Routes Livreur */}
            <Route path='/livreur/mes-livraisons' element={<MesLivraisons />} />
            <Route path='/livreur/commande/:orderId' element={<LivraisonDetail />} />

            {/* ✅ PHASE 5 - Routes Assistant Shein */}
            <Route path='/assistant/conversations' element={<Conversations />} />
            <Route path='/assistant/conversation/:id' element={<ChatDetail />} />

            {/* Routes Seller */}
            <Route path='/seller' element={isSeller ? <SellerLayout /> : <SellerLogin />}>
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
  )
}

export default App