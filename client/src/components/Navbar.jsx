import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const Navbar = () => {
  const { cartItems, wishlist, user, searchQuery, setSearchQuery, axios, products } = useAppContext();
  const [query, setQuery] = useState(searchQuery || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categories, setCategories] = useState([]);
  const suggestionsRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const cartCount = cartItems ? Object.values(cartItems).reduce((a, b) => a + b, 0) : 0;

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get('/api/category/list');
        if (data.success) setCategories(data.categories);
      } catch (error) {
        console.error("Erreur chargement catégories:", error);
      }
    };
    fetchCategories();
  }, []);

  // Décompose la query en mots et cherche les produits/catégories correspondants
  const computeSuggestions = (searchTerm) => {
    if (!searchTerm.trim()) return [];

    const term = searchTerm.toLowerCase().trim();
    const words = term.split(/\s+/).filter(Boolean);

    // Score produit : exact > commence par > contient terme entier > contient au moins 1 mot
    const scoreProduct = (product) => {
      const name = product.name?.toLowerCase() || '';
      if (name === term) return 100;
      if (name.startsWith(term)) return 80;
      if (name.includes(term)) return 60;
      // Au moins 1 mot en commun
      const matched = words.filter(w => name.includes(w));
      if (matched.length > 0) return 20 + matched.length * 10;
      return 0;
    };

    // Produits
    const productSuggestions = products
      .map(p => ({ ...p, _score: scoreProduct(p) }))
      .filter(p => p._score > 0)
      .sort((a, b) => b._score - a._score)
      .reduce((acc, p) => {
        if (!acc.names.has(p.name)) {
          acc.names.add(p.name);
          acc.list.push({ type: 'product', text: p.name, score: p._score });
        }
        return acc;
      }, { names: new Set(), list: [] })
      .list
      .slice(0, 7);

    // Catégories
    const categorySuggestions = categories
      .filter(c => {
        const name = c.name?.toLowerCase() || '';
        return name.includes(term) || words.some(w => name.includes(w));
      })
      .map(c => ({
        type: 'category',
        text: c.name,
        slug: c.slug || c.name,
        score: c.name.toLowerCase().includes(term) ? 70 : 30,
      }))
      .slice(0, 3);

    // Fusionner : le produit exact en premier, puis les autres
    const exactProduct = productSuggestions.find(s => s.score >= 80);
    const otherProducts = productSuggestions.filter(s => s !== exactProduct);

    const merged = [
      ...(exactProduct ? [exactProduct] : []),
      ...categorySuggestions,
      ...otherProducts,
    ].slice(0, 10);

    return merged;
  };

  useEffect(() => {
    if (query.trim()) {
      setShowSuggestions(true);
      const id = setTimeout(() => {
        setSuggestions(computeSuggestions(query));
      }, 200);
      return () => clearTimeout(id);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, products, categories]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
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

  const handleSuggestionClick = (suggestion) => {
    setShowSuggestions(false);
    if (suggestion.type === 'category') {
      navigate(`/products?categories=${encodeURIComponent(suggestion.slug)}`);
    } else {
      // Produit → recherche par nom (pas de redirection directe)
      setQuery(suggestion.text);
      setSearchQuery && setSearchQuery(suggestion.text);
      navigate(`/products?search=${encodeURIComponent(suggestion.text)}`);
    }
  };

  return (
    <>
      <header className="ramci-navbar">
        <div className="ramci-nav-top">
          <button className="ramci-menu-btn" aria-label="Menu">
            <span /><span /><span />
          </button>

          <Link to="/" className="ramci-logo">RAMCI</Link>

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
          <button type="button" className="ramci-filter-btn" aria-label="Filtres">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
          </button>

          {showSuggestions && suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className={`suggestion-item${s.type === 'category' ? ' suggestion-category' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // évite le blur avant le click
                    handleSuggestionClick(s);
                  }}
                >
                  {s.type === 'category' ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  )}
                  <span className="suggestion-text">{s.text}</span>
                  {s.type === 'category' && (
                    <span className="suggestion-tag">Catégorie</span>
                  )}
                </div>
              ))}
              <div className="suggestion-footer">
                <button
                  type="submit"
                  className="suggestion-see-all"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Voir tous les résultats pour &laquo;{query}&raquo;
                </button>
              </div>
            </div>
          )}

          {showSuggestions && query.trim() && suggestions.length === 0 && (
            <div className="search-suggestions">
              <div className="suggestion-empty">Aucun résultat pour &laquo;{query}&raquo;</div>
            </div>
          )}
        </form>
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
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }
        .ramci-nav-actions { display: flex; align-items: center; gap: 4px; }
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
          top: 4px; right: 4px;
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
        .ramci-filter-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
          opacity: .7;
        }

        /* DROPDOWN */
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
          padding: 11px 16px;
          cursor: pointer;
          border-bottom: 1px solid #faf8f5;
          transition: background .15s;
        }
        .suggestion-item:last-child { border-bottom: none; }
        .suggestion-item:hover { background: #faf8f5; }
        .suggestion-category { background: #fdf9f4; }
        .suggestion-category:hover { background: #f7f0e8; }
        .suggestion-text {
          flex: 1;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 400;
          color: #222;
        }
        .suggestion-tag {
          font-family: 'DM Sans', sans-serif;
          font-size: 10px;
          font-weight: 600;
          color: #a07850;
          background: #f5ece0;
          padding: 2px 8px;
          border-radius: 20px;
          letter-spacing: .3px;
          text-transform: uppercase;
          flex-shrink: 0;
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
      `}</style>
    </>
  );
};

export default Navbar;