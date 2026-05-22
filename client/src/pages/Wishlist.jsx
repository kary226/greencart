import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import ProductCard from '../components/ProductCard';

const Wishlist = () => {
    const { wishlist, fetchWishlist, user } = useAppContext();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadWishlist = async () => {
            if (user) {
                await fetchWishlist();
            }
            setLoading(false);
        };
        loadWishlist();
    }, [user]);

    if (!user) {
        return (
            <div className="mt-16 text-center py-20">
                <p className="text-gray-500">Connectez-vous pour voir vos favoris</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mt-16 text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="mt-16 pb-16">
            <div className="flex flex-col items-start mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Mes favoris</h1>
                <div className="w-20 h-1 bg-primary rounded-full mt-2"></div>
                <p className="text-gray-500 mt-2">{wishlist?.length || 0} article(s)</p>
            </div>

            {!wishlist || wishlist.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-gray-400">Aucun article dans vos favoris</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                    {wishlist.map((product) => (
                        <ProductCard key={product._id} product={product} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Wishlist;