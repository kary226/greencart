import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import BannerCarousel from "../components/BannerCarousel";

const SECTIONS = [
  { id: "trends", label: "Tendances du moment" },
  { id: "new",    label: "Nouveautés" },
  { id: "deals",  label: "Promotions" },
];

const Home = () => {
  const { products, currency, axios, orders } = useAppContext();
  const [categories, setCategories] = useState([]);
  const [activeSection, setActiveSection] = useState("trends");
  const [trendProducts, setTrendProducts] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [dealProducts, setDealProducts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get('/api/category/list');
        if (data.success) setCategories(data.categories);
      } catch (e) {}
    };
    fetchCategories();
  }, []);

  // Calculer les produits par popularité (nombre d'achats)
  const getTrendingProducts = () => {
    if (!products.length) return [];
    
    // Compter le nombre de ventes par produit
    const productSales = {};
    
    if (orders && orders.length > 0) {
      orders.forEach(order => {
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            const productId = item.productId || item._id;
            const quantity = item.quantity || 1;
            if (productId) {
              productSales[productId] = (productSales[productId] || 0) + quantity;
            }
          });
        }
      });
    }
    
    // Ajouter un score de popularité à chaque produit
    const productsWithSales = products.map(product => ({
      ...product,
      salesCount: productSales[product._id] || 0
    }));
    
    // Trier par nombre de ventes (du plus vendu au moins vendu)
    productsWithSales.sort((a, b) => b.salesCount - a.salesCount);
    
    return productsWithSales.slice(0, 10);
  };

  // Calculer les nouveaux produits (par date d'ajout)
  const getNewProducts = () => {
    if (!products.length) return [];
    
    // Trier par date de création (du plus récent au plus ancien)
    const sorted = [...products].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });
    
    return sorted.slice(0, 10);
  };

  // Calculer les promotions (par pourcentage de réduction)
  const getDealProducts = () => {
    if (!products.length) return [];
    
    // Filtrer les produits qui ont une offre
    const productsWithOffer = products.filter(p => p.offerPrice && p.offerPrice < p.price);
    
    // Calculer le pourcentage de réduction pour chaque produit
    const productsWithDiscount = productsWithOffer.map(product => ({
      ...product,
      discountPercent: Math.round(((product.price - product.offerPrice) / product.price) * 100)
    }));
    
    // Trier par pourcentage de réduction (du plus élevé au plus bas)
    productsWithDiscount.sort((a, b) => b.discountPercent - a.discountPercent);
    
    return productsWithDiscount.slice(0, 10);
  };

  // Mettre à jour les listes quand les produits ou commandes changent
  useEffect(() => {
    if (products.length > 0) {
      setTrendProducts(getTrendingProducts());
      setNewProducts(getNewProducts());
      setDealProducts(getDealProducts());
    }
  }, [products, orders]);

  const getSectionProducts = () => {
    switch (activeSection) {
      case "new":   return newProducts;
      case "deals": return dealProducts;
      default:      return trendProducts;
    }
  };

  const sectionProducts = getSectionProducts();
  const activeCategories = categories.filter(c => c.active !== false);

  return (
    <>
      <SEO title="Ramci – Mode & Tendances" description="Découvrez les meilleures offres sur Ramci." />

      <div className="ramci-home">

        {/* ── HERO BANNER ── */}
        <section className="ramci-hero">
          <BannerCarousel position="top" />
        </section>

        {/* ── CATEGORIES CERCLES ── */}
        {activeCategories.length > 0 && (
          <section className="ramci-cats-section">
            <Link to="/products" className="ramci-cat-item">
              <div className="ramci-cat-circle ramci-cat-circle-all">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
                  <rect x="0" y="0" width="9" height="9" rx="2"/><rect x="13" y="0" width="9" height="9" rx="2"/>
                  <rect x="0" y="13" width="9" height="9" rx="2"/><rect x="13" y="13" width="9" height="9" rx="2"/>
                </svg>
              </div>
              <span className="ramci-cat-label">Tous</span>
            </Link>

            {activeCategories.map((cat) => (
              <Link
                key={cat._id}
                to={`/products?categories=${cat.slug || cat.name}`}
                className="ramci-cat-item"
              >
                <div className="ramci-cat-circle">
                  {cat.image
                    ? <img src={cat.image} alt={cat.name} className="ramci-cat-img" />
                    : <span className="ramci-cat-placeholder">{cat.name?.[0]}</span>
                  }
                </div>
                <span className="ramci-cat-label">{cat.name}</span>
              </Link>
            ))}
          </section>
        )}

        {/* ── SECTION PRODUITS ── */}
        <section className="ramci-products-section">
          <div className="ramci-section-header">
            <h2 className="ramci-section-title">
              {SECTIONS.find(s => s.id === activeSection)?.label}
            </h2>
            <Link to="/products" className="ramci-voir-tout">
              Voir tout
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          </div>

          <div className="ramci-section-tabs">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`ramci-stab${activeSection === s.id ? " active" : ""}`}
                onClick={() => setActiveSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {sectionProducts.length > 0 ? (
            <>
              <div className="ramci-grid">
                {sectionProducts.map(p => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
              {/* Bouton Voir plus */}
              <div className="ramci-view-more-wrapper">
                <button 
                  onClick={() => navigate('/products')} 
                  className="ramci-view-more-btn"
                >
                  Voir plus
                </button>
              </div>
            </>
          ) : (
            <div className="ramci-empty">Aucun produit disponible</div>
          )}
        </section>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@400;500;600&display=swap');

        .ramci-home {
          background: #faf8f5;
          min-height: 100vh;
          padding-bottom: 20px;
        }

        /* ── HERO ── */
        .ramci-hero {
          margin-bottom: 4px;
          border-radius: 0 0 16px 16px;
          overflow: hidden;
        }

        /* ── CATEGORIES ── */
        .ramci-cats-section {
          display: flex;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 18px 14px 10px;
          gap: 6px;
          background: #fff;
          border-bottom: 1px solid #f0ede8;
        }
        .ramci-cats-section::-webkit-scrollbar { display: none; }

        .ramci-cat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          min-width: 70px;
          text-decoration: none;
          flex-shrink: 0;
          padding: 2px;
        }

        .ramci-cat-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          overflow: hidden;
          border: 1.5px solid #e8e3dc;
          background: #f5f2ec;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color .2s, transform .2s;
        }
        .ramci-cat-item:hover .ramci-cat-circle {
          border-color: #111;
          transform: scale(1.05);
        }

        .ramci-cat-circle-all {
          background: #111;
          color: #fff;
          border-color: #111;
        }

        .ramci-cat-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ramci-cat-placeholder {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px;
          font-weight: 600;
          color: #888;
        }

        .ramci-cat-label {
          font-family: 'DM Sans', sans-serif;
          font-size: 10px;
          font-weight: 500;
          color: #444;
          text-align: center;
          line-height: 1.3;
          max-width: 70px;
          word-break: break-word;
          white-space: normal;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* ── SECTION PRODUITS ── */
        .ramci-products-section {
          background: #fff;
          margin-top: 10px;
          padding: 18px 14px 20px;
        }

        .ramci-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .ramci-section-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 17px;
          font-weight: 700;
          color: #111;
          margin: 0;
        }

        .ramci-voir-tout {
          display: flex;
          align-items: center;
          gap: 3px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #666;
          text-decoration: none;
          transition: color .15s;
        }
        .ramci-voir-tout:hover { color: #111; }

        .ramci-section-tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid #f0ede8;
          margin-bottom: 16px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .ramci-section-tabs::-webkit-scrollbar { display: none; }

        .ramci-stab {
          flex-shrink: 0;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 8px 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          color: #999;
          cursor: pointer;
          white-space: nowrap;
          transition: all .15s;
          margin-bottom: -1px;
        }
        .ramci-stab.active {
          color: #111;
          border-bottom-color: #111;
          font-weight: 700;
        }

        .ramci-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .ramci-empty {
          text-align: center;
          padding: 40px;
          color: #bbb;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
        }

        /* Bouton Voir plus */
        .ramci-view-more-wrapper {
          display: flex;
          justify-content: center;
          margin-top: 24px;
        }

        .ramci-view-more-btn {
          background: #111;
          color: #fff;
          border: none;
          padding: 12px 32px;
          border-radius: 40px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ramci-view-more-btn:hover {
          background: #333;
          transform: scale(1.02);
        }
      `}</style>
    </>
  );
};

export default Home;