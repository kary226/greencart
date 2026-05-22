import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const AllCategories = () => {
    const { axios, navigate } = useAppContext();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/category/list');
            if (data.success) {
                setCategories(data.categories);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleCategoryClick = (slug) => {
        navigate(`/products/${slug}`);
        scrollTo(0, 0);
    };

    if (loading) {
        return (
            <div className="mt-16 pb-16">
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-16 pb-16">
            <div className="flex flex-col items-start mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Toutes nos catégories</h1>
                <div className="w-20 h-1 bg-primary rounded-full mt-2"></div>
                <p className="text-gray-500 mt-2">Découvrez notre sélection de produits par catégorie</p>
            </div>

            {categories.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-gray-400">Aucune catégorie disponible pour le moment.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                    {categories.map((category) => (
                        <div
                            key={category._id}
                            onClick={() => handleCategoryClick(category.slug)}
                            className="group cursor-pointer bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 text-center"
                        >
                            {/* Cercle avec ombre et effet hover */}
                            <div
                                className="w-28 h-28 mx-auto rounded-full flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                                style={{ backgroundColor: category.bgColor || '#f0f0f0' }}
                            >
                                {category.image ? (
                                    <img
                                        src={category.image}
                                        alt={category.name}
                                        className="w-20 h-20 object-cover rounded-full"
                                    />
                                ) : (
                                    <svg className="w-14 h-14 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                                        <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" fill="none" />
                                    </svg>
                                )}
                            </div>
                            <h3 className="font-semibold text-gray-800 text-base md:text-lg mt-2">{category.name}</h3>
                            <p className="text-xs text-gray-400 mt-1">Cliquez pour découvrir</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AllCategories;