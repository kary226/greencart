import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";

// ⚡ Lazy loading du BannerCarousel (pas critique pour le premier affichage)
const BannerCarousel = lazy(() => import("../components/BannerCarousel"));

const SECTIONS = [
  { id: "trends", label: "Tendances du moment" },
  { id: "new",    label: "Nouveautés" },
  { id: "deals",  label: "Promotions" },
];

const BESTSELLERS_COUNT = 10;

// ⚡ Optimisation : skeleton avec React.memo pour éviter les re-rendus
const ProductCardSkeleton = React.memo(() => (
  <div className="ramci-skeleton-card">
    <div className="ramci-skeleton-img" />
    <div className="ramci-skeleton-line ramci-skeleton-line-title" />
    <div className="ramci-skeleton-line ramci-skeleton-line-price" />
  </div>
));

// ⚡ Optimisation : composant de chargement du carousel
const BannerLoader = () => (
  <div className="ramci-skeleton-hero" />
);

const Home = () => {
  const { axios, orders } = useAppContext();
  const [categories, setCategories] = useState([]);
  const [activeSection, setActiveSection] = useState("trends");
  
  const [allProducts, setAllProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const observerRef = useRef(null);
  const navigate = useNavigate();

  // ⚡ Optimisation : charger les catégories avec un abort controller
  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get('/api/category/list', {
          signal: abortController.signal
        });
        if (data.success) setCategories(data.categories);
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
      }
    };
    fetchCategories();
    
    return () => abortController.abort();
  }, []);

  // ⚡ Optimisation : charger les produits avec pagination et cache
  const fetchProducts = useCallback(async (pageNum = 1, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      // ⚡ Cache via localStorage pour les visites ultérieures
      const cacheKey = `products_page_${pageNum}`;
      const cachedData = sessionStorage.getItem(cacheKey);
      
      if (cachedData && isInitial) {
        const parsed = JSON.parse(cachedData);
        setAllProducts(parsed.products);
        setHasMore(parsed.hasMore);
        setPage(pageNum);
        setLoading(false);
        return;
      }
      
      const { data } = await axios.get(`/api/product/list?page=${pageNum}&limit=12`);
      if (data.success) {
        const newProductsList = data.products;
        
        // ⚡ Mise en cache pour 5 minutes
        if (isInitial) {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            products: newProductsList,
            hasMore: data.pagination.hasMore
          }));
          // Nettoyer le cache après 5 minutes
          setTimeout(() => {
            sessionStorage.removeItem(cacheKey);
          }, 300000);
        }
        
        if (isInitial) {
          setAllProducts(newProductsList);
        } else {
          setAllProducts(prev => [...prev, ...newProductsList]);
        }
        
        setHasMore(data.pagination.hasMore);
        setPage(pageNum);
      }
    } catch (error) {
      console.error("Erreur chargement produits:", error);
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [axios]);

  // Chargement initial
  useEffect(() => {
    fetchProducts(1, true);
  }, [fetchProducts]);

  // ⚡ Optimisation : observer avec useCallback et cleanup
  const lastProductRef = useCallback((node) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchProducts(page + 1, false);
      }
    }, {
      // ⚡ Optimisation : déclencher un peu avant la fin
      rootMargin: '200px',
      threshold: 0.1
    });
    
    if (node) observerRef.current.observe(node);
    
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loadingMore, hasMore, page, fetchProducts]);

  // ⚡ Optimisation : calculs des produits avec useMemo pour éviter les recalculs
  const { trendProducts, newProducts, dealProducts, bestSellers } = useMemo(() => {
    if (!allProducts.length) {
      return { trendProducts: [], newProducts: [], dealProducts: [], bestSellers: [] };
    }

    // Calcul des ventes
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

    // Tendance (tri par ventes)
    const trend = allProducts.map(product => ({
      ...product,
      salesCount: productSales[product._id] || 0
    })).sort((a, b) => b.salesCount - a.salesCount);

    // Nouveautés (tri par date)
    const newItems = [...allProducts].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    // Promotions
    const deals = allProducts
      .filter(p => p.offerPrice && p.offerPrice < p.price)
      .map(product => {
        const discountPercent = ((product.price - product.offerPrice) / product.price) * 100;
        const amountSaved = product.price - product.offerPrice;
        return {
          ...product,
          discountPercent: Math.round(discountPercent),
          amountSaved,
          promotionScore: (discountPercent * 0.7) + ((amountSaved / 1000) * 0.3)
        };
      })
      .sort((a, b) => b.promotionScore - a.promotionScore);

    // Best-sellers (uniquement ceux avec des ventes)
    const best = trend
      .filter(p => p.salesCount > 0)
      .slice(0, BESTSELLERS_COUNT);

    return { trendProducts: trend, newProducts: newItems, dealProducts: deals, bestSellers: best };
  }, [allProducts, orders]);

  const sectionProducts = useMemo(() => {
    switch (activeSection) {
      case "new":   return newProducts;
      case "deals": return dealProducts;
      default:      return trendProducts;
    }
  }, [activeSection, trendProducts, newProducts, dealProducts]);

  const activeCategories = useMemo(() => {
    return categories.filter(c => c.active !== false);
  }, [categories]);

  // ⚡ Optimisation : skeleton loading
  if (loading) {
    return (
      <>
        <SEO title="Ramci – Mode & Tendances" description="Découvrez les meilleures offres sur Ramci." />
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
      <SEO 
        title="Ramci – Mode & Tendances" 
        description="Découvrez les meilleures offres sur Ramci."
        // ⚡ Ajout des métadonnées pour le partage social
        openGraph={{
          title: 'Ramci – Mode & Tendances',
          description: 'Découvrez les meilleures offres sur Ramci.',
          image: 'https://ramci.com/og-image.jpg'
        }}
      />

      <div className="ramci-home">
        {/* ⚡ Lazy loading du carousel avec fallback */}
        <section className="ramci-hero">
          <Suspense fallback={<BannerLoader />}>
            <BannerCarousel position="top" />
          </Suspense>
        </section>

        {activeCategories.length > 0 && (
          <section className="ramci-cats-section">
            <Link to="/products" className="ramci-cat-item">
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
                    ? <img src={cat.image} alt={cat.name} className="ramci-cat-img" loading="lazy" />
                    : <span className="ramci-cat-placeholder">{cat.name?.[0]}</span>
                  }
                </div>
                <span className="ramci-cat-label">{cat.name}</span>
              </Link>
            ))}
          </section>
        )}

        {/* Best-sellers */}
        {bestSellers.length > 0 && (
          <section className="ramci-bestsellers-section">
            <div className="ramci-section-header">
              <h2 className="ramci-section-title ramci-bestsellers-title">
                <span className="ramci-bestsellers-badge">🔥</span>
                Les plus vendus
              </h2>
            </div>
            <div className="ramci-bestsellers-scroll">
              {bestSellers.map((p) => (
                <div key={p._id} className="ramci-bestsellers-item">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
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
                  const isLastItem = index === sectionProducts.length - 1 && activeSection === "trends";
                  return (
                    <div key={p._id} ref={isLastItem ? lastProductRef : null}>
                      <ProductCard product={p} />
                    </div>
                  );
                })}
              </div>
              
              {loadingMore && (
                <div className="ramci-grid ramci-grid-loading-more">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <ProductCardSkeleton key={`more-${i}`} />
                  ))}
                </div>
              )}
              
              {!hasMore && sectionProducts.length > 0 && (
                <p className="text-center text-gray-400 text-sm mt-6 py-4">
                  Vous avez vu tous les produits
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

// [MODERNISATION] Styles extraits dans une constante partagée
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

  .ramci-bestsellers-section {
    background: #fff;
    padding: 20px 0 24px;
  }

  .ramci-bestsellers-section .ramci-section-header {
    padding: 0 16px;
  }

  .ramci-bestsellers-title {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ramci-bestsellers-badge {
    font-size: 17px;
    line-height: 1;
  }

  .ramci-bestsellers-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
    padding: 4px 16px 8px;
  }
  .ramci-bestsellers-scroll::-webkit-scrollbar { display: none; }

  .ramci-bestsellers-item {
    flex: 0 0 auto;
    width: 152px;
    scroll-snap-align: start;
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