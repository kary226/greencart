import React, { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import ProductCard from './ProductCard';

const RecentlyViewed = () => {
    const { recentlyViewed } = useAppContext();
    const scrollRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    if (!recentlyViewed || recentlyViewed.length === 0) {
        return null;
    }

    const checkScrollPosition = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setShowLeftArrow(scrollLeft > 20);
            setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 20);
        }
    };

    const scrollLeft = () => {
        scrollRef.current.scrollBy({ left: -280, behavior: 'smooth' });
        setTimeout(checkScrollPosition, 300);
    };

    const scrollRight = () => {
        scrollRef.current.scrollBy({ left: 280, behavior: 'smooth' });
        setTimeout(checkScrollPosition, 300);
    };

    return (
        <div className="recently-modern">
            <div className="recently-header">
                <div className="header-left">
                    <div className="header-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                    </div>
                    <div>
                        <h2 className="header-title">Récemment consultés</h2>
                        <p className="header-subtitle">Les produits que vous avez vus récemment</p>
                    </div>
                </div>
                <div className="header-decoration">
                    <span className="product-count">{recentlyViewed.length} produit(s)</span>
                </div>
            </div>

            <div className="recently-carousel">
                {showLeftArrow && (
                    <button onClick={scrollLeft} className="carousel-arrow carousel-arrow-left">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                )}

                <div 
                    ref={scrollRef}
                    onScroll={checkScrollPosition}
                    className="carousel-container"
                >
                    <div className="carousel-track">
                        {recentlyViewed.map((product, index) => (
                            <div key={product._id} className="carousel-item">
                                <div className="product-wrapper">
                                    <ProductCard product={product} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {showRightArrow && (
                    <button onClick={scrollRight} className="carousel-arrow carousel-arrow-right">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                )}
            </div>

            <div className="recently-dots">
                {recentlyViewed.slice(0, 5).map((_, index) => (
                    <span key={index} className="dot" />
                ))}
            </div>

            <style>{`
                .recently-modern {
                    margin-top: 48px;
                    padding: 24px 0;
                    border-top: 1px solid #f0ede8;
                }

                .recently-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding: 0 4px;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .header-icon {
                    width: 44px;
                    height: 44px;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .header-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #111;
                    margin: 0;
                }

                .header-subtitle {
                    font-size: 12px;
                    color: #888;
                    margin: 2px 0 0;
                }

                .header-decoration {
                    padding: 6px 14px;
                    background: #faf8f5;
                    border-radius: 30px;
                }

                .product-count {
                    font-size: 12px;
                    font-weight: 500;
                    color: #e53935;
                }

                .recently-carousel {
                    position: relative;
                }

                .carousel-container {
                    overflow-x: auto;
                    scroll-behavior: smooth;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    padding: 4px 0 8px;
                }

                .carousel-container::-webkit-scrollbar {
                    display: none;
                }

                .carousel-track {
                    display: flex;
                    gap: 16px;
                    min-width: max-content;
                    padding: 0 4px;
                }

                .carousel-item {
                    width: 160px;
                    flex-shrink: 0;
                }

                .product-wrapper {
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .product-wrapper:hover {
                    transform: translateY(-4px);
                }

                .carousel-arrow {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 36px;
                    height: 36px;
                    background: white;
                    border: 1px solid #e8e3dc;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 10;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }

                .carousel-arrow:hover {
                    background: #111;
                    border-color: #111;
                    color: white;
                    transform: translateY(-50%) scale(1.05);
                }

                .carousel-arrow-left {
                    left: -12px;
                }

                .carousel-arrow-right {
                    right: -12px;
                }

                .recently-dots {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 16px;
                }

                .dot {
                    width: 6px;
                    height: 6px;
                    background: #e0dcd5;
                    border-radius: 50%;
                    transition: all 0.2s;
                }

                .dot:first-child {
                    width: 18px;
                    background: #e53935;
                    border-radius: 4px;
                }

                @media (min-width: 640px) {
                    .carousel-item {
                        width: 180px;
                    }
                }

                @media (min-width: 768px) {
                    .carousel-item {
                        width: 200px;
                    }
                }

                @media (max-width: 640px) {
                    .carousel-arrow {
                        display: none;
                    }
                    
                    .recently-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    
                    .carousel-item {
                        width: 140px;
                    }
                }
            `}</style>
        </div>
    );
};

export default RecentlyViewed;