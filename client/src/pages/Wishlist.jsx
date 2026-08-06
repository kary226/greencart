import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import { Heart } from 'lucide-react';

const Wishlist = () => {
    const { wishlist, fetchWishlist, user, setShowUserLogin } = useAppContext();
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
            <div className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-ramses-50 flex items-center justify-center mx-auto mb-5">
                        <Heart size={32} className="text-ramses-600" />
                    </div>
                    <h2 className="rs-h1 mb-2">Connectez-vous</h2>
                    <p className="text-ink-400 text-[14px] mb-7 max-w-[280px] mx-auto">
                        Vos favoris sont enregistrés sur votre compte, vous les retrouverez sur tous vos appareils.
                    </p>
                    <button onClick={() => setShowUserLogin(true)} className="rs-btn rs-btn--primary">
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center gap-3">
                <div className="rs-typing"><span /><span /><span /></div>
                <p className="text-[13px] text-ink-400">Chargement de vos favoris…</p>
            </div>
        );
    }

    const nb = wishlist?.length || 0;

    return (
        <div className="min-h-screen bg-ink-50 pt-6 pb-16 px-4">
            <div className="max-w-7xl mx-auto">

                <header className="mb-5">
                    <h1 className="rs-display">Mes favoris</h1>
                    <p className="text-[13px] text-ink-400 mt-1.5">
                        {nb} article{nb > 1 ? 's' : ''}
                    </p>
                </header>

                {nb === 0 ? (
                    <div className="rs-card text-center py-16">
                        <div className="w-16 h-16 rounded-full bg-ramses-50 flex items-center justify-center mx-auto mb-4">
                            <Heart size={26} className="text-ramses-600" />
                        </div>
                        <p className="rs-h2 mb-1.5">Aucun favori pour l'instant</p>
                        <p className="text-[13px] text-ink-400 mb-6 max-w-[300px] mx-auto leading-relaxed">
                            Touchez le cœur sur un article pour le retrouver ici, sur tous vos appareils.
                        </p>
                        {/* <Link> et non window.location.href : la version d'origine
                            rechargeait toute l'application pour un simple changement
                            de page, ce qui vidait le panier en mémoire et rejouait
                            tous les appels réseau. */}
                        <Link to="/products" className="rs-btn rs-btn--primary">
                            Découvrir nos produits
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
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
