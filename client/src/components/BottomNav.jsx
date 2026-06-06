import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'

const BottomNav = () => {

  const location = useLocation()
  const { setShowUserLogin, cartItems, axios } = useAppContext()
  const navigate = useNavigate()

  const [showSearch, setShowSearch] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [suggestions, setSuggestions] = useState([])
  
  // État pour les filtres
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    price: { min: 0, max: 10000 },
    categories: []
  })

  const cartCount = Object.values(cartItems || {}).reduce((a, b) => a + b, 0)
  const isActive = (path) => location.pathname === path

  const [cartBump, setCartBump] = useState(false)
  useEffect(() => {
    if (cartCount > 0) {
      setCartBump(true)
      const timer = setTimeout(() => setCartBump(false), 200)
      return () => clearTimeout(timer)
    }
  }, [cartCount])

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get('/api/category/list')
      if (data.success) setCategories(data.categories)
    } catch (error) { console.error(error) }
  }

  const fetchProducts = async () => {
    try {
      const { data } = await axios.get('/api/product/list')
      if (data.success) setProducts(data.products)
    } catch (error) { console.error(error) }
  }

  useEffect(() => {
    fetchCategories()
    fetchProducts()
  }, [])

  // Fonction pour récupérer l'affichage de la catégorie d'un produit (CHAÎNE)
  const getProductCategoryDisplay = (product) => {
    if (product.categories && product.categories.length > 0) {
      const cat = product.categories[0];
      // Si c'est une chaîne, on la retourne ; si c'est un objet, on prend son nom
      return typeof cat === 'string' ? cat : (cat.name || 'Produit');
    }
    return product.category || 'Produit';
  }

  // Fonction pour récupérer le slug de la catégorie pour le lien
  const getProductCategorySlug = (product) => {
    if (product.categories && product.categories.length > 0) {
      const cat = product.categories[0];
      const catName = typeof cat === 'string' ? cat : (cat.name || cat);
      return catName.toLowerCase();
    }
    if (product.category) {
      return product.category.toLowerCase();
    }
    return 'products';
  }

  useEffect(() => {
    if (searchText.trim().length > 0) {
      const searchLower = searchText.toLowerCase()
      const categorySuggestions = categories
        .filter(c => c.name.toLowerCase().includes(searchLower))
        .map(c => ({ label: c.name, type: 'Catégorie', path: `/products/${c.slug}` }))
      const productSuggestions = products
        .filter(p => p.name && p.name.toLowerCase().includes(searchLower) && p.inStock === true)
        .slice(0, 8)
        .map(p => ({ 
          label: p.name, 
          type: getProductCategoryDisplay(p), 
          path: `/products/${getProductCategorySlug(p)}/${p._id}` 
        }))
      setSuggestions([...categorySuggestions, ...productSuggestions])
    } else {
      setSuggestions([])
    }
  }, [searchText, categories, products])

  const handleSelect = (path) => {
    navigate(path)
    setShowSearch(false)
    setSearchText('')
    scrollTo(0, 0)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    
    const params = new URLSearchParams()
    
    if (searchText.trim()) {
      params.append('search', searchText.trim())
    }
    
    if (filters.price.min > 0) {
      params.append('minPrice', filters.price.min)
    }
    
    if (filters.price.max < 10000) {
      params.append('maxPrice', filters.price.max)
    }
    
    if (filters.categories.length > 0) {
      params.append('categories', filters.categories.join(','))
    }
    
    const queryString = params.toString()
    navigate(`/products${queryString ? `?${queryString}` : ''}`)
    setShowSearch(false)
    setSearchText('')
  }

  const activeFiltersCount = () => {
    let count = 0
    if (filters.price.min > 0) count++
    if (filters.price.max < 10000) count++
    count += filters.categories.length
    return count
  }

  return (
    <>
      {/* Overlay sombre pour la recherche */}
      {showSearch && (
        <div className='fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fadeIn'
          onClick={() => { setShowSearch(false); setSearchText('') }}
        />
      )}

      {/* Panneau de recherche moderne */}
      {showSearch && (
        <div className='fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-xl animate-slideDown'>
          <form onSubmit={handleSearch} className='flex items-center gap-3 px-5 py-4'>
            <div className='flex-1 flex items-center gap-3 bg-gray-100 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-primary/50'>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
              <input
                autoFocus
                type='text'
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder='Rechercher un produit...'
                className='flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400'
              />
              
              {/* Bouton Filtre */}
              <button 
                type='button'
                onClick={() => setShowFilters(true)}
                className='flex items-center gap-1 bg-gray-200/50 hover:bg-gray-200 rounded-full px-3 py-1.5 transition'
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                <span className="text-xs text-gray-600 font-medium">Filtre</span>
                {activeFiltersCount() > 0 && (
                  <span className="bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFiltersCount()}
                  </span>
                )}
              </button>
            </div>
            <button type='button' onClick={() => { setShowSearch(false); setSearchText('') }}
              className='text-gray-400 hover:text-gray-600 transition'>
              ✕
            </button>
          </form>

          {suggestions.length > 0 && (
            <ul className='max-h-80 overflow-y-auto border-t border-gray-100'>
              {suggestions.map((s, i) => (
                <li key={i} onClick={() => handleSelect(s.path)}
                  className='flex items-center justify-between px-5 py-3 hover:bg-gray-50 cursor-pointer transition'>
                  <div className='flex items-center gap-3'>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                    </svg>
                    <span className='text-sm text-gray-700'>{s.label}</span>
                  </div>
                  <span className='text-xs text-primary bg-primary/10 px-2 py-1 rounded-full'>{s.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Modal des filtres */}
      {showFilters && (
        <>
          <div 
            className='fixed inset-0 bg-black/50 z-50'
            onClick={() => setShowFilters(false)}
          />
          <div className='fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[85vh] overflow-y-auto'>
            <div className='sticky top-0 bg-white border-b p-4 flex justify-between items-center'>
              <h2 className='text-lg font-semibold'>Filtres</h2>
              <button onClick={() => setShowFilters(false)} className='p-1 hover:bg-gray-100 rounded-full'>
                ✕
              </button>
            </div>
            
            <div className='p-4 space-y-6'>
              <div>
                <h3 className='font-medium mb-3'>Prix</h3>
                <div className='flex gap-3'>
                  <div className='flex-1'>
                    <label className='text-xs text-gray-500'>Min (FCFA)</label>
                    <input
                      type='number'
                      min='0'
                      value={filters.price.min === 0 ? '' : filters.price.min}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        price: { ...prev.price, min: e.target.value === '' ? 0 : parseInt(e.target.value) }
                      }))}
                      placeholder='0'
                      className='w-full border rounded-lg px-3 py-2 text-sm'
                    />
                  </div>
                  <div className='flex-1'>
                    <label className='text-xs text-gray-500'>Max (FCFA)</label>
                    <input
                      type='number'
                      min='0'
                      value={filters.price.max === 10000 ? '' : filters.price.max}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        price: { ...prev.price, max: e.target.value === '' ? 10000 : parseInt(e.target.value) }
                      }))}
                      placeholder='10000'
                      className='w-full border rounded-lg px-3 py-2 text-sm'
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className='font-medium mb-3'>Catégories</h3>
                <div className='space-y-2 max-h-48 overflow-y-auto'>
                  {categories.map((cat, idx) => (
                    <label key={idx} className='flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={filters.categories.includes(cat.name)}
                        onChange={() => {
                          setFilters(prev => ({
                            ...prev,
                            categories: prev.categories.includes(cat.name)
                              ? prev.categories.filter(c => c !== cat.name)
                              : [...prev.categories, cat.name]
                          }))
                        }}
                        className='w-4 h-4 text-primary rounded'
                      />
                      <span className='text-sm'>{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className='sticky bottom-0 bg-white border-t p-4 flex gap-3'>
              <button
                onClick={() => setFilters({ price: { min: 0, max: 10000 }, categories: [] })}
                className='flex-1 py-2.5 border rounded-lg text-sm'
              >
                Réinitialiser
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className='flex-1 py-2.5 bg-primary text-white rounded-lg text-sm'
              >
                Appliquer
              </button>
            </div>
          </div>
        </>
      )}

      {/* Barre de navigation bas */}
      <div className='fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around items-center h-16 px-3 shadow-lg'>
        
        <Link to='/' className={`flex flex-col items-center gap-1 transition-all duration-200 group ${
          isActive('/') ? 'text-primary' : 'text-gray-500 hover:text-primary'
        }`}>
          <div className={`p-1.5 rounded-full transition-all duration-200 group-hover:bg-primary/10 ${isActive('/') ? 'bg-primary/10' : ''}`}>
            <svg className="w-5 h-5" fill={isActive('/') ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15v-6h-6v6H3.75A.75.75 0 013 21V9.75z" />
            </svg>
          </div>
          <span className="text-[11px] font-medium">Accueil</span>
        </Link>

        <button onClick={() => setShowSearch(!showSearch)}
          className={`flex flex-col items-center gap-1 transition-all duration-200 group ${
            showSearch ? 'text-primary' : 'text-gray-500 hover:text-primary'
          }`}>
          <div className="p-1.5 rounded-full transition-all duration-200 group-hover:bg-primary/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
          </div>
          <span className="text-[11px] font-medium">Chercher</span>
        </button>

        <Link to='/categories' className={`flex flex-col items-center gap-1 transition-all duration-200 group ${
          isActive('/categories') ? 'text-primary' : 'text-gray-500 hover:text-primary'
        }`}>
          <div className="p-1.5 rounded-full transition-all duration-200 group-hover:bg-primary/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </div>
          <span className="text-[11px] font-medium">Catégories</span>
        </Link>

        <Link to='/wishlist' className={`flex flex-col items-center gap-1 transition-all duration-200 group ${
          isActive('/wishlist') ? 'text-primary' : 'text-gray-500 hover:text-primary'
        }`}>
          <div className="p-1.5 rounded-full transition-all duration-200 group-hover:bg-primary/10">
            <svg className="w-5 h-5" fill={isActive('/wishlist') ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="text-[11px] font-medium">Favoris</span>
        </Link>

        <Link to='/my-orders' className={`flex flex-col items-center gap-1 transition-all duration-200 group ${
          isActive('/my-orders') ? 'text-primary' : 'text-gray-500 hover:text-primary'
        }`}>
          <div className="relative p-1.5 rounded-full transition-all duration-200 group-hover:bg-primary/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium">Commandes</span>
        </Link>

        <Link to='/account' className={`flex flex-col items-center gap-1 transition-all duration-200 group ${
          isActive('/account') ? 'text-primary' : 'text-gray-500 hover:text-primary'
        }`}>
          <div className="p-1.5 rounded-full transition-all duration-200 group-hover:bg-primary/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <span className="text-[11px] font-medium">Compte</span>
        </Link>

      </div>
    </>
  )
}

export default BottomNav