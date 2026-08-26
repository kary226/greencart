import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import BannerCarousel from "../components/BannerCarousel";
import { getPresetImageUrl } from "../utils/cloudinaryImage";
// Habillage RAMSES de l accueil (voir DESIGN.md a la racine).
import "../styles/home.css";

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

  // ✅ FETCH : Catégories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get('/api/category/list');
        if (data.success) setCategories(data.categories);
      } catch { /* pas de bandeau catégories si l'appel échoue */ }
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
          <section className="ramci-cats-wrapper">
            <div className="ramci-section-header">
              <h2 className="ramci-section-title">Catégories</h2>
              <Link to="/categories" className="ramci-voir-tout">
                Voir tout
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </Link>
            </div>

            <div className="ramci-cats-section">
              {activeCategories.map((cat) => (
                <Link
                  key={cat._id}
                  to={`/products?categories=${cat.slug || cat.name}`}
                  className="ramci-cat-item"
                >
                  <div className="ramci-cat-circle">
                    {cat.image
                      ? <img src={getPresetImageUrl(cat.image, "categoryIcon")} alt={cat.name} className="ramci-cat-img" />
                      : <span className="ramci-cat-placeholder">{cat.name?.[0]}</span>
                    }
                  </div>
                  <span className="ramci-cat-label">{cat.name}</span>
                </Link>
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
                <p className="ramci-fin-liste">
                  Vous avez vu tous les produits tendances
                </p>
              )}
            </>
          ) : (
            <div className="ramci-empty">Aucun produit disponible</div>
          )}
        </section>
      </div>
    </>
  );
};



export default Home;