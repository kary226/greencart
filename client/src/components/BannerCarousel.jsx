import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { getPresetImageUrl } from '../utils/cloudinaryImage';

const BannerCarousel = ({ position = 'top', className = '' }) => {
    const { axios, navigate } = useAppContext();
    const [banners, setBanners] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // État pour le swipe
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);
    const carouselRef = useRef(null);
    
    // État pour l'auto-défilement (pause après interaction)
    const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
    const autoPlayTimerRef = useRef(null);

    const fetchBanners = async () => {
        try {
            const { data } = await axios.get(`/api/banner/list?position=${position}`);
            if (data.success) {
                setBanners(data.banners);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBanners();
    }, [position]);

    // Fonction pour passer à l'image suivante
    const goToNext = () => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
    };

    // Fonction pour passer à l'image précédente
    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    };

    // Réinitialiser le timer d'auto-défilement après interaction manuelle
    const resetAutoPlayTimer = () => {
        if (autoPlayTimerRef.current) {
            clearInterval(autoPlayTimerRef.current);
        }
        setAutoPlayEnabled(false);
        
        // Attendre 5 secondes avant de réactiver l'auto-défilement
        setTimeout(() => {
            setAutoPlayEnabled(true);
        }, 5000);
    };

    // Défilement automatique (toutes les 5 secondes, sauf si désactivé)
    useEffect(() => {
        if (banners.length <= 1) return;
        
        if (autoPlayEnabled) {
            const interval = setInterval(() => {
                goToNext();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [banners.length, autoPlayEnabled, currentIndex]);

    // Gestion du swipe (touch)
    const handleTouchStart = (e) => {
        setTouchStart(e.targetTouches[0].clientX);
        resetAutoPlayTimer();
    };

    const handleTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const minSwipeDistance = 50;
        
        if (Math.abs(distance) > minSwipeDistance) {
            if (distance > 0) {
                // Swipe gauche → suivant
                goToNext();
            } else {
                // Swipe droite → précédent
                goToPrevious();
            }
        }
        
        setTouchStart(0);
        setTouchEnd(0);
    };

    // Gestion du swipe (souris pour desktop)
    const [mouseStart, setMouseStart] = useState(0);
    const [mouseEnd, setMouseEnd] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setMouseStart(e.clientX);
        resetAutoPlayTimer();
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setMouseEnd(e.clientX);
    };

    const handleMouseUp = () => {
        if (!isDragging) return;
        
        const distance = mouseStart - mouseEnd;
        const minSwipeDistance = 30;
        
        if (Math.abs(distance) > minSwipeDistance) {
            if (distance > 0) {
                goToNext();
            } else {
                goToPrevious();
            }
        }
        
        setIsDragging(false);
        setMouseStart(0);
        setMouseEnd(0);
    };

    const goToSlide = (index) => {
        setCurrentIndex(index);
        resetAutoPlayTimer();
    };

    const handleBannerClick = (banner) => {
        if (banner.link) {
            navigate(banner.link);
        }
    };

    // [MODERNISATION] Skeleton de chargement cohérent avec le reste du site
    // (effet de balayage rouge/crème) au lieu du simple "Chargement..." sur
    // fond gris plat.
    if (loading) {
        return (
            <div className={`ramci-banner-skeleton ${className}`}>
                <style>{BANNER_STYLES}</style>
            </div>
        );
    }

    if (banners.length === 0) {
        return null;
    }

    // Style spécifique selon la position
    const isTopPosition = position === 'top';
    const containerStyle = isTopPosition 
        ? { borderRadius: '0 0 16px 16px', overflow: 'hidden' }
        : { borderRadius: '16px', overflow: 'hidden' };

    return (
        <div 
            className={`relative w-full ramci-banner-carousel ${className}`}
            style={containerStyle}
            ref={carouselRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDragging(false)}
        >
            {/* Conteneur du carrousel */}
            <div 
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {banners.map((banner, index) => (
                    <div
                        key={banner._id || index}
                        className="w-full flex-shrink-0 cursor-pointer relative group"
                        onClick={() => handleBannerClick(banner)}
                    >
                        <img
                            src={getPresetImageUrl(banner.image, "banner")}
                            alt={banner.title || 'Bannière'}
                            className="w-full h-[200px] md:h-[280px] lg:h-[320px] object-cover"
                            draggable={false}
                            // Le premier slide est visible dès le chargement de la page
                            // (candidat LCP) : on ne le lazy-load pas, contrairement
                            // aux suivants qui ne sont vus qu'après interaction.
                            loading={index === 0 ? undefined : 'lazy'}
                        />
                        {/* Overlay texte */}
                        {(banner.title || banner.subtitle) && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent flex flex-col items-center justify-center text-white text-center p-4">
                                {banner.title && (
                                    <h2 className="ramci-banner-title">
                                        {banner.title}
                                    </h2>
                                )}
                                {banner.subtitle && (
                                    <p className="ramci-banner-subtitle">
                                        {banner.subtitle}
                                    </p>
                                )}
                                <button className="ramci-banner-cta">
                                    Découvrir
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* [MODERNISATION] Flèches de navigation : masquées sur mobile
                (le swipe tactile suffit et des flèches semi-transparentes
                encombrent une petite image), visibles uniquement au survol
                sur desktop — pattern standard des carousels modernes
                (Airbnb, Amazon). */}
            {banners.length > 1 && (
                <>
                    <button
                        onClick={() => {
                            goToPrevious();
                            resetAutoPlayTimer();
                        }}
                        className="ramci-banner-arrow ramci-banner-arrow-left"
                        aria-label="Précédent"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <button
                        onClick={() => {
                            goToNext();
                            resetAutoPlayTimer();
                        }}
                        className="ramci-banner-arrow ramci-banner-arrow-right"
                        aria-label="Suivant"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                </>
            )}

            {/* [MODERNISATION] Indicateurs minimalistes style Apple : traits
                fins plutôt que des points ronds, celui actif s'allonge et
                passe au rouge de la marque (au lieu du blanc neutre). */}
            {banners.length > 1 && (
                <div className="ramci-banner-dots">
                    {banners.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`ramci-banner-dot${currentIndex === index ? ' active' : ''}`}
                            aria-label={`Aller à l'image ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            <style>{BANNER_STYLES}</style>
        </div>
    );
};

const BANNER_STYLES = `
        .ramci-banner-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 6px;
          text-shadow: 0 2px 10px rgba(0,0,0,.35);
        }
        @media (min-width: 768px) {
          .ramci-banner-title { font-size: 30px; }
        }

        .ramci-banner-subtitle {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          opacity: .92;
          text-shadow: 0 1px 6px rgba(0,0,0,.3);
        }
        @media (min-width: 768px) {
          .ramci-banner-subtitle { font-size: 15px; }
        }

        .ramci-banner-cta {
          margin-top: 14px;
          padding: 9px 22px;
          background: #e53935;
          color: #fff;
          border: none;
          border-radius: 999px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .2px;
          cursor: pointer;
          transition: background .15s, transform .15s;
          box-shadow: 0 4px 14px rgba(229,57,53,.35);
        }
        .ramci-banner-cta:hover {
          background: #c62828;
          transform: translateY(-1px);
        }

        /* ============================================================
           Flèches : invisibles sur tactile (pas de hover sur mobile),
           apparition au survol uniquement sur pointeurs fins (souris).
           ============================================================ */
        .ramci-banner-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 50%;
          background: rgba(255,255,255,.92);
          color: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,.18);
          opacity: 0;
          transition: opacity .2s, background .15s, transform .15s;
          z-index: 5;
        }
        .ramci-banner-arrow-left { left: 12px; }
        .ramci-banner-arrow-right { right: 12px; }

        @media (hover: hover) and (pointer: fine) {
          .ramci-banner-carousel:hover .ramci-banner-arrow {
            opacity: 1;
          }
          .ramci-banner-arrow:hover {
            background: #fff;
            transform: translateY(-50%) scale(1.06);
          }
        }

        /* ============================================================
           Dots minimalistes style Apple : traits fins, actif en rouge.
           ============================================================ */
        .ramci-banner-dots {
          position: absolute;
          bottom: 14px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 5px;
          z-index: 5;
        }

        .ramci-banner-dot {
          width: 14px;
          height: 3px;
          border-radius: 2px;
          border: none;
          background: rgba(255,255,255,.5);
          cursor: pointer;
          padding: 0;
          transition: width .25s, background .25s;
        }

        .ramci-banner-dot.active {
          width: 22px;
          background: #e53935;
        }

        /* ============================================================
           Skeleton de chargement
           ============================================================ */
        @keyframes ramci-banner-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .ramci-banner-skeleton {
          width: 100%;
          height: 200px;
          border-radius: 0 0 16px 16px;
          background: linear-gradient(
            90deg,
            #f5f2ec 25%,
            #fbe9e7 45%,
            #f5f2ec 65%
          );
          background-size: 200% 100%;
          animation: ramci-banner-shimmer 1.6s ease-in-out infinite;
        }
        @media (min-width: 768px) {
          .ramci-banner-skeleton { height: 280px; }
        }
        @media (min-width: 1024px) {
          .ramci-banner-skeleton { height: 320px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ramci-banner-skeleton { animation: none; }
        }
`;

export default BannerCarousel;