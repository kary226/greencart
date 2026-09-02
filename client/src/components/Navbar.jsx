// Habillage RAMSES de la navigation (voir DESIGN.md a la racine).
import "../styles/navbar.css";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { buildSearchIndex, searchProductsAndCategories } from "../utils/searchEngine";
import { Search, ShoppingCart, Heart, ArrowLeft, X } from "lucide-react";
import { ouvrirChat } from '../utils/tawk';

const Navbar = () => {
  const { cartItems, wishlist, user, searchQuery, setSearchQuery, axios, products, logoutUser, setShowUserLogin, canInstallPWA, isPWAInstalled, installPWA, subscribeToPushNotifications, colisSheinActif } = useAppContext();
  const [query, setQuery] = useState(searchQuery || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categories, setCategories] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const suggestionsRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const cartCount = cartItems ? Object.values(cartItems).reduce((a, b) => a + b, 0) : 0;
  const wishlistCount = wishlist?.length || 0;

  // [FIX] Avant, ces deux valeurs étaient calculées une seule fois au montage
  // (useState(...) avec valeur initiale figée). Résultat : si la permission
  // changeait ailleurs (ex: popup d'accueil qui accorde/refuse la notif, ou
  // paramètres du navigateur modifiés dans un autre onglet), la Navbar ne le
  // savait jamais et le bouton "Activer les notifications" pouvait rester
  // affiché à tort, ou à l'inverse ne réapparaître qu'après un F5 complet —
  // ce qui donnait l'impression qu'il "disparaissait" au hasard.
  // On lit maintenant Notification.permission à chaque ouverture du menu et
  // on écoute les changements via l'API Permissions quand le navigateur la
  // supporte, pour rester toujours synchronisé avec l'état réel.
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  const notificationsGranted = notifPermission === "granted";
  // Une fois la permission refusée au niveau du navigateur, on ne peut plus
  // jamais redemander (le navigateur renvoie 'denied' à chaque tentative,
  // sans repasser par une vraie popup native).
  const notificationsBlocked = notifPermission === "denied";

  useEffect(() => {
    if (typeof Notification === "undefined") return;

    // Se resynchronise à chaque ouverture du menu (couvre le cas où la
    // permission a changé pendant que le menu était fermé).
    setNotifPermission(Notification.permission);

    if (!menuOpen) return;
    if (!navigator.permissions?.query) return;

    let permissionStatus;
    const onChange = () => setNotifPermission(Notification.permission);

    navigator.permissions.query({ name: "notifications" }).then((status) => {
      permissionStatus = status;
      setNotifPermission(Notification.permission);
      status.addEventListener("change", onChange);
    }).catch(() => {});

    return () => permissionStatus?.removeEventListener("change", onChange);
  }, [menuOpen]);

  const handleEnableNotifications = async () => {
    const result = await subscribeToPushNotifications();
    setNotifPermission(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
    if (result?.success) setMenuOpen(false);
  };

  const [filters, setFilters] = useState({
    category: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'relevance'
  });

  const hasActiveFilters = () => {
    return filters.category !== '' || filters.minPrice !== '' || filters.maxPrice !== '' || filters.sortBy !== 'relevance';
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilters({
      category: params.get('categories') || '',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      sortBy: params.get('sort') || 'relevance'
    });
  }, [location.search]);

  const handleInstallClick = async () => {
    // Si le navigateur nous a donné le prompt natif (Android/Chrome/Edge),
    // on l'affiche directement — un seul clic, pas de guide nécessaire.
    if (canInstallPWA) {
      const outcome = await installPWA();
      if (outcome === 'dismissed') {
        // L'utilisateur a fermé la popup native : pas besoin de rediriger,
        // il pourra retenter plus tard depuis le même bouton.
      }
      return;
    }
    // Sinon (iOS/Safari, ou prompt pas encore disponible) : guide manuel.
    navigate('/install');
  };

  const openSearchModal = () => {
    setShowSearchModal(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const closeSearchModal = () => {
    setShowSearchModal(false);
    setShowSuggestions(false);
    setQuery("");
  };

  // Le drawer se ferme via l'overlay, le bouton X ou un clic sur un item —
  // pas besoin d'un handler "clic extérieur" générique ici.

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get('/api/category/list');
        if (data.success) setCategories(data.categories);
      } catch { /* pas de menu catégories si l'appel échoue */ }
    };
    fetchCategories();
  }, []);

  // Index construit une seule fois par changement de catalogue, réutilisé
  // à chaque frappe pour rester réactif.
  const searchIndex = useMemo(() => buildSearchIndex(products), [products]);

  const computeSuggestions = (searchTerm) => {
    if (!searchTerm.trim()) return [];
    return searchProductsAndCategories(searchIndex, categories, searchTerm, { limit: 10 });
  };

  useEffect(() => {
    if (query.trim() && showSearchModal) {
      setShowSuggestions(true);
      const id = setTimeout(() => setSuggestions(computeSuggestions(query)), 200);
      return () => clearTimeout(id);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, products, categories, showSearchModal]);

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
      closeSearchModal();
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (s) => {
    setShowSuggestions(false);
    closeSearchModal();
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

  const handleLoginClick = () => {
    setMenuOpen(false);
    setShowUserLogin && setShowUserLogin(true);
  };

  // Voir utils/tawk.js — chargement à la demande et identification du client.
  const handleHelp = () => {
    setMenuOpen(false);
    ouvrirChat(user);
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
          <div className="ramci-menu-container" ref={menuRef}>
            <button 
              className="ramci-menu-btn" 
              aria-label="Menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span /><span /><span />
            </button>
            
          </div>

          <Link to="/" className="ramci-logo">RAMCI</Link>

          <div className="ramci-nav-actions">
            <Link to="/wishlist" className="ramci-nav-icon" aria-label={`Mes favoris${wishlistCount > 0 ? `, ${wishlistCount} article${wishlistCount > 1 ? 's' : ''}` : ''}`}>
              <Heart size={21} strokeWidth={1.8} />
              {wishlistCount > 0 && (
                <span className="ramci-badge" aria-hidden="true">{wishlistCount > 9 ? '9+' : wishlistCount}</span>
              )}
            </Link>

            <Link to="/cart" className="ramci-nav-icon ramci-cart-icon" aria-label={`Panier${cartCount > 0 ? `, ${cartCount} article${cartCount > 1 ? 's' : ''}` : ''}`}>
              <ShoppingCart size={21} strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="ramci-badge" aria-hidden="true">{cartCount > 9 ? '9+' : cartCount}</span>
              )}
            </Link>
          </div>
        </div>

        {/* Barre de recherche visible.
            Auparavant la recherche était une icône parmi trois, qui ouvrait une
            modale : sur un site marchand, c'est ce qui étouffe le plus son usage,
            alors que les visiteurs qui cherchent convertissent nettement mieux
            que ceux qui parcourent. Le champ devient donc une pilule visible,
            qui ouvre exactement la même modale — aucune logique n'a changé. */}
        <div className="ramci-searchbar">
          <button type="button" className="ramci-search-pill" onClick={openSearchModal}>
            <Search size={17} strokeWidth={2} />
            <span>Rechercher un article, une marque…</span>
          </button>
        </div>
      </header>

      {/* Overlay + Drawer plein écran (menu latéral) */}
      <div className={`ramci-drawer-overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />

      <aside className={`ramci-drawer ${menuOpen ? "open" : ""}`}>
        <div className="ramci-drawer-header">
          <Link to="/" className="ramci-drawer-logo" onClick={() => setMenuOpen(false)}>RAMCI</Link>
          <button className="ramci-drawer-close" aria-label="Fermer" onClick={() => setMenuOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <button
          className="ramci-drawer-profile"
          onClick={() => { if (!user) handleLoginClick(); else { setMenuOpen(false); navigate('/account'); } }}
        >
          <span className="ramci-drawer-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <span className="ramci-drawer-profile-text">
            <span className="ramci-drawer-profile-name">{user ? user.name : "Visiteur"}</span>
            <span className="ramci-drawer-profile-sub">{user ? user.email : "Non connecté"}</span>
          </span>
        </button>

        <nav className="ramci-drawer-nav">
          <Link to="/" className="drawer-item" onClick={() => setMenuOpen(false)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
            Accueil
          </Link>
          <Link to="/products" className="drawer-item" onClick={() => setMenuOpen(false)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            Produits
          </Link>
          <Link to="/categories" className="drawer-item" onClick={() => setMenuOpen(false)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Catégories
          </Link>
          <Link to="/my-orders" className="drawer-item" onClick={() => setMenuOpen(false)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
            Mes commandes
          </Link>
          {colisSheinActif && (
            <Link to="/valider-panier-shein" className="drawer-item" onClick={() => setMenuOpen(false)}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 12l2 2 4-4"/>
                <circle cx="12" cy="12" r="10"/>
              </svg>
              Valider le panier SHEIN
            </Link>
          )}
          <Link to="/account" className="drawer-item" onClick={() => setMenuOpen(false)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Mon compte
          </Link>

          <div className="drawer-divider"></div>

          {/* [FIX] Bouton caché uniquement si déjà accordé (rien à faire).
              Si la permission est "denied", on ne cache plus silencieusement
              le bouton (ça donnait l'impression qu'il "disparaissait" sans
              raison) : on affiche à la place une ligne explicative, car dans
              ce cas cliquer ne redéclencherait qu'un refus automatique côté
              navigateur — seuls les réglages du navigateur permettent de
              revenir en arrière. */}
          {user && typeof Notification !== "undefined" && !notificationsGranted && !notificationsBlocked && (
            <button className="drawer-item" onClick={handleEnableNotifications}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              Activer les notifications
            </button>
          )}

          {user && notificationsBlocked && (
            <div className="drawer-item drawer-item-disabled" title="Réactivez les notifications depuis les réglages du navigateur pour ce site">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
                <line x1="3" y1="3" x2="21" y2="21" />
              </svg>
              Notifications bloquées (réglages navigateur)
            </div>
          )}

          <button className="drawer-item" onClick={handleHelp}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Service client
          </button>
        </nav>

        <div className="ramci-drawer-footer">
          {!isPWAInstalled && (
            <button className="drawer-install-btn" onClick={() => { setMenuOpen(false); handleInstallClick(); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 16l-4-4h3V4h2v8h3z"/>
                <path d="M4 20h16v-2H4z"/>
              </svg>
              Installer l'application
            </button>
          )}

          {user ? (
            <button className="drawer-logout-btn" onClick={handleLogout}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Déconnexion
            </button>
          ) : (
            <button className="drawer-login-btn" onClick={handleLoginClick}>
              Se connecter
            </button>
          )}
        </div>
      </aside>

      {/* Modal de recherche avec bouton filtre */}
      {showSearchModal && (
        <div className="search-modal-overlay" onClick={closeSearchModal}>
          <div className="search-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Le bandeau affichait une flèche retour, le wordmark « RAMCI » et
                un espaceur vide : on ouvrait la recherche et on tombait sur un
                écran titré du nom du site, qui ressemblait à une page cassée
                plutôt qu'à un panneau de recherche.
                Le champ remonte donc dans le bandeau, à côté de la flèche —
                c'est le motif de la recherche plein écran (Nike, awesome-design-md). */}
            <form className="search-modal-form" onSubmit={handleSearch} ref={suggestionsRef}>
              <div className="search-modal-header">
                <button type="button" className="search-modal-back" onClick={closeSearchModal} aria-label="Fermer la recherche">
                  <ArrowLeft size={20} />
                </button>

                <div className="search-modal-input-wrapper">
                  <Search size={17} strokeWidth={2} className="search-modal-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher un article ou une catégorie..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="search-modal-input"
                />
                
                {/* Bouton Filtre */}
                <button 
                  type="button" 
                  onClick={() => {
                    closeSearchModal();
                    setShowFilters(true);
                  }} 
                  className="search-modal-filter-btn"
                  aria-label="Filtres"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                    <line x1="4" y1="6" x2="20" y2="6"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                    <line x1="11" y1="18" x2="13" y2="18"/>
                  </svg>
                  {hasActiveFilters() && <span className="filter-active-dot"></span>}
                </button>

                {query && (
                  /* L'icône d'origine dessinait un « + » dans un cercle, pas une
                     croix : le bouton « effacer » ressemblait à un bouton d'ajout. */
                  <button type="button" className="search-modal-clear" onClick={() => setQuery("")} aria-label="Effacer la recherche">
                    <X size={16} strokeWidth={2.4} />
                  </button>
                )}
                </div>
              </div>

              {showSuggestions && (
                <div className="search-modal-suggestions">
                  {suggestions.length > 0 ? (
                    <>
                      {suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          className="search-suggestion-item"
                          onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s); }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                          </svg>
                          <span className="search-suggestion-text">{s.text}</span>
                        </div>
                      ))}
                      <div className="search-suggestion-footer">
                        <button
                          type="submit"
                          className="search-suggestion-see-all"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          Voir tous les résultats pour «{query}»
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="search-suggestion-empty">Aucun résultat pour «{query}»</div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

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

    </>
  );
};

export default Navbar;