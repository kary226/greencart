import React, { useEffect } from 'react'
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
import SellerLogin from './components/seller/SellerLogin';
import SellerLayout from './pages/seller/SellerLayout';
import Dashboard from './pages/seller/Dashboard';
import AddProduct from './pages/seller/AddProduct';
import ProductList from './pages/seller/ProductList';
import Orders from './pages/seller/Orders';
import ClientsManager from './pages/seller/ClientsManager';
import BannerManager from './pages/seller/BannerManager';
import CategoryManager from './pages/seller/CategoryManager';
import CouponManager from './pages/seller/CouponManager';
import LocationManager from './pages/seller/LocationManager';
import DeliveryManager from './pages/seller/DeliveryManager';
import SettingsManager from './pages/seller/SettingsManager'; // ✅ AJOUTÉ
import AllCategories from './pages/AllCategories';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentError from './pages/PaymentError';
import Loading from './components/Loading';
import BottomNav from './components/BottomNav';
import InstallApp from './pages/InstallApp';
import NotificationPrompt from './components/Notificationprompt';
import ValiderPanierShein from './pages/ValiderPanierShein';
import ColisSheinDetail from './pages/ColisSheinDetail';

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
  const { showUserLogin, isSeller, user } = useAppContext()

  useSmartScroll();

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>

      {!isSellerPath && <Navbar />}
      
      {showUserLogin && !user ? <Login /> : null}

      {!isSellerPath && <NotificationPrompt />}

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
          <Route path='/colis-shein/:id' element={<ColisSheinDetail />} />
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
            <Route path='settings' element={<SettingsManager />} /> {/* ✅ AJOUTÉ */}

          </Route>
        </Routes>
      </div>
      {!isSellerPath && <Footer />}
      {!isSellerPath && <BottomNav />}
    </div>
  )
}

export default App