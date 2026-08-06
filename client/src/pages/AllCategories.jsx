import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getPresetImageUrl } from '../utils/cloudinaryImage';
// Le rail de pastilles vient de home.css ; cette feuille ne surcharge que
// ce qui differe sur cette page (voir DESIGN.md a la racine).
import '../styles/home.css';
import '../styles/all-categories.css';

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
            <div className="min-h-screen bg-ink-0 flex flex-col items-center justify-center gap-3">
                <div className="rs-typing"><span /><span /><span /></div>
                <p className="text-[13px] text-ink-400">Chargement des catégories…</p>
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
                    <button
                        type="button"
                        onClick={() => { navigate('/products'); scrollTo(0, 0); }}
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
                    </button>

                    {/* Catégories */}
                    {activeCategories.map((cat) => (
                        <button
                            type="button"
                            key={cat._id}
                            onClick={() => handleCategoryClick(cat.slug || cat.name)}
                            className="ramci-cat-item ramci-cat-item-clickable"
                        >
                            <div className="ramci-cat-circle">
                                {cat.image
                                    ? <img src={getPresetImageUrl(cat.image, "categoryIcon")} alt={cat.name} className="ramci-cat-img" loading="lazy" />
                                    : <span className="ramci-cat-placeholder">{cat.name?.[0]}</span>
                                }
                            </div>
                            <span className="ramci-cat-label">{cat.name}</span>
                        </button>
                    ))}
                </div>
            )}
            
        </div>
    );
};

export default AllCategories;