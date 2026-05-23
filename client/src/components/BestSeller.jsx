import React, { useEffect, useState } from 'react'
import ProductCard from './ProductCard'
import { useAppContext } from '../context/AppContext';

const BestSeller = () => {
    const { axios } = useAppContext();
    const [bestSellers, setBestSellers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBestSellers();
    }, []);

    const fetchBestSellers = async () => {
        try {
            const { data } = await axios.get('/api/product/bestsellers');
            if (data.success) {
                setBestSellers(data.products);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className='mt-16'>
                <p className='text-2xl md:text-3xl font-medium'>Best Sellers</p>
                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-6 lg:grid-cols-5 mt-6'>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className='animate-pulse bg-gray-200 h-64 rounded-lg'></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className='mt-16'>
            <p className='text-2xl md:text-3xl font-medium'>Best Sellers</p>
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-6 lg:grid-cols-5 mt-6'>
                {bestSellers.slice(0, 5).map((product, index) => (
                    <ProductCard key={index} product={product} />
                ))}
            </div>
        </div>
    );
};

export default BestSeller;