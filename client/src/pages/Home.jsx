import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import BannerCarousel from "../components/BannerCarousel";

const TABS = [
  { id: "foryou", label: "Pour vous", icon: "✦" },
  { id: "new", label: "Nouveautés", icon: "✦" },
  { id: "deals", label: "Promos", icon: "⚡" },
  { id: "bestsellers", label: "Meilleures ventes", icon: "🏆" },
];

const Home = () => {
  const { products, wishlist, currency, isInWishlist, addToWishlist, axios } = useAppContext();
  const [activeTab, setActiveTab] = useState("foryou");
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const navigate = useNavigate();

  // Récupérer les catégories
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

  // Récupérer les bannières
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const { data } = await axios.get('/api/banner/list');
        if (data.success) setBanners(data.banners);
      } catch (error) {
        console.error("Erreur chargement bannières:", error);
      }
    };
    fetchBanners();
  }, []);

  const activeCategories = categories?.filter((c) => c.active !== false) || [];
  const allProducts = products || [];

  const getTabProducts = () => {
    switch (activeTab) {
      case "new":
        return [...allProducts].reverse().slice(0, 20);
      case "deals":
        return allProducts.filter((p) => p.offerPrice && p.offerPrice < p.price).slice(0, 20);
      case "bestsellers":
        return [...allProducts].slice(0, 20);
      default:
        return allProducts.slice(0, 20);
    }
  };

  const tabProducts = getTabProducts();

  return (
    <>
      <SEO title="Ramci – Mode & Tendances" description="Découvrez les meilleures offres sur Ramci." />

      <div className="home">
        {/* ── BANNER ── */}
        <BannerCarousel position="top" />

        {/* ── PROMO STRIP ── */}
        <section className="promo-strip">
          <Link to="/products" className="promo-item">
            <span className="promo-icon">🚚</span>
            <div>
              <p className="promo-title">Livraison gratuite</p>
              <p className="promo-sub">Dès 5 000 FCFA d'achat</p>
            </div>
          </Link>
          <div className="promo-divider" />
          <Link to="/products?sort=deals" className="promo-item">
            <span className="promo-icon">⚡</span>
            <div>
              <p className="promo-title">Ventes Flash</p>
              <p className="promo-sub">Voir plus</p>
            </div>
          </Link>
        </section>

        {/* ── CATEGORIES ── */}
        {activeCategories.length > 0 && (
          <section className="home-cats">
            <div className="cats-scroll">
              {activeCategories.map((cat) => (
                <Link
                  key={cat._id}
                  to={`/products?categories=${cat.slug || cat.name}`}
                  className="cat-item"
                >
                  <div className="cat-circle">
                    {cat.image ? (
                      <img src={cat.image} alt={cat.name} className="cat-img" />
                    ) : (
                      <div className="cat-placeholder">
                        <span>{cat.name?.[0]}</span>
                      </div>
                    )}
                  </div>
                  <span className="cat-name">{cat.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── PRODUCT TABS ── */}
        <section className="home-tabs-section">
          <div className="home-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`home-tab${activeTab === tab.id ? " active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          {tabProducts.length > 0 ? (
            <div className="products-grid">
              {tabProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>Aucun produit disponible</p>
            </div>
          )}

          {allProducts.length > 20 && (
            <div className="see-more-wrap">
              <Link to="/products" className="see-more-btn">Voir tout</Link>
            </div>
          )}
        </section>

        {/* ── LOGIN BANNER (if not logged in) ── */}
        <div className="login-bar">
          <span>Connectez-vous et profitez-en davantage</span>
          <Link to="/" className="login-bar-btn" onClick={() => window.dispatchEvent(new CustomEvent('openLogin'))}>
            Connexion
          </Link>
        </div>
      </div>

      <style>{`
        .home {
          background: #f5f5f5;
          min-height: 100vh;
          padding-bottom: 80px;
        }

        /* ── PROMO STRIP ── */
        .promo-strip {
          display: flex;
          align-items: center;
          background: #fff8f0;
          border-bottom: 1px solid #ffe0b2;
          margin-bottom: 8px;
        }
        .promo-item {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          text-decoration: none;
        }
        .promo-icon { font-size: 20px; }
        .promo-title {
          font-size: 12px;
          font-weight: 700;
          color: #111;
          margin: 0;
        }
        .promo-sub {
          font-size: 10px;
          color: #888;
          margin: 0;
        }
        .promo-divider {
          width: 1px;
          height: 30px;
          background: #ffe0b2;
        }

        /* ── CATEGORIES ── */
        .home-cats {
          background: #fff;
          padding: 12px 0 8px;
          margin-bottom: 8px;
        }
        .cats-scroll {
          display: flex;
          overflow-x: auto;
          padding: 0 8px;
          gap: 4px;
          scrollbar-width: none;
        }
        .cats-scroll::-webkit-scrollbar { display: none; }
        .cat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          min-width: 64px;
          text-decoration: none;
          padding: 4px;
        }
        .cat-circle {
          width: 56px; height: 56px;
          border-radius: 50%;
          overflow: hidden;
          border: 1.5px solid #e8e8e8;
          background: #f5f5f5;
        }
        .cat-img {
          width: 100%; height: 100%;
          object-fit: cover;
        }
        .cat-placeholder {
          width: 100%; height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eee;
          font-size: 20px;
          font-weight: 700;
          color: #888;
        }
        .cat-name {
          font-size: 10px;
          color: #333;
          text-align: center;
          line-height: 1.2;
          max-width: 64px;
        }

        /* ── TABS ── */
        .home-tabs-section { background: #fff; }
        .home-tabs {
          display: flex;
          overflow-x: auto;
          scrollbar-width: none;
          border-bottom: 1px solid #eee;
          padding: 0 8px;
          gap: 0;
        }
        .home-tabs::-webkit-scrollbar { display: none; }
        .home-tab {
          flex-shrink: 0;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 12px 14px;
          font-size: 12px;
          font-weight: 500;
          color: #888;
          cursor: pointer;
          white-space: nowrap;
          transition: all .15s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .home-tab.active {
          color: #111;
          border-bottom-color: #111;
          font-weight: 700;
        }
        .tab-icon { font-size: 11px; }

        /* ── PRODUCT GRID ── */
        .products-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          background: #e8e8e8;
          padding: 2px;
        }
        .empty-state {
          padding: 40px;
          text-align: center;
          color: #aaa;
          font-size: 14px;
        }
        .see-more-wrap {
          display: flex;
          justify-content: center;
          padding: 16px;
          background: #fff;
        }
        .see-more-btn {
          display: block;
          border: 1.5px solid #111;
          color: #111;
          font-size: 13px;
          font-weight: 700;
          padding: 10px 40px;
          text-decoration: none;
          letter-spacing: .5px;
          transition: all .15s;
        }
        .see-more-btn:hover {
          background: #111;
          color: #fff;
        }

        /* ── LOGIN BAR ── */
        .login-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0,0,0,.85);
          color: #fff;
          padding: 12px 16px;
          font-size: 12px;
          gap: 12px;
        }
        .login-bar-btn {
          flex-shrink: 0;
          background: #fff;
          color: #111;
          font-size: 12px;
          font-weight: 700;
          padding: 7px 20px;
          border-radius: 2px;
          text-decoration: none;
          letter-spacing: .3px;
        }
      `}</style>
    </>
  );
};

export default Home;