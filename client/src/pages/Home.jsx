import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import BannerCarousel from "../components/BannerCarousel";
import { getPresetImageUrl } from "../utils/cloudinaryImage";

const SECTIONS = [
  { id: "trends", label: "Tendances du moment" },
  { id: "new",    label: "Nouveautés" },
  { id: "deals",  label: "Promotions" },
];

const ProductCardSkeleton = () => (
  <div className="ramci-skeleton-card">
    <div className="ramci-skeleton-img" />
    <div className="ramci-skeleton-line ramci-skeleton-line-title" />
    <div className="ramci-skeleton-line ramci-skeleton-line-price" />
  </div>
);

const Home = () => {
  const { axios } = useAppContext();
  const [categories, setCategories] = useState([]);
  const [activeSection, setActiveSection] = useState("trends");
  
  // ✅ États pour les différentes sections (données GLOBALES du serveur)
  const [trendProducts, setTrendProducts] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [dealProducts, setDealProducts] = useState([]);
  
  // ✅ États pour la pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const observerRef = useRef(null);
  const navigate = useNavigate();

  // ✅ FETCH : Catégories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get('/api/category/list');
        if (data.success) setCategories(data.categories);
      } catch (e) {}
    };
    fetchCategories();
  }, [axios]);

  // ✅ FETCH : Produits avec tri (GLOBAL)
  const fetchProductsBySort = async (sort, limit = 12) => {
    try {
      const { data } = await axios.get(`/api/product/list?page=1&limit=${limit}&sort=${sort}`);
      if (data.success) {
        return data.products;
      }
      return [];
    } catch (error) {
      console.error(`Erreur chargement produits (${sort}):`, error);
      return [];
    }
  };

  // ✅ FETCH : Chargement initial des 3 sections
  useEffect(() => {
    const loadAllSections = async () => {
      setLoading(true);
      try {
        // ✅ Charger les 3 sections en parallèle
        const [trends, news, deals] = await Promise.all([
          fetchProductsBySort('salesCount', 12),  // ✅ Tendances : plus vendus
          fetchProductsBySort('createdAt', 12),   // ✅ Nouveautés : plus récents
          fetchProductsBySort('discount', 12)     // ✅ Promotions : meilleures offres
        ]);

        setTrendProducts(trends);
        setNewProducts(news);
        setDealProducts(deals);
      } catch (error) {
        console.error('Erreur chargement des sections:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAllSections();
  }, [axios]);

  // ✅ FETCH : Chargement pour la pagination (uniquement pour les tendances)
  const fetchMoreProducts = async (pageNum = 1) => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const { data } = await axios.get(`/api/product/list?page=${pageNum}&limit=12&sort=salesCount`);
      if (data.success) {
        setTrendProducts(prev => [...prev, ...data.products]);
        setHasMore(data.pagination.hasMore);
        setPage(pageNum);
      }
    } catch (error) {
      console.error("Erreur chargement plus de produits:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // ✅ Infinite Scroll pour les tendances
  const lastProductRef = useCallback((node) => {
    if (loadingMore || activeSection !== 'trends') return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchMoreProducts(page + 1);
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore, page, activeSection]);

  const getSectionProducts = () => {
    switch (activeSection) {
      case "new":   return newProducts;
      case "deals": return dealProducts;
      default:      return trendProducts;
    }
  };

  const sectionProducts = getSectionProducts();
  const activeCategories = categories.filter(c => c.active !== false);

  if (loading) {
    return (
      <>
        <SEO title="Ramci – Mode & Tendances" description="Découvrez vêtements, accessoires et plus sur Ramci. Livraison rapide à Abidjan, Côte d'Ivoire." />
        <div className="ramci-home">
          <div className="ramci-skeleton-hero" />
          <div className="ramci-cats-section">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ramci-cat-item">
                <div className="ramci-skeleton-cat-circle" />
                <div className="ramci-skeleton-line ramci-skeleton-line-cat" />
              </div>
            ))}
          </div>
          <section className="ramci-products-section">
            <div className="ramci-skeleton-line ramci-skeleton-line-heading" />
            <div className="ramci-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>
        <style>{SHARED_STYLES}</style>
      </>
    );
  }

  return (
    <>
      <SEO title="Ramci – Mode & Tendances" description="Découvrez les meilleures offres sur Ramci." />

      <div className="ramci-home">
        <section className="ramci-hero">
          <BannerCarousel position="top" />
        </section>

        {activeCategories.length > 0 && (
          <section className="ramci-cats-section">
            <Link to="/categories" className="ramci-cat-item">
              <div className="ramci-cat-circle ramci-cat-circle-all">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
                  <rect x="0" y="0" width="9" height="9" rx="2"/>
                  <rect x="13" y="0" width="9" height="9" rx="2"/>
                  <rect x="0" y="13" width="9" height="9" rx="2"/>
                  <rect x="13" y="13" width="9" height="9" rx="2"/>
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
                    ? <img src={getPresetImageUrl(cat.image, "thumbnail")} alt={cat.name} className="ramci-cat-img" />
                    : <span className="ramci-cat-placeholder">{cat.name?.[0]}</span>
                  }
                </div>
                <span className="ramci-cat-label">{cat.name}</span>
              </Link>
            ))}
          </section>
        )}

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
                {sectionProducts.map((p, index) => {
                  // ✅ Seulement pour les tendances (infinite scroll)
                  const isLastItem = index === sectionProducts.length - 1 && activeSection === "trends";
                  return (
                    <div key={p._id} ref={isLastItem ? lastProductRef : null}>
                      <ProductCard product={p} />
                    </div>
                  );
                })}
              </div>
              
              {loadingMore && activeSection === "trends" && (
                <div className="ramci-grid ramci-grid-loading-more">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <ProductCardSkeleton key={`more-${i}`} />
                  ))}
                </div>
              )}
              
              {!hasMore && activeSection === "trends" && sectionProducts.length > 0 && (
                <p className="text-center text-gray-400 text-sm mt-6 py-4">
                  Vous avez vu tous les produits tendances
                </p>
              )}
            </>
          ) : (
            <div className="ramci-empty">Aucun produit disponible</div>
          )}
        </section>
      </div>

      <style>{SHARED_STYLES}</style>
    </>
  );
};

