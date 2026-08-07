import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { Check, X, Loader2 } from 'lucide-react';

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
            // Vert sémantique (ok-*), pas le rouge de marque : DESIGN.md §2
            // réserve la couleur de statut au statut. Fond plein sans filet —
            // le cran de surface suffit à détacher le bloc (§6).
            <div className="flex items-center justify-between gap-2 rounded-xl bg-ok-50 pl-3.5 pr-1 py-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span aria-hidden="true" className="w-5 h-5 rounded-full bg-ok-500 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-white" strokeWidth={3} />
                    </span>
                    <div className="min-w-0">
                        <p className="text-[13px] font-bold text-ink-900 truncate">{appliedCoupon.code}</p>
                        <p className="text-[11px] font-semibold text-ok-500 tabular-nums">
                            − {appliedCoupon.discountAmount.toLocaleString()} FCFA appliqué
                        </p>
                    </div>
                </div>
                {/* 44×44 : c'était un `p-1` autour d'une icône de 15px, très
                    en dessous de la cible tactile minimale (DESIGN.md §8). */}
                <button
                    onClick={handleRemoveCoupon}
                    aria-label={`Retirer le code ${appliedCoupon.code}`}
                    className="rs-icon-btn shrink-0"
                >
                    <X size={16} />
                </button>
            </div>
        );
    }

    if (!expanded) {
        // L'icône Tag et le mot « Code promo » ont sauté : Cart.jsx pose déjà
        // ce libellé juste au-dessus, le composant le répétait.
        return (
            <button
                type="button"
                onClick={() => setExpanded(true)}
                className="w-full min-h-[44px] flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3.5 text-left transition-colors hover:bg-ink-100"
            >
                <span className="text-[13px] text-ink-500">Vous avez un code ?</span>
                <span className="text-[12px] font-bold text-ramses-700">Ajouter</span>
            </button>
        );
    }

    return (
        <div className="flex gap-2">
            <input
                type="text"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyCoupon();
                    // Échap replie le champ : sans ça, une fois ouvert on ne
                    // pouvait plus le refermer.
                    if (e.key === 'Escape') { setExpanded(false); setCode(''); }
                }}
                placeholder="Entrer le code"
                aria-label="Code promo"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
                className="rs-input flex-1 uppercase tracking-[0.04em] font-semibold"
            />
            {/* Secondaire, pas primaire : l'action primaire rouge du panier est
                déjà « Passer la commande », et DESIGN.md §7 n'en autorise
                qu'une par écran. */}
            <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={loading || !code.trim()}
                className="rs-btn rs-btn--secondary shrink-0"
            >
                {loading ? <Loader2 aria-hidden="true" size={16} className="animate-spin" /> : 'OK'}
            </button>
        </div>
    );
};

export default CouponInput;
