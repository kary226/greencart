import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { Tag, Check, X, Loader2 } from 'lucide-react';

const CouponInput = ({ amount, items, onCouponApplied }) => {
    const { axios, user } = useAppContext();
    const [expanded, setExpanded] = useState(false);
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
                userId: user?._id,
                items: items || []
            });

            if (data.success) {
                toast.success(data.message);
                setAppliedCoupon(data.coupon);
                setExpanded(false);
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

    if (appliedCoupon) {
        return (
            <div className="mb-1 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-white" strokeWidth={3} />
                    </span>
                    <div className="min-w-0">
                        <span className="text-sm font-semibold text-emerald-700 tracking-wide">{appliedCoupon.code}</span>
                        <p className="text-[11px] text-emerald-600">
                            - {appliedCoupon.discountAmount.toLocaleString()} FCFA appliqué
                        </p>
                    </div>
                </div>
                <button onClick={handleRemoveCoupon} className="text-emerald-500 hover:text-emerald-700 shrink-0 p-1">
                    <X size={15} />
                </button>
            </div>
        );
    }

    if (!expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                className="mb-1 w-full flex items-center justify-between bg-blush-50 hover:bg-blush-100 transition rounded-xl px-3.5 py-2.5"
            >
                <span className="flex items-center gap-2 text-sm text-gray-500">
                    <Tag size={14} className="text-burgundy-500" /> Code promo
                </span>
                <span className="text-xs font-semibold text-burgundy-700">Ajouter</span>
            </button>
        );
    }

    return (
        <div className="mb-1 flex gap-2">
            <input
                type="text"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyCoupon(); }}
                placeholder="Entrer le code"
                className="flex-1 bg-blush-50 border border-transparent focus:border-burgundy-400 rounded-xl px-3.5 py-2.5 outline-none text-sm uppercase text-gray-700"
            />
            <button
                onClick={handleApplyCoupon}
                disabled={loading}
                className="px-4 bg-burgundy-600 text-white rounded-xl text-sm font-medium hover:bg-burgundy-700 transition disabled:opacity-50 flex items-center justify-center"
            >
                {loading ? <Loader2 size={15} className="animate-spin" /> : 'OK'}
            </button>
        </div>
    );
};

export default CouponInput;