import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const BannerCarousel = ({ position = 'top', className = '' }) => {
    const { axios, navigate } = useAppContext();
    const [banners, setBanners] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

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

    // Défilement automatique
    useEffect(() => {
        if (banners.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % banners.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [banners.length]);

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
    };

    const goToSlide = (index) => {
        setCurrentIndex(index);
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
        <div className={`relative w-full overflow-hidden rounded-xl ${className}`}>
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

            {/* Flèche gauche */}
            {banners.length > 1 && (
                <button
                    onClick={goToPrevious}
                    className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shadow-lg transition z-10"
                >
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            {/* Flèche droite */}
            {banners.length > 1 && (
                <button
                    onClick={goToNext}
                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shadow-lg transition z-10"
                >
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
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