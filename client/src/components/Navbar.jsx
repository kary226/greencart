import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const Navbar = () => {
  const { cartItems, wishlist, user, searchQuery, setSearchQuery, axios, products, logoutUser } = useAppContext();
  const [query, setQuery] = useState(searchQuery || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categories, setCategories] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const suggestionsRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const cartCount = cartItems ? Object.values(cartItems).reduce((a, b) => a + b, 0) : 0;
  const wishlistCount = wishlist?.length || 0;

  // État pour les filtres
  const [filters, setFilters] = useState({
    category: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'relevance'
  });

  // Vérifier si un filtre est actif
  const hasActiveFilters = () => {
    return filters.category !== '' || filters.minPrice !== '' || filters.maxPrice !== '' || filters.sortBy !== 'relevance';
  };

  // Lire les filtres depuis l'URL au chargement
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilters({
      category: params.get('categories') || '',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      sortBy: params.get('sort') || 'relevance'
    });
  }, [location.search]);

  // Gestion de l'installation PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('✅ Application installée');
      }
      setDeferredPrompt(null);
    } else {
      alert("📱 Sur Android + Chrome : installez l'application.\n🍏 Sur iPhone : utilisez 'Partager' → 'Sur l'écran d'accueil'.");
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get('/api/category/list');
        if (data.success) setCategories(data.categories);
      } catch (error) {}
    };
    fetchCategories();
  }, []);

  const computeSuggestions = (searchTerm) => {
    if (!searchTerm.trim()) return [];

    const term = searchTerm.toLowerCase().trim();
    const words = term.split(/\s+/).filter(Boolean);

    const scoreProduct = (name) => {
      const n = name.toLowerCase();
      if (n === term) return 100;
      if (n.startsWith(term)) return 80;
      if (n.includes(term)) return 60;
      const matched = words.filter(w => n.includes(w));
      if (matched.length > 0) return 20 + matched.length * 10;
      return 0;
    };

    const scoreCategory = (name) => {
      const n = name.toLowerCase();
      if (n === term) return 110;
      if (n.startsWith(term)) return 85;
      if (n.includes(term)) return 65;
      const matched = words.filter(w => n.includes(w));
      if (matched.length > 0) return 25 + matched.length * 10;
      return 0;
    };

    const catResults = categories
      .map(c => ({ _type: 'category', text: c.name, slug: c.slug || c.name, score: scoreCategory(c.name) }))
      .filter(c => c.score > 0);

    const seenNames = new Set();
    const prodResults = products
      .map(p => ({ _type: 'product', text: p.name, score: scoreProduct(p.name) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .filter(p => {
        if (seenNames.has(p.text)) return false;
        seenNames.add(p.text);
        return true;
      });

    return [...catResults, ...prodResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };

  useEffect(() => {
    if (query.trim()) {
      setShowSuggestions(true);
      const id = setTimeout(() => setSuggestions(computeSuggestions(query)), 200);
      return () => clearTimeout(id);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, products, categories]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e?.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      setSearchQuery && setSearchQuery(query.trim());
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (s) => {
    setShowSuggestions(false);
    if (s._type === 'category') {
      navigate(`/products?categories=${encodeURIComponent(s.slug)}`);
    } else {
      setQuery(s.text);
      setSearchQuery && setSearchQuery(s.text);
      navigate(`/products?search=${encodeURIComponent(s.text)}`);
    }
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logoutUser();
  };

  const handleHelp = () => {
    setMenuOpen(false);
    if (window.Tawk_API) {
      window.Tawk_API.showWidget();
      window.Tawk_API.maximize();
    } else {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://embed.tawk.to/6a26a25d683c831c304cb5ea/1jqjekfae';
      script.charset = 'UTF-8';
      script.setAttribute('crossorigin', '*');
      document.body.appendChild(script);
      setTimeout(() => {
        if (window.Tawk_API) {
          window.Tawk_API.showWidget();
          window.Tawk_API.maximize();
        }
      }, 1000);
    }
  };

  const handleFilterClick = () => {
    setShowFilters(!showFilters);
  };

  const applyFilters = () => {
    let url = '/products?';
    const params = [];
    
    if (query.trim()) {
      params.push(`search=${encodeURIComponent(query.trim())}`);
    }
    if (filters.category) {
      params.push(`categories=${encodeURIComponent(filters.category)}`);
    }
    if (filters.minPrice) {
      params.push(`minPrice=${filters.minPrice}`);
    }
    if (filters.maxPrice) {
      params.push(`maxPrice=${filters.maxPrice}`);
    }
    if (filters.sortBy !== 'relevance') {
      params.push(`sort=${filters.sortBy}`);
    }
    
    url += params.join('&');
    setShowFilters(false);
    navigate(url);
  };

  const resetFilters = () => {
    setFilters({
      category: '',
      minPrice: '',
      maxPrice: '',
      sortBy: 'relevance'
    });
    setShowFilters(false);
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    } else {
      navigate('/products');
    }
  };

  return (
    <>
      <header className="ramci-navbar">
        <div className="ramci-nav-top">
          {/* Menu hamburger avec dropdown */}
          <div className="ramci-menu-container" ref={menuRef}>
            <button 
              className="ramci-menu-btn" 
              aria-label="Menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span /><span /><span />
            </button>
            
            {menuOpen && (
              <div className="ramci-dropdown-menu">
                <Link to="/" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                  </svg>
                  Accueil
                </Link>
                <Link to="/products" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                  Produits
                </Link>
                <Link to="/categories" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                  Catégories
                </Link>
                <Link to="/my-orders" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                  Mes commandes
                </Link>
                <Link to="/account" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Mon compte
                </Link>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item help-btn" onClick={handleHelp}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Besoin d'aide
                </button>
                {user && (
                  <>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item logout-btn" onClick={handleLogout}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Déconnexion
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <Link to="/" className="ramci-logo">RAMCI</Link>

          <div className="ramci-nav-actions">
            {/* Bouton d'installation PWA moderne avec flèche vers le bas */}
            <button 
              className="install-pwa-btn"
              onClick={handleInstallClick}
              aria-label="Installer l'application"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14m0 0-4-4m4 4 4-4"/>
                <path d="M5 12h14"/>
              </svg>
              <span>Télécharger</span>
            </button>

            <Link to="/wishlist" className="ramci-nav-icon" aria-label="Favoris">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {wishlistCount > 0 && <span className="ramci-badge">{wishlistCount}</span>}
            </Link>
            
            <Link to="/cart" className="ramci-nav-icon ramci-cart-icon" aria-label="Panier">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                <circle cx="9" cy="21" r="1.5" />
                <circle cx="20" cy="21" r="1.5" />
              </svg>
              {cartCount > 0 && <span className="ramci-badge">{cartCount}</span>}
            </Link>
          </div>
        </div>

        <form className="ramci-search-form" onSubmit={handleSearch} ref={suggestionsRef}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Rechercher un article ou une catégorie..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim() && setShowSuggestions(true)}
            className="ramci-search-input"
          />
          
          {/* Bouton filtre avec indicateur */}
          <div className="filter-btn-wrapper">
            <button type="button" onClick={handleFilterClick} className="ramci-filter-btn" aria-label="Filtres">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
            </button>
            {hasActiveFilters() && (
              <span className="filter-active-dot"></span>
            )}
          </div>

          {showSuggestions && (
            <div className="search-suggestions">
              {suggestions.length > 0 ? (
                <>
                  {suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="suggestion-item"
                      onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s); }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <span className="suggestion-text">{s.text}</span>
                    </div>
                  ))}
                  <div className="suggestion-footer">
                    <button
                      type="submit"
                      className="suggestion-see-all"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      Voir tous les résultats pour «{query}»
                    </button>
                  </div>
                </>
              ) : (
                <div className="suggestion-empty">Aucun résultat pour «{query}»</div>
              )}
            </div>
          )}
        </form>
      </header>

      {/* Modal Filtres */}
      {showFilters && (
        <div className="filters-modal" onClick={() => setShowFilters(false)}>
          <div className="filters-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="filters-header">
              <h3>Filtrer les résultats</h3>
              <button onClick={() => setShowFilters(false)}>✕</button>
            </div>
            
            <div className="filters-body">
              <div className="filter-group">
                <label>Catégorie</label>
                <select 
                  value={filters.category} 
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Prix minimum (FCFA)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
                />
              </div>

              <div className="filter-group">
                <label>Prix maximum (FCFA)</label>
                <input 
                  type="number" 
                  placeholder="Illimité"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                />
              </div>

              <div className="filter-group">
                <label>Trier par</label>
                <select 
                  value={filters.sortBy} 
                  onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                >
                  <option value="relevance">Pertinence</option>
                  <option value="price_asc">Prix croissant</option>
                  <option value="price_desc">Prix décroissant</option>
                  <option value="newest">Plus récents</option>
                </select>
              </div>
            </div>

            <div className="filters-footer">
              <button onClick={resetFilters} className="reset-btn">
                Réinitialiser
              </button>
              <button onClick={applyFilters} className="apply-btn">
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@400;500;600&display=swap');

        .ramci-navbar {
          position: sticky;
          top: 0;
          z-index: 200;
          background: #fff;
          border-bottom: 1px solid #f0ede8;
        }
        .ramci-nav-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
        }
        
        .ramci-menu-container {
          position: relative;
        }
        
        .ramci-menu-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 4px;
          width: 36px;
        }
        .ramci-menu-btn span {
          display: block;
          height: 1.5px;
          background: #111;
          border-radius: 2px;
          transition: all 0.2s;
        }
        .ramci-menu-btn span:nth-child(1) { width: 22px; }
        .ramci-menu-btn span:nth-child(2) { width: 16px; }
        .ramci-menu-btn span:nth-child(3) { width: 19px; }
        
        .ramci-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          min-width: 220px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.12);
          margin-top: 12px;
          overflow: hidden;
          z-index: 1000;
          border: 1px solid #f0ede8;
        }
        
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #333;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.2s;
          width: 100%;
          background: none;
          border: none;
          text-align: left;
        }
        .dropdown-item:hover {
          background: #faf8f5;
        }
        
        .dropdown-divider {
          height: 1px;
          background: #f0ede8;
          margin: 4px 0;
        }
        
        .logout-btn {
          color: #e53935;
        }
        .logout-btn:hover {
          background: #fef2f2;
        }
        
        .help-btn {
          color: #111;
        }

        .ramci-logo {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 26px;
          font-weight: 600;
          letter-spacing: 6px;
          color: #111;
          text-decoration: none;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }
        
        .ramci-nav-actions { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
        }
        
        /* BOUTON PWA MODERNE - FLÈCHE VERS LE BAS */
        .install-pwa-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: none;
          border-radius: 40px;
          padding: 8px 14px;
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          position: relative;
          overflow: hidden;
        }
        
        .install-pwa-btn svg {
          stroke: white;
          transition: transform 0.2s ease;
        }
        
        .install-pwa-btn span {
          letter-spacing: 0.3px;
        }
        
        /* Animation d'attraction */
        .install-pwa-btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .install-pwa-btn:hover::before {
          width: 200%;
          height: 200%;
        }
        
        .install-pwa-btn:hover {
          background: linear-gradient(135deg, #e53935 0%, #c62828 100%);
          transform: scale(1.03);
          box-shadow: 0 4px 12px rgba(229, 57, 53, 0.4);
        }
        
        .install-pwa-btn:hover svg {
          transform: translateY(2px);
        }
        
        /* Animation de pulsation pour attirer l'attention */
        .install-pwa-btn {
          animation: pulse-ring 1.8s ease-in-out infinite;
        }
        
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.4);
          }
          70% {
            box-shadow: 0 0 0 6px rgba(229, 57, 53, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(229, 57, 53, 0);
          }
        }
        
        /* Version sombre (si le thème noir est activé) */
        @media (prefers-color-scheme: dark) {
          .install-pwa-btn {
            background: linear-gradient(135deg, #e53935 0%, #b71c1c 100%);
            box-shadow: 0 2px 8px rgba(229, 57, 53, 0.3);
          }
          .install-pwa-btn span {
            color: white;
          }
        }
        
        .ramci-nav-icon {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          color: #111;
          text-decoration: none;
          transition: opacity .15s;
          background: none;
          border: none;
          cursor: pointer;
        }
        .ramci-nav-icon:hover { opacity: .6; }
        
        .ramci-cart-icon { position: relative; }
        .ramci-badge {
          position: absolute;
          top: 0px;
          right: 0px;
          background: #e53935;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 9px;
          font-weight: 600;
          min-width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3px;
        }
        
        .ramci-search-form {
          position: relative;
          display: flex;
          align-items: center;
          margin: 0 16px 12px;
          background: #f7f5f2;
          border-radius: 10px;
          padding: 10px 14px;
          gap: 10px;
        }
        .ramci-search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          color: #333;
          outline: none;
        }
        .ramci-search-input::placeholder { color: #aaa; }
        
        .filter-btn-wrapper {
          position: relative;
          display: inline-flex;
        }
        
        .ramci-filter-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
          opacity: .7;
          transition: opacity 0.2s;
        }
        .ramci-filter-btn:hover {
          opacity: 1;
        }
        
        .filter-active-dot {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 8px;
          height: 8px;
          background-color: #e53935;
          border-radius: 50%;
          border: 1px solid white;
          box-shadow: 0 0 2px rgba(0,0,0,0.1);
        }
        
        .search-suggestions {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 6px 24px rgba(0,0,0,.10);
          border: 1px solid #f0ede8;
          z-index: 300;
          overflow: hidden;
        }
        .suggestion-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid #faf8f5;
          transition: background .15s;
        }
        .suggestion-item:last-child { border-bottom: none; }
        .suggestion-item:hover { background: #faf8f5; }
        .suggestion-text {
          flex: 1;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 400;
          color: #222;
        }
        .suggestion-empty {
          padding: 16px;
          text-align: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          color: #bbb;
        }
        .suggestion-footer {
          padding: 8px 14px;
          background: #faf8f5;
          border-top: 1px solid #f0ede8;
        }
        .suggestion-see-all {
          width: 100%;
          text-align: center;
          background: none;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          color: #555;
          cursor: pointer;
          padding: 6px;
          transition: color .15s;
        }
        .suggestion-see-all:hover { color: #111; }

        /* Filtres modal */
        .filters-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 1001;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .filters-modal-content {
          background: white;
          border-radius: 20px;
          width: 90%;
          max-width: 400px;
          overflow: hidden;
          animation: fadeInUp 0.3s ease;
        }

        .filters-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
        }

        .filters-header h3 {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .filters-header button {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #999;
        }

        .filters-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-group label {
          font-size: 13px;
          font-weight: 500;
          color: #666;
        }

        .filter-group select,
        .filter-group input {
          padding: 10px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
        }

        .filter-group select:focus,
        .filter-group input:focus {
          border-color: #e53935;
        }

        .filters-footer {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #eee;
        }

        .reset-btn {
          flex: 1;
          padding: 10px;
          background: #f5f5f5;
          border: none;
          border-radius: 40px;
          font-weight: 500;
          cursor: pointer;
        }

        .apply-btn {
          flex: 1;
          padding: 10px;
          background: #111;
          color: white;
          border: none;
          border-radius: 40px;
          font-weight: 500;
          cursor: pointer;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .install-pwa-btn span {
            display: none;
          }
          .install-pwa-btn {
            padding: 8px 10px;
          }
          .ramci-nav-actions {
            gap: 4px;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;