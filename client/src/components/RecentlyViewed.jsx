import React from 'react';
import { useAppContext } from '../context/AppContext';
import ProductCard from './ProductCard';

const RecentlyViewed = () => {
    const { recentlyViewed } = useAppContext();

    if (!recentlyViewed || recentlyViewed.length === 0) {
        return null;
    }

    return (
        <div className='mt-16 px-4'>
            <div className='flex justify-between items-center mb-6'>
                <div>
                    <h2 className='text-2xl font-medium'>🕒 Récemment vus</h2>
                    <div className='w-16 h-0.5 bg-primary rounded-full mt-1'></div>
                </div>
            </div>

            <div className='overflow-x-auto scrollbar-hide pb-4'>
                <div className='flex gap-4 md:gap-6' style={{ minWidth: 'max-content' }}>
                    {recentlyViewed.map((product) => (
                        <div key={product._id} className='w-[160px] sm:w-[200px] md:w-[220px] flex-shrink-0'>
                            <ProductCard product={product} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecentlyViewed;