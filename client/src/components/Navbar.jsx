import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const Navbar = () => {
  const { cartItems, wishlist, user, searchQuery, setSearchQuery, axios } = useAppContext();
  const [query, setQuery] = useState(searchQuery || "");
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const navigate = useNavigate();

  const cartCount = cartItems ? Object.values(cartItems).reduce((a, b) => a + b, 0) : 0;
  const wishCount = wishlist ? wishlist.length : 0;

  // Récupérer les catégories depuis l'API
  const fetchCategories = async () => {
    try {
      const { data } = await axios.get('/api/category/list');
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Erreur chargement catégories:", error);
    } finally {
      setLoadingCats(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchQuery && setSearchQuery(query.trim());
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  // Ne prendre que les catégories actives
  const activeCategories = categories.filter(cat => cat.active !== false);

  return (
    <header className="navbar-root">
      {/* Top strip */}
      <div className="navbar-top">
        <Link to="/" className="navbar-logo">
          <span className="logo-text">RAMCI</span>
        </Link>

        <form className="navbar-search" onSubmit={handleSearch}>
          <button type="button" className="search-icon-btn cam-btn" aria-label="Recherche photo">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <input
            type="text"
            placeholder="Rechercher des produits..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-icon-btn" aria-label="Chercher">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        </form>

        <div className="navbar-actions">
          {/* Panier */}
          <Link to="/cart" className="nav-action-btn" aria-label="Panier">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-7-6h7l2-6H7l2 6z"/>
              <circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>
            </svg>
            {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </Link>

          {/* Wishlist */}
          <Link to="/wishlist" className="nav-action-btn" aria-label="Wishlist">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {wishCount > 0 && <span className="badge">{wishCount}</span>}
          </Link>

          {/* Compte */}
          <Link to="/account" className="nav-action-btn" aria-label="Compte">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </div>

      {/* Category quick nav - DYNAMIQUE depuis l'admin */}
      <nav className="navbar-cats">
        {loadingCats ? (
          // Skeleton loading
          <div className="cats-skeleton">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-cat-tab"></div>
            ))}
          </div>
        ) : (
          <>
            <Link to="/products" className="cat-tab">Tout</Link>
            {activeCategories.slice(0, 6).map((cat) => (
              <Link
                key={cat._id}
                to={`/products?categories=${cat.slug || cat.name}`}
                className="cat-tab"
              >
                {cat.name}
              </Link>
            ))}
            {activeCategories.length > 6 && (
              <Link to="/categories" className="cat-tab cat-more">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </Link>
            )}
          </>
        )}
      </nav>

      <style>{`
        .navbar-root {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #fff;
          box-shadow: 0 1px 0 #e5e5e5;
        }
        .navbar-top {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px 8px;
        }
        .navbar-logo { text-decoration: none; flex-shrink: 0; }
        .logo-text {
          font-family: 'Georgia', serif;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #111;
        }
        .navbar-search {
          flex: 1;
          display: flex;
          align-items: center;
          background: #f5f5f5;
          border-radius: 4px;
          padding: 0 10px;
          height: 38px;
          gap: 6px;
        }
        .search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 13px;
          color: #111;
          outline: none;
        }
        .search-input::placeholder { color: #999; }
        .search-icon-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #666;
          display: flex;
          align-items: center;
        }
        .cam-btn { color: #999; }
        .navbar-actions { display: flex; gap: 4px; flex-shrink: 0; }
        .nav-action-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          color: #111;
          text-decoration: none;
        }
        .badge {
          position: absolute;
          top: 2px; right: 2px;
          background: #e53935;
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3px;
        }
        .navbar-cats {
          display: flex;
          align-items: center;
          overflow-x: auto;
          padding: 0 12px 8px;
          gap: 0;
          scrollbar-width: none;
        }
        .navbar-cats::-webkit-scrollbar { display: none; }
        .cat-tab {
          flex-shrink: 0;
          font-size: 13px;
          font-weight: 500;
          color: #555;
          text-decoration: none;
          padding: 4px 12px;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
          transition: color .15s, border-color .15s;
        }
        .cat-tab.active, .cat-tab:hover {
          color: #111;
          border-bottom-color: #111;
          font-weight: 700;
        }
        .cat-more {
          display: flex;
          align-items: center;
          border: none;
          padding: 4px 8px;
        }
        .cats-skeleton {
          display: flex;
          gap: 8px;
          padding: 4px 0;
        }
        .skeleton-cat-tab {
          width: 60px;
          height: 28px;
          background: #e0e0e0;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </header>
  );
};

export default Navbar;