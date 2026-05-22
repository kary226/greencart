import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { assets } from '../assets/assets'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'

const Navbar = () => {
    const [open, setOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const {user, setUser, setShowUserLogin, navigate, setSearchQuery, searchQuery, getCartCount, axios} = useAppContext();

    // Détecter le scroll pour l'effet de blur
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const logout = async ()=>{
      try {
        const { data } = await axios.get('/api/user/logout')
        if(data.success){
          toast.success(data.message)
          setUser(null);
          navigate('/')
        }else{
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    useEffect(()=>{
      if(searchQuery.length > 0){
        navigate("/products")
      }
    },[searchQuery])

    // Animation pour le badge panier
    const cartCount = getCartCount()
    const [cartBump, setCartBump] = useState(false)
    
    useEffect(() => {
        if (cartCount > 0) {
            setCartBump(true)
            const timer = setTimeout(() => setCartBump(false), 200)
            return () => clearTimeout(timer)
        }
    }, [cartCount])

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
            scrolled 
                ? 'bg-white/95 backdrop-blur-md shadow-md py-3' 
                : 'bg-white shadow-sm py-4'
        }`}>
            <div className="flex items-center justify-between px-6 md:px-16 lg:px-24 xl:px-32">
                
                <NavLink to='/' onClick={()=> setOpen(false)}>
                    <img className="h-9 transition-transform hover:scale-105" src={assets.logo} alt="logo" />
                </NavLink>

                <div className="hidden sm:flex items-center gap-8">
                    <NavLink to='/' className="hover:text-primary transition-colors"></NavLink>
                    <NavLink to='/products' className="hover:text-primary transition-colors"></NavLink>
                    <NavLink to='/categories' className="hover:text-primary transition-colors"></NavLink>
                    <NavLink to='/' className="hover:text-primary transition-colors"></NavLink>


                    

                    <div onClick={()=> navigate("/cart")} className="relative cursor-pointer hover:scale-105 transition-transform">
                        <img src={assets.nav_cart_icon} alt='cart' className='w-6 opacity-80'/>
                        <button className={`absolute -top-2 -right-3 text-xs text-white bg-primary w-[18px] h-[18px] rounded-full transition-all duration-200 ${cartBump ? 'scale-125 bg-red-500' : 'scale-100'}`}>
                            {cartCount}
                        </button>
                    </div>

                    {!user ? ( 
                        <button onClick={()=> setShowUserLogin(true)} className="cursor-pointer px-8 py-2 bg-primary hover:bg-primary-dull transition text-white rounded-full shadow-md hover:shadow-lg">
                            Connexion
                        </button>
                    ) : (
                        <div className='relative group'>
                            <img src={assets.profile_icon} className='w-10 cursor-pointer hover:opacity-80 transition' alt="" />
                            <ul className='hidden group-hover:block absolute top-10 right-0 bg-white shadow-lg border border-gray-200 py-2.5 w-32 rounded-md text-sm z-50'>
                                <li onClick={()=> navigate("my-orders")} className='p-2 pl-3 hover:bg-primary/10 cursor-pointer transition'>Mes commandes</li>
                                <li onClick={()=> navigate("wishlist")} className='p-2 pl-3 hover:bg-primary/10 cursor-pointer transition'>Mes favoris</li>
                                <li onClick={logout} className='p-2 pl-3 hover:bg-primary/10 cursor-pointer transition'>Déconnexion</li>
                            </ul>
                        </div>
                    )}
                </div>

                <div className='flex items-center gap-6 sm:hidden'>
                    <div onClick={()=> navigate("/cart")} className="relative cursor-pointer">
                        <img src={assets.nav_cart_icon} alt='cart' className='w-6 opacity-80'/>
                        <button className={`absolute -top-2 -right-3 text-xs text-white bg-primary w-[18px] h-[18px] rounded-full transition-all duration-200 ${cartBump ? 'scale-125' : ''}`}>
                            {cartCount}
                        </button>
                    </div>
                    <button onClick={() => setOpen(!open)} aria-label="Menu" className="relative z-50 p-2 hover:bg-gray-100 rounded-full transition">
                        <img src={assets.menu_icon} alt='menu' className='w-6'/>
                    </button>
                </div>

                {/* Menu mobile animé */}
                <div className={`fixed top-[60px] left-0 w-full bg-white shadow-xl py-4 flex-col items-start gap-2 px-5 text-sm z-[100] md:hidden transition-all duration-300 ease-in-out ${
                    open ? 'flex opacity-100 translate-y-0' : 'hidden opacity-0 -translate-y-4'
                }`}>
                    <NavLink to="/" onClick={()=> setOpen(false)} className="w-full py-2 hover:text-primary transition">Accueil</NavLink>
                    <NavLink to="/products" onClick={()=> setOpen(false)} className="w-full py-2 hover:text-primary transition">Tous les produits</NavLink>
                    <NavLink to="/categories" onClick={()=> setOpen(false)} className="w-full py-2 hover:text-primary transition">Catégories</NavLink>
                    {user && 
                        <NavLink to="/my-orders" onClick={()=> setOpen(false)} className="w-full py-2 hover:text-primary transition">Mes commandes</NavLink>
                    }
                    <NavLink to="/wishlist" onClick={()=> setOpen(false)} className="w-full py-2 hover:text-primary transition">Mes favoris</NavLink>
                    <NavLink to="/" onClick={()=> setOpen(false)} className="w-full py-2 hover:text-primary transition">Contact</NavLink>

                    {!user ? (
                        <button onClick={()=>{
                            setOpen(false);
                            setShowUserLogin(true);
                        }} className="w-full cursor-pointer px-6 py-2 mt-2 bg-primary hover:bg-primary-dull transition text-white rounded-full text-sm">
                            Connexion
                        </button>
                    ) : (
                        <button onClick={logout} className="w-full cursor-pointer px-6 py-2 mt-2 bg-primary hover:bg-primary-dull transition text-white rounded-full text-sm">
                            Déconnexion
                        </button>
                    )}
                </div>
            </div>
        </nav>
    )
}

export default Navbar