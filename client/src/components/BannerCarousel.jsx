import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';

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

    if (loading) {
        return (
            <div className={`w-full h-[200px] md:h-[280px] bg-gray-200 animate-pulse flex items-center justify-center ${className}`}>
                <p className="text-gray-400">Chargement...</p>
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
            className={`relative w-full ${className}`}
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
                            src={banner.image}
                            alt={banner.title || 'Bannière'}
                            className="w-full h-[200px] md:h-[280px] lg:h-[320px] object-cover"
                        />
                        {/* Overlay texte */}
                        {(banner.title || banner.subtitle) && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent flex flex-col items-center justify-center text-white text-center p-4">
                                {banner.title && (
                                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 drop-shadow-lg">
                                        {banner.title}
                                    </h2>
                                )}
                                {banner.subtitle && (
                                    <p className="text-sm md:text-base opacity-90 drop-shadow">
                                        {banner.subtitle}
                                    </p>
                                )}
                                <button className="mt-4 px-6 py-2 bg-white text-black rounded-full text-sm font-semibold hover:bg-gray-100 transition shadow-lg">
                                    Découvrir
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Flèches de navigation (optionnelles - masquées sur mobile) */}
            {banners.length > 1 && (
                <>
                    <button
                        onClick={() => {
                            goToPrevious();
                            resetAutoPlayTimer();
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 md:opacity-100"
                        style={{ opacity: 0.7 }}
                        aria-label="Précédent"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <button
                        onClick={() => {
                            goToNext();
                            resetAutoPlayTimer();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 md:opacity-100"
                        style={{ opacity: 0.7 }}
                        aria-label="Suivant"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                </>
            )}

            {/* Indicateurs (dots) */}
            {banners.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {banners.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all ${
                                currentIndex === index
                                    ? 'bg-white w-6 md:w-8'
                                    : 'bg-white/50 hover:bg-white/70'
                            }`}
                            aria-label={`Aller à l'image ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default BannerCarousel;