const SHARED_STYLES = `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@400;500;600;700;800&display=swap');

        .ramci-home {
          background: #ffffff;
          min-height: 100vh;
          padding-bottom: 90px;
        }

        .ramci-hero {
          margin-bottom: 0;
          overflow: hidden;
        }

        .ramci-hero .banner-carousel,
        .ramci-hero .banner-slide,
        .ramci-hero .banner-image {
          width: 100%;
          height: auto;
        }

        .ramci-hero .banner-slide img,
        .ramci-hero .banner-image img {
          width: 100%;
          height: auto;
          object-fit: cover;
          display: block;
        }

        @media (max-width: 768px) {
          .ramci-hero .banner-slide img,
          .ramci-hero .banner-image img {
            max-height: 250px;
            object-fit: cover;
          }
        }

        @media (max-width: 480px) {
          .ramci-hero .banner-slide img,
          .ramci-hero .banner-image img {
            max-height: 180px;
            object-fit: cover;
          }
        }

        .ramci-cats-section {
          display: flex;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 20px 16px;
          gap: 14px;
          background: #fff;
        }
        .ramci-cats-section::-webkit-scrollbar { display: none; }

        .ramci-cat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          min-width: 82px;
          text-decoration: none;
          flex-shrink: 0;
          padding: 2px;
        }

        .ramci-cat-circle {
          width: 72px;
          height: 72px;
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
          font-size: 11px;
          font-weight: 500;
          color: #444;
          text-align: center;
          line-height: 1.3;
          max-width: 82px;
          word-break: break-word;
          white-space: normal;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .ramci-products-section {
          background: #fff;
          margin-top: 0;
          padding: 24px 16px;
        }

        .ramci-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .ramci-section-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 20px;
          font-weight: 800;
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
          color: #e53935;
          border-bottom-color: #e53935;
          font-weight: 700;
        }

        .ramci-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .ramci-grid-loading-more {
          margin-top: 16px;
        }

        .ramci-empty {
          text-align: center;
          padding: 40px;
          color: #bbb;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
        }

        @keyframes ramci-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .ramci-skeleton-hero,
        .ramci-skeleton-cat-circle,
        .ramci-skeleton-img,
        .ramci-skeleton-line {
          background: linear-gradient(
            90deg,
            #f5f2ec 25%,
            #fbe9e7 45%,
            #f5f2ec 65%
          );
          background-size: 200% 100%;
          animation: ramci-shimmer 1.6s ease-in-out infinite;
          border-radius: 8px;
        }

        .ramci-skeleton-hero {
          width: 100%;
          aspect-ratio: 16 / 7;
          border-radius: 0;
        }

        .ramci-skeleton-cat-circle {
          width: 72px;
          height: 72px;
          border-radius: 50%;
        }

        .ramci-skeleton-line {
          height: 10px;
          border-radius: 4px;
        }

        .ramci-skeleton-line-cat {
          width: 56px;
          margin-top: 7px;
        }

        .ramci-skeleton-line-heading {
          width: 160px;
          height: 18px;
          margin: 4px 0 16px;
        }

        .ramci-skeleton-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ramci-skeleton-img {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 12px;
        }

        .ramci-skeleton-line-title {
          width: 85%;
          margin-top: 2px;
        }

        .ramci-skeleton-line-price {
          width: 45%;
          height: 12px;
        }

        @media (prefers-reduced-motion: reduce) {
          .ramci-skeleton-hero,
          .ramci-skeleton-cat-circle,
          .ramci-skeleton-img,
          .ramci-skeleton-line {
            animation: none;
          }
        }
`;

export default Home;