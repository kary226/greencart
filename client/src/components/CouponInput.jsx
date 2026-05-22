import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const CouponInput = ({ amount, onCouponApplied }) => {
    const { axios, user } = useAppContext();
    const [code, setCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleApplyCoupon = async () => {
        if (!code.trim()) {
            toast.error('Entrez un code promo');
            return;
        }

        setLoading(true);
        try {
            const { data } = await axios.post('/api/coupon/validate', {
                code: code,
                amount: amount,
                userId: user?._id
            });

            if (data.success) {
                toast.success(data.message);
                setAppliedCoupon(data.coupon);
                onCouponApplied(data.coupon);
            } else {
                toast.error(data.message);
                setAppliedCoupon(null);
                onCouponApplied(null);
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null);
        setCode('');
        onCouponApplied(null);
        toast.success('Code promo retiré');
    };

    return (
        <div className="mt-4">
            {!appliedCoupon ? (
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Code promo"
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-primary text-sm uppercase"
                    />
                    <button
                        onClick={handleApplyCoupon}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                    >
                        {loading ? '...' : 'Appliquer'}
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div>
                        <span className="font-semibold text-green-700">{appliedCoupon.code}</span>
                        <p className="text-xs text-green-600">
                            Réduction de {appliedCoupon.discountType === 'percentage' 
                                ? `${appliedCoupon.discountValue}%` 
                                : `${appliedCoupon.discountValue} FCFA`}
                        </p>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-red-500 hover:text-red-700 text-sm">
                        Retirer
                    </button>
                </div>
            )}
        </div>
    );
};

export default CouponInput;