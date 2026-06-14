import React, { useEffect, useState, useCallback, useRef } from "react";
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
  const { axios, orders } = useAppContext();
  const [categories, setCategories] = useState([]);
  const [activeSection, setActiveSection] = useState("trends");
  
  // État pour les produits avec pagination
  const [allProducts, setAllProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // État pour les produits triés par section (TOUS les produits, pas de limite)
  const [trendProducts, setTrendProducts] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [dealProducts, setDealProducts] = useState([]);
  
  const observerRef = useRef(null);
  const navigate = useNavigate();

  // Charger les catégories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get('/api/category/list');
        if (data.success) setCategories(data.categories);
      } catch (e) {}
    };
    fetchCategories();
  }, []);

  // Charger les produits avec pagination
  const fetchProducts = async (pageNum = 1, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const { data } = await axios.get(`/api/product/list?page=${pageNum}&limit=12`);
      if (data.success) {
        const newProductsList = data.products;
        
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
  };

  // Chargement initial
  useEffect(() => {
    fetchProducts(1, true);
  }, []);

  // Observer pour l'infinite scroll (charge plus de produits quand on descend)
  const lastProductRef = useCallback((node) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchProducts(page + 1, false);
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore, page]);

  // Calculer les produits triés quand allProducts change (TOUS les produits, pas de slice)
  useEffect(() => {
    if (allProducts.length > 0) {
      setTrendProducts(getTrendingProducts());
      setNewProducts(getNewProducts());
      setDealProducts(getDealProducts());
    }
  }, [allProducts, orders]);

  // ⭐ MODIFIÉ : Supprimé .slice(0, 10) pour afficher TOUS les produits tendances
  const getTrendingProducts = () => {
    if (!allProducts.length) return [];
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
    const productsWithSales = allProducts.map(product => ({
      ...product,
      salesCount: productSales[product._id] || 0
    }));
    productsWithSales.sort((a, b) => b.salesCount - a.salesCount);
    return productsWithSales; // ← SUPPRIMÉ .slice(0, 10)
  };

  // ⭐ MODIFIÉ : Supprimé .slice(0, 10) pour afficher TOUS les nouveaux produits
  const getNewProducts = () => {
    if (!allProducts.length) return [];
    const sorted = [...allProducts].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });
    return sorted; // ← SUPPRIMÉ .slice(0, 10)
  };

  // ⭐ MODIFIÉ : Supprimé .slice(0, 10) pour afficher TOUTES les promotions
  const getDealProducts = () => {
    if (!allProducts.length) return [];
    const productsWithOffer = allProducts.filter(p => p.offerPrice && p.offerPrice < p.price);
    const productsWithScore = productsWithOffer.map(product => {
      const discountPercent = ((product.price - product.offerPrice) / product.price) * 100;
      const amountSaved = product.price - product.offerPrice;
      const score = (discountPercent * 0.7) + ((amountSaved / 1000) * 0.3);
      return {
        ...product,
        discountPercent: Math.round(discountPercent),
        amountSaved: amountSaved,
        promotionScore: score
      };
    });
    productsWithScore.sort((a, b) => b.promotionScore - a.promotionScore);
    return productsWithScore; // ← SUPPRIMÉ .slice(0, 10)
  };

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">Chargement...</p>
        </div>
      </div>
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
                    ? <img src={cat.image} alt={cat.name} className="ramci-cat-img" />
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
                  // Ajouter une ref au dernier élément pour l'intersection observer
                  const isLastItem = index === sectionProducts.length - 1 && activeSection === "trends";
                  return (
                    <div key={p._id} ref={isLastItem ? lastProductRef : null}>
                      <ProductCard product={p} />
                    </div>
                  );
                })}
              </div>
              
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
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

      <style>{`
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

        .ramci-empty {
          text-align: center;
          padding: 40px;
          color: #bbb;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
        }
      `}</style>
    </>
  );
};

export default Home;