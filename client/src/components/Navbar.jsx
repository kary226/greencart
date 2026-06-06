import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const Navbar = () => {
  const { cartItems, wishlist, user, searchQuery, setSearchQuery, axios } = useAppContext();
  const [query, setQuery] = useState(searchQuery || "");
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const cartCount = cartItems ? Object.values(cartItems).reduce((a, b) => a + b, 0) : 0;
  const wishCount = wishlist ? wishlist.length : 0;

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get('/api/category/list');
        if (data.success) setCategories(data.categories);
      } catch (error) {
        console.error("Erreur chargement catégories:", error);
      } finally {
        setLoadingCats(false);
      }
    };
    fetchCategories();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchQuery && setSearchQuery(query.trim());
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const activeCategories = categories.filter(cat => cat.active !== false);

  return (
    <>
      <header className="ramci-navbar">
        {/* TOP ROW */}
        <div className="ramci-nav-top">
          {/* Hamburger */}
          <button className="ramci-menu-btn" aria-label="Menu">
            <span /><span /><span />
          </button>

          {/* Logo centré */}
          <Link to="/" className="ramci-logo">RAMCI</Link>

          {/* Actions droite */}
          <div className="ramci-nav-actions">
            <Link to="/wishlist" className="ramci-nav-icon" aria-label="Favoris">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </Link>
            <Link to="/cart" className="ramci-nav-icon ramci-cart-icon" aria-label="Panier">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              {cartCount > 0 && <span className="ramci-badge">{cartCount}</span>}
            </Link>
          </div>
        </div>

        {/* SEARCH BAR */}
        <form className="ramci-search-form" onSubmit={handleSearch}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Rechercher un article..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ramci-search-input"
          />
          <button type="button" className="ramci-filter-btn" aria-label="Filtres">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
          </button>
        </form>

        {/* CATEGORIES SCROLL */}
        <nav className="ramci-cats-nav">
          <Link to="/products" className={`ramci-cat-pill ${location.search === '' && location.pathname === '/products' ? 'active' : ''}`}>
            <span className="ramci-cat-icon-all">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <rect x="0" y="0" width="7" height="7" rx="1.5"/><rect x="9" y="0" width="7" height="7" rx="1.5"/>
                <rect x="0" y="9" width="7" height="7" rx="1.5"/><rect x="9" y="9" width="7" height="7" rx="1.5"/>
              </svg>
            </span>
            Tous
          </Link>
          {activeCategories.slice(0, 8).map((cat) => (
            <Link
              key={cat._id}
              to={`/products?categories=${cat.slug || cat.name}`}
              className="ramci-cat-pill"
            >
              {cat.image && (
                <span className="ramci-cat-pill-img">
                  <img src={cat.image} alt={cat.name} />
                </span>
              )}
              {cat.name}
            </Link>
          ))}
        </nav>
      </header>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@400;500;600&display=swap');

        .ramci-navbar {
          position: sticky;
          top: 0;
          z-index: 200;
          background: #fff;
          border-bottom: 1px solid #f0ede8;
        }

        /* TOP ROW */
        .ramci-nav-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
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
          transition: width .2s;
        }
        .ramci-menu-btn span:nth-child(1) { width: 22px; }
        .ramci-menu-btn span:nth-child(2) { width: 16px; }
        .ramci-menu-btn span:nth-child(3) { width: 19px; }

        .ramci-logo {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 26px;
          font-weight: 600;
          letter-spacing: 6px;
          color: #111;
          text-decoration: none;
          text-transform: uppercase;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .ramci-nav-actions {
          display: flex;
          align-items: center;
          gap: 4px;
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
        }
        .ramci-nav-icon:hover { opacity: .6; }

        .ramci-cart-icon { position: relative; }
        .ramci-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          background: #111;
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

        /* SEARCH */
        .ramci-search-form {
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
        .ramci-filter-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
          opacity: .7;
        }

        /* CATEGORIES */
        .ramci-cats-nav {
          display: flex;
          align-items: center;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 0 12px 12px;
          gap: 8px;
        }
        .ramci-cats-nav::-webkit-scrollbar { display: none; }

        .ramci-cat-pill {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 50px;
          border: 1.5px solid #e8e3dc;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #555;
          text-decoration: none;
          background: #fff;
          white-space: nowrap;
          transition: all .2s;
        }
        .ramci-cat-pill:hover,
        .ramci-cat-pill.active {
          background: #111;
          color: #fff;
          border-color: #111;
        }

        .ramci-cat-icon-all {
          display: flex;
          align-items: center;
        }

        .ramci-cat-pill-img {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
        }
        .ramci-cat-pill-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>
    </>
  );
};

export default Navbar;
