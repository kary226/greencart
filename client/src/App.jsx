import React, { useEffect, lazy, Suspense } from 'react'
import Navbar from './components/Navbar'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from "react-hot-toast";
import Footer from './components/Footer';
import { useAppContext } from './context/AppContext';
import Login from './components/Login';
import Loading from './components/Loading';
import BottomNav from './components/BottomNav';

// ⚡ LAZY LOADING - Ces composants ne seront chargés que quand on en a besoin
const Home = lazy(() => import('./pages/Home'));
const AllProducts = lazy(() => import('./pages/AllProducts'));
const ProductCategory = lazy(() => import('./pages/ProductCategory'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const AddAddress = lazy(() => import('./pages/AddAddress'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Account = lazy(() => import('./pages/Account'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
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
const AllCategories = lazy(() => import('./pages/AllCategories'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentError = lazy(() => import('./pages/PaymentError'));
const InstallApp = lazy(() => import('./pages/InstallApp'));

// 🔝 ScrollToTop intelligent : téléporte en haut sur navigation avant, restaure la position au retour
const useSmartScroll = () => {
  const location = useLocation();
  const navigationKey = location.key;

  useEffect(() => {
    // 1. Sauvegarder la position actuelle AVANT de changer de page
    const savedPosition = sessionStorage.getItem(`scrollPos-${navigationKey}`);

    if (savedPosition !== null) {
      // C'est un retour arrière → restaurer la position sauvegardée
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedPosition, 10));
      });
    } else {
      // C'est une nouvelle navigation → téléporter en haut
      window.scrollTo(0, 0);
    }

    // 2. Sauvegarder la position quand l'utilisateur quitte la page
    const handleBeforeUnload = () => {
      sessionStorage.setItem(`scrollPos-${navigationKey}`, window.scrollY.toString());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      // Sauvegarder aussi au démontage du composant (changement de route)
      sessionStorage.setItem(`scrollPos-${navigationKey}`, window.scrollY.toString());
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [navigationKey]);
};

// 🎨 Composant fallback personnalisé avec un loader stylé
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 text-sm font-medium">Chargement...</p>
    </div>
  </div>
);

const App = () => {

  const location = useLocation();
  const isSellerPath = location.pathname.includes("seller");
  const { showUserLogin, isSeller, user } = useAppContext()

  useSmartScroll();

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>

      {/* Navbar - visible sur toutes les pages client (pas sur seller) */}
      {!isSellerPath && <Navbar />}
      
      {/* Modal de connexion - seulement si demandé ET utilisateur non connecté */}
      {showUserLogin && !user ? <Login /> : null}

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

      <div className={`${isSellerPath ? "" : "px-4 pb-20"}`}>
        {/* ⚡ Suspense avec fallback pour le chargement des pages */}
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
            </Route>
          </Routes>
        </Suspense>
      </div>
      {!isSellerPath && <Footer />}
      {!isSellerPath && <BottomNav />}
    </div>
  )
}

export default App