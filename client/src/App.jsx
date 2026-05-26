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

const App = () => {

  const location = useLocation();
  const isSellerPath = location.pathname.includes("seller");
  const {showUserLogin, isSeller} = useAppContext()

  // Scroll automatique en haut à chaque changement de page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>

     {isSellerPath ? null : <Navbar/>} 
     {showUserLogin ? <Login/> : null}

     <Toaster />

      {/* Padding adapté : petit sur mobile, plus grand sur desktop mais reste cohérent */}
      <div className={`${isSellerPath ? "" : "px-4 pt-16 pb-20"}`}>
        <Routes>
          <Route path='/' element={<Home/>} />
          <Route path='/products' element={<AllProducts/>} />
          <Route path='/products/:category' element={<ProductCategory/>} />
          <Route path='/products/:category/:id' element={<ProductDetails/>} />
          <Route path='/cart' element={<Cart/>} />
          <Route path='/add-address' element={<AddAddress/>} />
          <Route path='/my-orders' element={<MyOrders/>} />
          <Route path='/loader' element={<Loading/>} />
          <Route path='/categories' element={<AllCategories/>} />
          <Route path='/wishlist' element={<Wishlist/>} />
          <Route path='/account' element={<Account/>} />
          <Route path='/payment/success' element={<PaymentSuccess/>} />
          <Route path='/payment/error' element={<PaymentError/>} />
          <Route path='/forgot-password' element={<ForgotPassword/>} />
          <Route path='/reset-password' element={<ResetPassword/>} />
          <Route path='/seller' element={isSeller ? <SellerLayout/> : <SellerLogin/>}>
            <Route index element={<Dashboard />} />
            <Route path='add-product' element={<AddProduct/>} />
            <Route path='product-list' element={<ProductList/>} />
            <Route path='orders' element={<Orders/>} />
            <Route path='banners' element={<BannerManager/>} />
            <Route path='categories' element={<CategoryManager/>} />
            <Route path='coupons' element={<CouponManager/>} />
            <Route path='locations' element={<LocationManager/>} />
            <Route path='delivery' element={<DeliveryManager/>} />
          </Route>
        </Routes>
      </div>
     {!isSellerPath && <Footer/>}
     {!isSellerPath && <BottomNav/>}

      {/* WhatsApp Floating Widget - Option C */}
      {!isSellerPath && (
        <a
          href="https://wa.me/2250101044942?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20concernant%20ma%20commande%20ou%20un%20produit%20sur%20GreenCart."
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-24 right-4 z-50 bg-green-500 hover:bg-green-600 text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center"
          style={{ width: '56px', height: '56px' }}
          aria-label="Contactez-nous sur WhatsApp"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="currentColor" 
            className="w-7 h-7"
          >
            <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22 1.5 14.448 1.5 5.25V4.5z" clipRule="evenodd" />
          </svg>
        </a>
      )}
    </div>
  )
}

export default App