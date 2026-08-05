import React, { useRef, useState, useEffect } from 'react'
import { useAppContext } from '../context/AppContext'
import { ChevronLeft, ChevronRight, Package, Grid, TrendingUp, Sparkles } from 'lucide-react'
// [PHASE 1 - PERF] Transformation Cloudinary (f_auto, q_auto, largeur adaptée)
import { getPresetImageUrl } from '../utils/cloudinaryImage'

// [MODERNISATION] Nombre de cercles affichés dans le skeleton de
// chargement — purement esthétique, n'a aucun impact sur le nombre réel
// de catégories une fois chargées.
const SKELETON_COUNT = 6;

const Categories = () => {

    const { navigate, axios } = useAppContext()
    const scrollRef = useRef(null)
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [showLeftArrow, setShowLeftArrow] = useState(false)
    const [showRightArrow, setShowRightArrow] = useState(true)
    const [hoveredIndex, setHoveredIndex] = useState(null)
    const [touchStart, setTouchStart] = useState(null)
    const [touchEnd, setTouchEnd] = useState(null)

    const checkScrollPosition = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
            setShowLeftArrow(scrollLeft > 0)
            setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10)
        }
    }

    const scrollLeft = () => {
        scrollRef.current.scrollBy({ left: -280, behavior: 'smooth' })
        setTimeout(checkScrollPosition, 300)
    }

    const scrollRight = () => {
        scrollRef.current.scrollBy({ left: 280, behavior: 'smooth' })
        setTimeout(checkScrollPosition, 300)
    }

    // Swipe pour mobile
    const handleTouchStart = (e) => {
        setTouchStart(e.targetTouches[0].clientX)
    }

    const handleTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX)
    }

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return
        const diff = touchStart - touchEnd
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                scrollRight()
            } else {
                scrollLeft()
            }
        }
        setTouchStart(null)
        setTouchEnd(null)
    }

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/category/list')
            if (data.success) {
                // Filtrer uniquement les catégories actives
                const activeCategories = data.categories.filter(c => c.active !== false)
                setCategories(activeCategories)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    useEffect(() => {
        if (scrollRef.current) {
            checkScrollPosition()
            window.addEventListener('resize', checkScrollPosition)
            return () => window.removeEventListener('resize', checkScrollPosition)
        }
    }, [categories])

    // [MODERNISATION] Skeleton de chargement cohérent avec Home.jsx /
    // BannerCarousel / ProductCard (effet de balayage rouge/crème) au lieu
    // du simple spinner rond isolé — reprend la même mise en page (en-tête
    // + rangée de cercles) que l'état chargé, pour éviter un saut de mise
    // en page une fois les données arrivées.
    if (loading) {
        return (
            <div className="bg-gradient-to-b from-white to-gray-50 pt-8 pb-6 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Sparkles size={20} className="text-red-500" />
                                <h2 className="text-2xl font-bold text-gray-900">Catégories</h2>
                            </div>
                            <div className="w-12 h-0.5 bg-gradient-to-r from-red-500 to-red-300 rounded-full mt-2"></div>
                            <p className="text-xs text-gray-400 mt-2">Découvrez nos collections</p>
                        </div>
                    </div>
                    <div className="flex gap-5 pb-4 px-2 overflow-hidden">
                        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                            <div key={i} className="flex-shrink-0 w-24 text-center">
                                <div className="cat-skeleton-circle mx-auto mb-3" />
                                <div className="cat-skeleton-line mx-auto" />
                            </div>
                        ))}
                    </div>
                    <style>{SKELETON_STYLES}</style>
                </div>
            </div>
        )
    }

    if (categories.length === 0) {
        return null
    }

    return (
        <div className="bg-gradient-to-b from-white to-gray-50 pt-8 pb-6 px-4">
            <div className="max-w-7xl mx-auto">
                {/* En-tête avec design moderne */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Sparkles size={20} className="text-red-500" />
                            <h2 className="text-2xl font-bold text-gray-900">Catégories</h2>
                        </div>
                        <div className="w-12 h-0.5 bg-gradient-to-r from-red-500 to-red-300 rounded-full mt-2"></div>
                        <p className="text-xs text-gray-400 mt-2">Découvrez nos collections</p>
                    </div>
                    <button 
                        onClick={() => navigate('/categories')}
                        className="group text-sm text-gray-500 hover:text-red-500 transition flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-red-50"
                    >
                        <Grid size={14} />
                        Voir tout
                        <TrendingUp size={14} className="opacity-0 group-hover:opacity-100 transition" />
                    </button>
                </div>

                {/* Carrousel avec swipe */}
                <div 
                    className='relative'
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    
                    {/* Flèche gauche - visible sur desktop */}
                    {showLeftArrow && (
                        <button 
                            onClick={scrollLeft}
                            className='hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full w-10 h-10 items-center justify-center text-gray-700 hover:bg-red-500 hover:text-white transition-all duration-300 border border-gray-200 -ml-3 hover:shadow-xl hover:scale-110'
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}

                    {/* Liste des catégories */}
                    <div 
                        ref={scrollRef} 
                        onScroll={checkScrollPosition}
                        className='flex overflow-x-auto gap-5 pb-4 px-2 scroll-smooth'
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <style>{`
                            div::-webkit-scrollbar {
                                display: none;
                            }
                            .category-card {
                                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            }
                            .category-card:hover {
                                transform: translateY(-4px);
                            }
                        `}</style>
                        
                        {categories.map((category, index) => (
                            <div 
                                key={category._id || index}
                                className='category-card group cursor-pointer flex-shrink-0 w-24 text-center transition-all duration-300'
                                onClick={() => {
                                    navigate(`/products?categories=${category.slug}`);
                                    window.scrollTo(0, 0);
                                }}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                {/* Cercle image avec effet glow */}
                                <div className='relative mx-auto mb-3'>
                                    <div 
                                        className={`w-20 h-20 rounded-full overflow-hidden shadow-md transition-all duration-300 ${
                                            hoveredIndex === index 
                                                ? 'shadow-lg ring-2 ring-red-500 ring-offset-2 scale-105' 
                                                : 'shadow-md'
                                        }`}
                                        style={{ backgroundColor: category.bgColor || '#f3f4f6' }}
                                    >
                                        {category.image ? (
                                            <img 
                                                src={getPresetImageUrl(category.image, 'thumbnail')} 
                                                alt={category.name} 
                                                className='w-full h-full object-cover transition-transform duration-300 group-hover:scale-110'
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className='w-full h-full flex items-center justify-center transition-colors duration-300 group-hover:bg-red-50'>
                                                <Package size={28} className="text-gray-400 group-hover:text-red-500 transition-colors duration-300" />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Badge "Nouveau" (optionnel - à activer si besoin) */}
                                    {/* {category.isNew && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                            NEW
                                        </span>
                                    )} */}
                                </div>
                                
                                {/* Nom avec animation */}
                                <p className={`text-sm font-medium transition-all duration-300 line-clamp-1 ${
                                    hoveredIndex === index 
                                        ? 'text-red-500 scale-105' 
                                        : 'text-gray-700 group-hover:text-red-500'
                                }`}>
                                    {category.name}
                                </p>
                                
                                {/* Indicateur de produits (optionnel) */}
                                {/* {category.productCount && (
                                    <p className="text-[10px] text-gray-400 mt-0.5">{category.productCount} produits</p>
                                )} */}
                            </div>
                        ))}
                    </div>

                    {/* Flèche droite - visible sur desktop */}
                    {showRightArrow && (
                        <button 
                            onClick={scrollRight}
                            className='hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full w-10 h-10 items-center justify-center text-gray-700 hover:bg-red-500 hover:text-white transition-all duration-300 border border-gray-200 -mr-3 hover:shadow-xl hover:scale-110'
                        >
                            <ChevronRight size={20} />
                        </button>
                    )}

                </div>

                {/* Indicateurs de scroll pour mobile */}
                <div className="flex justify-center gap-1.5 mt-4 md:hidden">
                    <div className={`h-1 rounded-full transition-all duration-300 ${
                        showLeftArrow ? 'w-4 bg-red-500' : 'w-2 bg-gray-300'
                    }`} />
                    <div className={`h-1 rounded-full transition-all duration-300 ${
                        !showLeftArrow && showRightArrow ? 'w-4 bg-red-500' : 'w-2 bg-gray-300'
                    }`} />
                    <div className={`h-1 rounded-full transition-all duration-300 ${
                        !showRightArrow ? 'w-4 bg-red-500' : 'w-2 bg-gray-300'
                    }`} />
                </div>
            </div>
        </div>
    )
}

// [MODERNISATION] Styles du skeleton, extraits en constante pour ne pas
// alourdir le JSX de la branche "loading".
const SKELETON_STYLES = `
    @keyframes cat-skeleton-shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }
    .cat-skeleton-circle,
    .cat-skeleton-line {
        background: linear-gradient(
            90deg,
            #f5f2ec 25%,
            #fbe9e7 45%,
            #f5f2ec 65%
        );
        background-size: 200% 100%;
        animation: cat-skeleton-shimmer 1.6s ease-in-out infinite;
    }
    .cat-skeleton-circle {
        width: 80px;
        height: 80px;
        border-radius: 50%;
    }
    .cat-skeleton-line {
        width: 56px;
        height: 10px;
        border-radius: 4px;
    }
    @media (prefers-reduced-motion: reduce) {
        .cat-skeleton-circle,
        .cat-skeleton-line {
            animation: none;
        }
    }
`;

export default Categories