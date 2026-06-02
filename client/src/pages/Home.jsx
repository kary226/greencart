import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";

const TABS = [
  { id: "foryou", label: "Pour vous", icon: "✦" },
  { id: "new", label: "Nouveautés", icon: "✦" },
  { id: "deals", label: "Promos", icon: "⚡" },
  { id: "bestsellers", label: "Meilleures ventes", icon: "🏆" },
];

const Home = () => {
  const { products, categories, banners, currency } = useAppContext();
  const [activeTab, setActiveTab] = useState("foryou");
  const [bannerIdx, setBannerIdx] = useState(0);
  const navigate = useNavigate();
  const bannerTimer = useRef(null);

  // Auto-rotate banner
  useEffect(() => {
    if (!banners?.length) return;
    bannerTimer.current = setInterval(() => {
      setBannerIdx((i) => (i + 1) % banners.length);
    }, 4000);
    return () => clearInterval(bannerTimer.current);
  }, [banners]);

  const activeCategories = categories?.filter((c) => c.active !== false) || [];
  const allProducts = products || [];

  const getTabProducts = () => {
    switch (activeTab) {
      case "new":
        return [...allProducts].reverse().slice(0, 20);
      case "deals":
        return allProducts.filter((p) => p.offerPrice && p.offerPrice < p.price).slice(0, 20);
      case "bestsellers":
        return [...allProducts].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 20);
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
        <section className="home-banner">
          {banners?.length > 0 ? (
            <>
              <div
                className="banner-slides"
                style={{ transform: `translateX(-${bannerIdx * 100}%)` }}
              >
                {banners.map((b, i) => (
                  <div key={i} className="banner-slide">
                    <img src={b.image} alt={b.title || "Bannière"} className="banner-bg" />
                    <div className="banner-overlay">
                      {b.title && <p className="banner-tag">{b.tag || "#Ramci"}</p>}
                      {b.title && <h2 className="banner-headline">{b.title}</h2>}
                      {b.link && (
                        <Link to={b.link} className="banner-cta">Acheter maintenant</Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {banners.length > 1 && (
                <div className="banner-dots">
                  {banners.map((_, i) => (
                    <button
                      key={i}
                      className={`banner-dot${i === bannerIdx ? " active" : ""}`}
                      onClick={() => setBannerIdx(i)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="banner-placeholder">
              <div className="banner-placeholder-content">
                <p className="banner-tag">#Ramci</p>
                <h2 className="banner-headline">ÉCONOMISEZ GROS<br />SUR LES MEILLEURES<br />VENTES</h2>
                <Link to="/products" className="banner-cta">Acheter maintenant</Link>
              </div>
            </div>
          )}
        </section>

        {/* ── PROMO STRIP ── */}
        <section className="promo-strip">
          <Link to="/products" className="promo-item">
            <span className="promo-icon">🚚</span>
            <div>
              <p className="promo-title">Livraison gratuite</p>
              <p className="promo-sub">Dès 5 000 DA d'achat</p>
            </div>
          </Link>
          <div className="promo-divider" />
          <Link to="/products?tab=deals" className="promo-item">
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
                  to={`/products?category=${cat._id}`}
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
          <Link to="/" className="login-bar-btn">Connexion</Link>
        </div>
      </div>

      <style>{`
        .home {
          background: #f5f5f5;
          min-height: 100vh;
          padding-bottom: 80px;
        }

        /* ── BANNER ── */
        .home-banner {
          position: relative;
          overflow: hidden;
          height: 220px;
          background: #1a1a2e;
        }
        .banner-slides {
          display: flex;
          height: 100%;
          transition: transform .5s cubic-bezier(.4,0,.2,1);
        }
        .banner-slide {
          min-width: 100%;
          position: relative;
        }
        .banner-bg {
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: .7;
        }
        .banner-overlay {
          position: absolute;
          inset: 0;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
        }
        .banner-placeholder {
          height: 100%;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          display: flex;
          align-items: center;
          padding: 20px 16px;
        }
        .banner-placeholder-content { display: flex; flex-direction: column; gap: 8px; }
        .banner-tag {
          font-size: 11px;
          color: rgba(255,255,255,.7);
          font-weight: 600;
          letter-spacing: 1px;
          margin: 0;
        }
        .banner-headline {
          font-size: 20px;
          font-weight: 900;
          color: #fff;
          line-height: 1.2;
          margin: 0;
          font-family: 'Georgia', serif;
          text-transform: uppercase;
        }
        .banner-cta {
          display: inline-block;
          background: #fff;
          color: #111;
          font-size: 11px;
          font-weight: 700;
          padding: 7px 16px;
          border-radius: 1px;
          text-decoration: none;
          letter-spacing: .8px;
          width: fit-content;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .banner-dots {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 5px;
        }
        .banner-dot {
          width: 6px; height: 6px;
          border-radius: 3px;
          border: none;
          background: rgba(255,255,255,.4);
          padding: 0;
          cursor: pointer;
          transition: all .3s;
        }
        .banner-dot.active {
          background: #fff;
          width: 18px;
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