import React, { useEffect } from 'react'
import Navbar from './components/Navbar'
import { Route, Routes, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
import AllCategories from './pages/AllCategories';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentError from './pages/PaymentError';
import Loading from './components/Loading';
import BottomNav from './components/BottomNav';

// Composant d'animation pour les pages
const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3, ease: "easeInOut" }}
  >
    {children}
  </motion.div>
);

const App = () => {

  const location = useLocation();
  const isSellerPath = location.pathname.includes("seller");
  const { showUserLogin, isSeller } = useAppContext()

  // Scroll automatique en haut à chaque changement de page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>

      {isSellerPath ? null : <Navbar />}
      {showUserLogin ? <Login /> : null}

      <Toaster />

      {/* Padding adapté : petit sur mobile, plus grand sur desktop mais reste cohérent */}
      <div className={`${isSellerPath ? "" : "px-4 pt-16 pb-20"}`}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path='/' element={
              <PageTransition>
                <Home />
              </PageTransition>
            } />
            <Route path='/products' element={
              <PageTransition>
                <AllProducts />
              </PageTransition>
            } />
            <Route path='/products/:category' element={
              <PageTransition>
                <ProductCategory />
              </PageTransition>
            } />
            <Route path='/products/:category/:id' element={
              <PageTransition>
                <ProductDetails />
              </PageTransition>
            } />
            <Route path='/cart' element={
              <PageTransition>
                <Cart />
              </PageTransition>
            } />
            <Route path='/add-address' element={
              <PageTransition>
                <AddAddress />
              </PageTransition>
            } />
            <Route path='/my-orders' element={
              <PageTransition>
                <MyOrders />
              </PageTransition>
            } />
            <Route path='/loader' element={
              <PageTransition>
                <Loading />
              </PageTransition>
            } />
            <Route path='/categories' element={
              <PageTransition>
                <AllCategories />
              </PageTransition>
            } />
            <Route path='/wishlist' element={
              <PageTransition>
                <Wishlist />
              </PageTransition>
            } />
            <Route path='/account' element={
              <PageTransition>
                <Account />
              </PageTransition>
            } />
            <Route path='/payment/success' element={
              <PageTransition>
                <PaymentSuccess />
              </PageTransition>
            } />
            <Route path='/payment/error' element={
              <PageTransition>
                <PaymentError />
              </PageTransition>
            } />
            <Route path='/forgot-password' element={
              <PageTransition>
                <ForgotPassword />
              </PageTransition>
            } />
            <Route path='/reset-password' element={
              <PageTransition>
                <ResetPassword />
              </PageTransition>
            } />
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
        </AnimatePresence>
      </div>
      {!isSellerPath && <Footer />}
      {!isSellerPath && <BottomNav />}

      {/* WhatsApp Floating Widget - Icône seule + semi-transparent */}
      {!isSellerPath && (
        <a
          href="https://wa.me/2250101044942?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20concernant%20ma%20commande%20ou%20un%20produit%20sur%20GreenCart."
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-28 right-4 z-[9999] bg-[#25D366]/80 hover:bg-[#25D366] text-white p-2.5 rounded-full shadow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center backdrop-blur-[2px]"
          style={{ width: '44px', height: '44px' }}
          aria-label="Contactez-nous sur WhatsApp"
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
            alt="WhatsApp"
            className="w-5 h-5"
          />
        </a>
      )}
    </div>
  )
}

export default App