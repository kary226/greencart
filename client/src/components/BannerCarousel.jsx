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
            <div className={`w-full h-[200px] md:h-[300px] bg-gray-200 animate-pulse rounded-xl flex items-center justify-center ${className}`}>
                <p className="text-gray-400">Chargement...</p>
            </div>
        );
    }

    if (banners.length === 0) {
        return null;
    }

    return (
        <div 
            className={`relative w-full overflow-hidden rounded-xl ${className}`}
            ref={carouselRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDragging(false)}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
                            className="w-full h-[200px] md:h-[300px] lg:h-[350px] object-cover"
                        />
                        {/* Overlay texte */}
                        {(banner.title || banner.subtitle) && (
                            <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-white text-center p-4">
                                {banner.title && (
                                    <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 drop-shadow-lg">
                                        {banner.title}
                                    </h2>
                                )}
                                {banner.subtitle && (
                                    <p className="text-sm md:text-lg opacity-90 drop-shadow">
                                        {banner.subtitle}
                                    </p>
                                )}
                                <button className="mt-4 px-6 py-2 bg-primary text-white rounded-full text-sm hover:bg-primary-dull transition shadow-lg">
                                    Découvrir
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Indicateurs (dots) */}
            {banners.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {banners.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all ${
                                currentIndex === index
                                    ? 'bg-primary w-4 md:w-6'
                                    : 'bg-white/60 hover:bg-white/80'
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default BannerCarousel;