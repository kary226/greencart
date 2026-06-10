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
                        className={interactive ? "cursor-pointer" : "cursor-default"}
                        disabled={!interactive}
                    >
                        <svg
                            className={`w-5 h-5 ${
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

    if (loading) {
        return <div className="mt-8 text-center py-4 text-gray-400">Chargement des avis...</div>;
    }

    return (
        <div className="mt-8 border-t border-gray-100 pt-6">
            <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white p-2 rounded-xl shadow-md">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Avis clients</h3>
                        <div className="flex items-center gap-2 mt-1">
                            {renderStars(averageRating)}
                            <span className="text-sm font-medium">{averageRating}/5</span>
                            <span className="text-xs text-gray-400">({totalReviews} avis)</span>
                        </div>
                    </div>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl text-sm font-medium hover:opacity-90 transition shadow-md"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14m-7-7h14"/>
                        </svg>
                        Donner mon avis
                    </button>
                )}
            </div>

            {showForm && (
                <form onSubmit={handleSubmitReview} className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                        <p className="font-medium text-sm">Votre note :</p>
                        {renderStars(rating, true, setRating, setHoverRating)}
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="text-gray-400 hover:text-gray-600 text-lg"
                        >
                            ✕
                        </button>
                    </div>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Partagez votre expérience avec ce produit..."
                        rows={4}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-primary resize-none"
                    />
                    <button
                        type="submit"
                        className="mt-3 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition"
                    >
                        Publier mon avis
                    </button>
                </form>
            )}

            <div className="space-y-5">
                {reviews.length === 0 ? (
                    <p className="text-gray-400 text-center py-6 text-sm">Aucun avis pour le moment. Soyez le premier !</p>
                ) : (
                    reviews.map((review) => (
                        <div key={review._id} className="border-b border-gray-100 pb-4">
                            <div className="flex justify-between items-start flex-wrap gap-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{review.userName}</span>
                                        {review.verified && (
                                            <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                                                ✓ Achat vérifié
                                            </span>
                                        )}
                                    </div>
                                    {renderStars(review.rating)}
                                </div>
                                <span className="text-xs text-gray-400">
                                    {new Date(review.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-gray-600 mt-2 text-sm">{review.comment}</p>
                            <button
                                onClick={() => markHelpful(review._id)}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary mt-2 transition"
                            >
                                👍 Utile ({review.helpful || 0})
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ProductReviews;