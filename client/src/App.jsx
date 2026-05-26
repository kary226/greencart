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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>

     {isSellerPath ? null : <Navbar/>} 
     {showUserLogin ? <Login/> : null}

     <Toaster />

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

      {/* WhatsApp Floating Button */}
      {!isSellerPath && (
        
          href="https://wa.me/2250101044942?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20concernant%20ma%20commande%20ou%20un%20produit%20sur%20GreenCart."
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-28 right-4 z-[9999] group flex items-center gap-3 bg-[#25D366] hover:bg-[#20b859] text-white pl-4 pr-4 py-3 rounded-full shadow-2xl transition-all duration-300 hover:pr-5"
          style={{ boxShadow: '0 8px 32px rgba(37, 211, 102, 0.35)' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            fill="currentColor"
            className="w-6 h-6 shrink-0"
          >
            <path d="M16.003 2.667C8.637 2.667 2.667 8.637 2.667 16c0 2.347.635 4.545 1.741 6.44L2.667 29.333l7.103-1.713A13.267 13.267 0 0 0 16.003 29.333C23.363 29.333 29.333 23.363 29.333 16S23.363 2.667 16.003 2.667zm0 2.4c5.94 0 10.93 4.99 10.93 10.933s-4.99 10.933-10.93 10.933a10.9 10.9 0 0 1-5.563-1.52l-.397-.24-4.12.994.995-3.997-.264-.412A10.9 10.9 0 0 1 5.07 16C5.07 10.057 10.06 5.067 16.003 5.067zm-3.23 5.386c-.216 0-.567.081-.864.405-.296.324-1.134 1.107-1.134 2.7s1.161 3.132 1.323 3.348c.162.216 2.268 3.618 5.589 4.929 2.754 1.083 3.321.869 3.917.814.594-.054 1.917-.783 2.187-1.539.27-.756.27-1.404.189-1.539-.081-.135-.297-.216-.621-.378-.324-.162-1.917-.945-2.213-1.053-.297-.108-.513-.162-.729.162-.216.324-.837 1.053-1.026 1.269-.189.216-.378.243-.702.081-.324-.162-1.368-.504-2.604-1.608-.963-.859-1.613-1.92-1.802-2.244-.189-.324-.021-.499.142-.661.147-.146.324-.378.486-.567.162-.189.216-.324.324-.54.108-.216.054-.405-.027-.567-.081-.162-.72-1.755-.999-2.403-.27-.648-.54-.54-.729-.54z"/>
          </svg>
          <span className="text-sm font-semibold whitespace-nowrap max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 opacity-0 group-hover:opacity-100">
            Besoin d'aide ?
          </span>
        </a>
      )}

    </div>
  )
}

export default App