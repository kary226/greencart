import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getPresetImageUrl } from '../utils/cloudinaryImage';

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
        navigate(`/products?categories=${slug}`);
        scrollTo(0, 0);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111]"></div>
            </div>
        );
    }

    const activeCategories = categories.filter(cat => cat.active !== false);

    return (
        <div className="ramci-categories-page">
            {/* Header */}
            <div className="ramci-categories-header">
                <h1 className="ramci-categories-title">Toutes nos catégories</h1>
                <p className="ramci-categories-subtitle">Découvrez notre sélection de produits par catégorie</p>
            </div>

            {activeCategories.length === 0 ? (
                <div className="ramci-categories-empty">
                    <p>Aucune catégorie disponible pour le moment.</p>
                </div>
            ) : (
                <div className="ramci-categories-grid">
                    {/* Lien "Tous" */}
                    <div
                        onClick={() => {
                            navigate('/products');
                            scrollTo(0, 0);
                        }}
                        className="ramci-cat-item ramci-cat-item-clickable"
                    >
                        <div className="ramci-cat-circle ramci-cat-circle-all">
                            <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
                                <rect x="0" y="0" width="9" height="9" rx="2"/>
                                <rect x="13" y="0" width="9" height="9" rx="2"/>
                                <rect x="0" y="13" width="9" height="9" rx="2"/>
                                <rect x="13" y="13" width="9" height="9" rx="2"/>
                            </svg>
                        </div>
                        <span className="ramci-cat-label">Tous</span>
                    </div>

                    {/* Catégories */}
                    {activeCategories.map((cat) => (
                        <div
                            key={cat._id}
                            onClick={() => handleCategoryClick(cat.slug || cat.name)}
                            className="ramci-cat-item ramci-cat-item-clickable"
                        >
                            <div className="ramci-cat-circle">
                                {cat.image
                                    ? <img src={getPresetImageUrl(cat.image, "thumbnail")} alt={cat.name} className="ramci-cat-img" loading="lazy" />
                                    : <span className="ramci-cat-placeholder">{cat.name?.[0]}</span>
                                }
                            </div>
                            <span className="ramci-cat-label">{cat.name}</span>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .ramci-categories-page {
                    background: #faf8f5;
                    min-height: 100vh;
                    padding: 20px 16px 40px;
                }

                .ramci-categories-header {
                    text-align: center;
                    margin-bottom: 28px;
                }

                .ramci-categories-title {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 22px;
                    font-weight: 700;
                    color: #111;
                    margin: 0 0 8px 0;
                }

                .ramci-categories-subtitle {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    color: #888;
                    margin: 0;
                }

                .ramci-categories-empty {
                    text-align: center;
                    padding: 60px 20px;
                    font-family: 'DM Sans', sans-serif;
                    color: #aaa;
                }

                /* Grille 2 colonnes identique à l'accueil */
                .ramci-categories-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px 12px;
                    max-width: 500px;
                    margin: 0 auto;
                }

                .ramci-cat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    text-decoration: none;
                    padding: 8px 4px;
                }

                .ramci-cat-item-clickable {
                    cursor: pointer;
                }

                .ramci-cat-circle {
                    width: 100%;
                    max-width: 110px;
                    aspect-ratio: 1 / 1;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 2px solid #e8e3dc;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                }

                .ramci-cat-item-clickable:hover .ramci-cat-circle {
                    border-color: #111;
                    transform: scale(1.02);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                }

                .ramci-cat-circle-all {
                    background: #111;
                    color: #fff;
                    border-color: #111;
                }

                .ramci-cat-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .ramci-cat-placeholder {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 28px;
                    font-weight: 600;
                    color: #bbb;
                }

                .ramci-cat-label {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 12px;
                    font-weight: 500;
                    color: #333;
                    text-align: center;
                    line-height: 1.3;
                    max-width: 100%;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    padding: 0 4px;
                }

                /* Responsive : sur grands écrans on limite la taille */
                @media (min-width: 600px) {
                    .ramci-categories-grid {
                        max-width: 550px;
                    }
                    .ramci-cat-circle {
                        max-width: 120px;
                    }
                }
            `}</style>
        </div>
    );
};

export default AllCategories;