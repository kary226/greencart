import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const Navbar = () => {
  const { cartItems, wishlist, user, searchQuery, setSearchQuery, axios, products } = useAppContext();
  const [query, setQuery] = useState(searchQuery || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [categories, setCategories] = useState([]);
  const suggestionsRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const cartCount = cartItems ? Object.values(cartItems).reduce((a, b) => a + b, 0) : 0;

  // Charger les catégories
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

  // Recherche locale avec pertinence
  const getLocalSuggestions = (searchTerm) => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase().trim();
    const termWords = term.split(' ');
    
    // Calcul du score de pertinence pour un produit
    const getProductRelevance = (product) => {
      let score = 0;
      const productName = product.name?.toLowerCase() || '';
      
      // Correspondance exacte (score le plus haut)
      if (productName === term) score += 100;
      // Commence par le terme recherché
      else if (productName.startsWith(term)) score += 80;
      // Contient le terme exact
      else if (productName.includes(term)) score += 50;
      
      // Correspondance par mots
      termWords.forEach(word => {
        if (productName.includes(word)) score += 10;
      });
      
      return score;
    };
    
    // Filtrer et noter les produits
    const productMatches = products
      .filter(p => {
        const productName = p.name?.toLowerCase() || '';
        return productName.includes(term);
      })
      .map(p => ({
        ...p,
        relevance: getProductRelevance(p)
      }))
      .sort((a, b) => b.relevance - a.relevance) // Tri par pertinence
      .slice(0, 8); // Limiter à 8 produits
    
    // Suggestions de produits (sans doublons de noms)
    const uniqueProductNames = new Set();
    const productSuggestions = productMatches.filter(p => {
      if (!uniqueProductNames.has(p.name)) {
        uniqueProductNames.add(p.name);
        return true;
      }
      return false;
    }).map(p => ({
      text: p.name,
      relevance: p.relevance,
      price: p.offerPrice || p.price
    }));
    
    // Suggestions de catégories
    const categoryMatches = categories
      .filter(c => {
        const catName = c.name?.toLowerCase() || '';
        return catName.includes(term);
      })
      .map(c => ({
        text: c.name,
        relevance: 60
      }));
    
    // Combiner et trier par pertinence
    const allSuggestions = [...productSuggestions, ...categoryMatches]
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);
    
    return allSuggestions;
  };

  // Recherche API pour plus de suggestions
  const fetchApiSuggestions = async (searchTerm) => {
    if (!searchTerm.trim()) return;
    
    try {
      setLoadingSuggestions(true);
      const { data } = await axios.get(`/api/product/search-suggestions?q=${encodeURIComponent(searchTerm)}`);
      if (data.success && data.suggestions) {
        const apiSuggestions = data.suggestions.map(s => ({
          text: s.text,
          relevance: s.relevance || 50,
          price: s.price
        }));
        setSuggestions(prev => {
          const local = getLocalSuggestions(searchTerm);
          const combined = [...local, ...apiSuggestions];
          // Déduplication par texte
          const uniqueTexts = new Set();
          const deduped = combined.filter(s => {
            if (!uniqueTexts.has(s.text)) {
              uniqueTexts.add(s.text);
              return true;
            }
            return false;
          });
          return deduped.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
        });
      } else {
        setSuggestions(getLocalSuggestions(searchTerm));
      }
    } catch (error) {
      console.error("Erreur suggestions:", error);
      setSuggestions(getLocalSuggestions(searchTerm));
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Mettre à jour les suggestions quand la recherche change
  useEffect(() => {
    if (query.trim()) {
      setShowSuggestions(true);
      const timeoutId = setTimeout(() => {
        fetchApiSuggestions(query);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query]);

  // Fermer les suggestions en cliquant ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      setSearchQuery && setSearchQuery(query.trim());
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (text) => {
    setQuery(text);
    setShowSuggestions(false);
    setSearchQuery && setSearchQuery(text);
    navigate(`/products?search=${encodeURIComponent(text)}`);
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

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div className="search-suggestions">
              {loadingSuggestions && suggestions.length === 0 ? (
                <div className="suggestion-loading">Recherche en cours...</div>
              ) : suggestions.length > 0 ? (
                <>
                  {suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion.text)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <div className="suggestion-content">
                        <span className="suggestion-text">{suggestion.text}</span>
                        {suggestion.price && (
                          <span className="suggestion-price">
                            {Number(suggestion.price).toLocaleString("fr-FR")} FCFA
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="suggestion-footer">
                    <button onClick={handleSearch} className="suggestion-see-all">
                      Voir tous les résultats pour "{query}"
                    </button>
                  </div>
                </>
              ) : query.trim() && (
                <div className="suggestion-empty">
                  Aucun résultat pour "{query}"
                </div>
              )}
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

        /* SUGGESTIONS DROPDOWN */
        .search-suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          margin-top: 8px;
          z-index: 300;
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #eee;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid #f5f5f5;
        }
        .suggestion-item:hover {
          background: #f7f5f2;
        }
        .suggestion-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .suggestion-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }
        .suggestion-price {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #111;
        }
        .suggestion-loading, .suggestion-empty {
          padding: 16px;
          text-align: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          color: #999;
        }
        .suggestion-footer {
          padding: 10px 16px;
          background: #faf8f5;
          border-top: 1px solid #eee;
        }
        .suggestion-see-all {
          width: 100%;
          text-align: center;
          background: none;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #111;
          cursor: pointer;
          padding: 8px;
          transition: opacity 0.2s;
        }
        .suggestion-see-all:hover {
          opacity: 0.7;
        }
      `}</style>
    </>
  );
};

export default Navbar;