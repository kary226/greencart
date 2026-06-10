import React from 'react';
import { useAppContext } from '../context/AppContext';
import ProductCard from './ProductCard';

const RecentlyViewed = () => {
    const { recentlyViewed } = useAppContext();

    if (!recentlyViewed || recentlyViewed.length === 0) {
        return null;
    }

    return (
        <div className='mt-8 px-4'>
            <div className='flex items-center gap-3 mb-5'>
                <div className='bg-gradient-to-r from-primary to-primary-dark text-white p-2 rounded-xl shadow-md'>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                </div>
                <div>
                    <h2 className='text-lg font-semibold text-gray-800'>Récemment consultés</h2>
                    <p className='text-xs text-gray-400'>Produits que vous avez vus récemment</p>
                </div>
            </div>

            <div className='overflow-x-auto scrollbar-hide pb-4'>
                <div className='flex gap-3 md:gap-4' style={{ minWidth: 'max-content' }}>
                    {recentlyViewed.map((product) => (
                        <div key={product._id} className='w-[140px] sm:w-[170px] md:w-[200px] flex-shrink-0'>
                            <ProductCard product={product} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecentlyViewed;