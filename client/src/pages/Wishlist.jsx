import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import { Heart } from 'lucide-react';

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
            <div className="min-h-screen bg-white pt-20 pb-16 px-4">
                <div className="max-w-md mx-auto text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Heart size={40} className="text-gray-300" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Connectez-vous</h2>
                    <p className="text-gray-500 text-sm mb-6">Connectez-vous pour voir vos favoris</p>
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('openLogin'))}
                        className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition shadow-sm"
                    >
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-white pt-20 pb-16 px-4">
                <div className="flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                        <p className="mt-4 text-sm text-gray-500">Chargement de vos favoris...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-16 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Mes favoris</h1>
                    <p className="text-sm text-gray-500 mt-1">Retrouvez tous vos articles préférés</p>
                    <div className="w-16 h-0.5 bg-red-500 rounded-full mt-2"></div>
                    <p className="text-sm text-gray-400 mt-3">{wishlist?.length || 0} article(s)</p>
                </div>

                {!wishlist || wishlist.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Heart size={40} className="text-gray-300" />
                        </div>
                        <p className="text-gray-500">Aucun article dans vos favoris</p>
                        <p className="text-sm text-gray-400 mt-1">Ajoutez des produits à vos favoris pour les retrouver ici</p>
                        <button 
                            onClick={() => window.location.href = '/products'}
                            className="mt-6 bg-red-500 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-red-600 transition shadow-sm"
                        >
                            Découvrir nos produits
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                        {wishlist.map((product) => (
                            <ProductCard key={product._id} product={product} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Wishlist;