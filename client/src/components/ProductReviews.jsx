import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const ProductReviews = ({ productId, onDataChange }) => {
    const { axios, user } = useAppContext();
    const [reviews, setReviews] = useState([]);
    const [averageRating, setAverageRating] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [hoverRating, setHoverRating] = useState(0);

    const fetchReviews = async () => {
        try {
            const { data } = await axios.get(`/api/review/product/${productId}`);
            if (data.success) {
                setReviews(data.reviews);
                setAverageRating(data.averageRating);
                setTotalReviews(data.totalReviews);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [productId]);

    useEffect(() => {
        if (!loading && onDataChange) {
            onDataChange({
                averageRating: averageRating,
                totalReviews: totalReviews
            });
        }
    }, [averageRating, totalReviews, loading, onDataChange]);

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (!user) {
            toast.error('Connectez-vous pour laisser un avis');
            return;
        }
        if (!comment.trim()) {
            toast.error('Veuillez écrire un commentaire');
            return;
        }

        try {
            const { data } = await axios.post('/api/review/add', {
                productId,
                rating,
                comment
            });
            if (data.success) {
                toast.success(data.message);
                setShowForm(false);
                setRating(5);
                setComment('');
                fetchReviews();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const markHelpful = async (reviewId) => {
        if (!user) {
            toast.error('Connectez-vous pour marquer un avis utile');
            return;
        }
        try {
            const { data } = await axios.post(`/api/review/helpful/${reviewId}`);
            if (data.success) {
                toast.success(data.message);
                fetchReviews();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const renderStars = (ratingValue, interactive = false, onRatingChange = null, onHover = null) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => interactive && onRatingChange && onRatingChange(star)}
                        onMouseEnter={() => interactive && onHover && onHover(star)}
                        onMouseLeave={() => interactive && onHover && onHover(0)}
                        className={interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"}
                        disabled={!interactive}
                        aria-label={`Noter ${star} étoiles`}
                    >
                        <svg
                            className={`w-5 h-5 transition-colors ${
                                star <= (interactive ? hoverRating || ratingValue : ratingValue)
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-gray-300 fill-gray-300'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </button>
                ))}
            </div>
        );
    };

    // Calcul des pourcentages d'étoiles pour le graphique
    const getRatingPercentages = () => {
        const percentages = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        if (reviews.length === 0) return percentages;
        
        reviews.forEach(review => {
            if (review.rating >= 1 && review.rating <= 5) {
                percentages[review.rating]++;
            }
        });
        
        Object.keys(percentages).forEach(key => {
            percentages[key] = (percentages[key] / reviews.length) * 100;
        });
        
        return percentages;
    };

    const ratingPercentages = getRatingPercentages();

    if (loading) {
        return (
            <div className="mt-8 text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto"></div>
                <p className="mt-3 text-sm text-gray-400">Chargement des avis...</p>
            </div>
        );
    }

    return (
        <div className="reviews-modern">
            {/* En-tête avec statistiques */}
            <div className="reviews-header">
                <div className="reviews-stats">
                    <div className="stats-rating">
                        <span className="rating-number">{averageRating.toFixed(1)}</span>
                        <span className="rating-max">/5</span>
                        <div className="rating-stars">
                            {renderStars(Math.round(averageRating))}
                        </div>
                        <span className="rating-count">({totalReviews} avis)</span>
                    </div>
                    <div className="stats-bars">
                        {[5, 4, 3, 2, 1].map(star => (
                            <div key={star} className="stat-bar-item">
                                <span className="stat-star">{star} ★</span>
                                <div className="stat-bar-bg">
                                    <div 
                                        className="stat-bar-fill"
                                        style={{ width: `${ratingPercentages[star]}%` }}
                                    />
                                </div>
                                <span className="stat-percent">{Math.round(ratingPercentages[star])}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="reviews-action">
                    {!showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="write-review-btn"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14m-7-7h14"/>
                            </svg>
                            Donner mon avis
                        </button>
                    )}
                </div>
            </div>

            {/* Formulaire d'avis */}
            {showForm && (
                <div className="review-form">
                    <div className="form-header">
                        <h4>Votre avis</h4>
                        <button onClick={() => setShowForm(false)} className="form-close">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <div className="form-rating">
                        <span className="rating-label">Votre note :</span>
                        {renderStars(rating, true, setRating, setHoverRating)}
                    </div>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Partagez votre expérience avec ce produit..."
                        rows={4}
                        className="form-textarea"
                    />
                    <div className="form-actions">
                        <button onClick={() => setShowForm(false)} className="btn-cancel">
                            Annuler
                        </button>
                        <button onClick={handleSubmitReview} className="btn-submit">
                            Publier mon avis
                        </button>
                    </div>
                </div>
            )}

            {/* Liste des avis */}
            {reviews.length === 0 ? (
                <div className="reviews-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <p>Soyez le premier à donner votre avis</p>
                    <button onClick={() => setShowForm(true)} className="empty-action-btn">
                        Donner mon avis
                    </button>
                </div>
            ) : (
                <div className="reviews-list">
                    {reviews.map((review) => (
                        <div key={review._id} className="review-card">
                            <div className="review-header">
                                <div className="reviewer-info">
                                    <div className="reviewer-avatar">
                                        {review.userName?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <span className="reviewer-name">{review.userName}</span>
                                        {review.verified && (
                                            <span className="verified-badge">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <polyline points="20 6 9 17 4 12"/>
                                                </svg>
                                                Achat vérifié
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="review-date">
                                    {new Date(review.createdAt).toLocaleDateString('fr-FR', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                </div>
                            </div>
                            <div className="review-rating">
                                {renderStars(review.rating)}
                            </div>
                            <p className="review-comment">{review.comment}</p>
                            <div className="review-footer">
                                <button
                                    onClick={() => markHelpful(review._id)}
                                    className="helpful-btn"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                                    </svg>
                                    Utile ({review.helpful || 0})
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .reviews-modern {
                    background: #fff;
                    border-radius: 20px;
                    padding: 8px 0;
                }

                .reviews-header {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 24px;
                    margin-bottom: 32px;
                    padding-bottom: 24px;
                    border-bottom: 1px solid #f0ede8;
                }

                .reviews-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 32px;
                    align-items: center;
                }

                .stats-rating {
                    text-align: center;
                    min-width: 100px;
                }

                .rating-number {
                    font-size: 48px;
                    font-weight: 700;
                    color: #111;
                    line-height: 1;
                }

                .rating-max {
                    font-size: 20px;
                    color: #999;
                    font-weight: 500;
                }

                .rating-stars {
                    margin: 8px 0 4px;
                }

                .rating-count {
                    font-size: 12px;
                    color: #888;
                }

                .stats-bars {
                    flex: 1;
                    min-width: 200px;
                }

                .stat-bar-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                }

                .stat-star {
                    font-size: 12px;
                    color: #666;
                    width: 40px;
                }

                .stat-bar-bg {
                    flex: 1;
                    height: 6px;
                    background: #f0ede8;
                    border-radius: 3px;
                    overflow: hidden;
                }

                .stat-bar-fill {
                    height: 100%;
                    background: #e53935;
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }

                .stat-percent {
                    font-size: 11px;
                    color: #888;
                    width: 40px;
                    text-align: right;
                }

                .write-review-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    background: #111;
                    color: white;
                    border: none;
                    border-radius: 40px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .write-review-btn:hover {
                    background: #e53935;
                    transform: scale(1.02);
                }

                .review-form {
                    background: #faf8f5;
                    border-radius: 16px;
                    padding: 20px;
                    margin-bottom: 32px;
                    border: 1px solid #f0ede8;
                }

                .form-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .form-header h4 {
                    font-size: 16px;
                    font-weight: 600;
                    color: #111;
                    margin: 0;
                }

                .form-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    color: #999;
                    transition: color 0.2s;
                }

                .form-close:hover {
                    color: #e53935;
                }

                .form-rating {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .rating-label {
                    font-size: 13px;
                    color: #666;
                }

                .form-textarea {
                    width: 100%;
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    padding: 12px;
                    font-size: 13px;
                    outline: none;
                    resize: vertical;
                    font-family: inherit;
                    transition: border-color 0.2s;
                }

                .form-textarea:focus {
                    border-color: #e53935;
                }

                .form-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 16px;
                    justify-content: flex-end;
                }

                .btn-cancel {
                    padding: 8px 20px;
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 40px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-cancel:hover {
                    background: #f5f5f5;
                }

                .btn-submit {
                    padding: 8px 24px;
                    background: #111;
                    color: white;
                    border: none;
                    border-radius: 40px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-submit:hover {
                    background: #e53935;
                }

                .reviews-empty {
                    text-align: center;
                    padding: 40px 20px;
                    background: #faf8f5;
                    border-radius: 16px;
                }

                .reviews-empty svg {
                    margin-bottom: 12px;
                }

                .reviews-empty p {
                    color: #888;
                    font-size: 14px;
                    margin-bottom: 16px;
                }

                .empty-action-btn {
                    padding: 8px 24px;
                    background: #111;
                    color: white;
                    border: none;
                    border-radius: 40px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .empty-action-btn:hover {
                    background: #e53935;
                }

                .reviews-list {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .review-card {
                    background: #fff;
                    border-bottom: 1px solid #f0ede8;
                    padding-bottom: 20px;
                }

                .review-card:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }

                .review-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    flex-wrap: wrap;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .reviewer-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .reviewer-avatar {
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #e53935, #c62828);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 600;
                    font-size: 16px;
                }

                .reviewer-name {
                    font-weight: 600;
                    color: #111;
                    font-size: 14px;
                }

                .verified-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    margin-left: 8px;
                    font-size: 11px;
                    color: #10b981;
                    background: #e8f5e9;
                    padding: 2px 8px;
                    border-radius: 20px;
                }

                .review-date {
                    font-size: 11px;
                    color: #aaa;
                }

                .review-rating {
                    margin-bottom: 10px;
                }

                .review-comment {
                    font-size: 13px;
                    color: #555;
                    line-height: 1.5;
                    margin-bottom: 12px;
                }

                .review-footer {
                    display: flex;
                    justify-content: flex-end;
                }

                .helpful-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: none;
                    border: none;
                    font-size: 12px;
                    color: #999;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 20px;
                    transition: all 0.2s;
                }

                .helpful-btn:hover {
                    background: #f5f5f5;
                    color: #e53935;
                }

                @media (max-width: 640px) {
                    .reviews-stats {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    
                    .stats-bars {
                        width: 100%;
                    }
                    
                    .reviews-header {
                        flex-direction: column;
                    }
                    
                    .write-review-btn {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    );
};

export default ProductReviews;