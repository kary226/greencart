import Coupon from "../models/Coupon.js";

// ==================== ADMIN ====================

export const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json({ success: true, coupons });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const addCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, minPurchase, maxDiscount, startDate, endDate, usageLimit, usagePerUser, eligibleProducts } = req.body;
        
        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.json({ success: false, message: "Ce code promo existe déjà" });
        }
        
        const coupon = await Coupon.create({
            code: code.toUpperCase(),
            discountType,
            discountValue: Number(discountValue),
            minPurchase: minPurchase ? Number(minPurchase) : 0,
            maxDiscount: maxDiscount ? Number(maxDiscount) : null,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            usageLimit: usageLimit ? Number(usageLimit) : null,
            usagePerUser: usagePerUser ? Number(usagePerUser) : 1,
            eligibleProducts: eligibleProducts || []
        });
        
        res.json({ success: true, message: "Code promo ajouté", coupon });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const updateCoupon = async (req, res) => {
    try {
        const { id, code, discountType, discountValue, minPurchase, maxDiscount, startDate, endDate, usageLimit, usagePerUser, eligibleProducts, isActive } = req.body;
        
        await Coupon.findByIdAndUpdate(id, {
            code: code.toUpperCase(),
            discountType,
            discountValue: Number(discountValue),
            minPurchase: minPurchase ? Number(minPurchase) : 0,
            maxDiscount: maxDiscount ? Number(maxDiscount) : null,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            usageLimit: usageLimit ? Number(usageLimit) : null,
            usagePerUser: usagePerUser ? Number(usagePerUser) : 1,
            eligibleProducts: eligibleProducts || [],
            isActive
        });
        
        res.json({ success: true, message: "Code promo modifié" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.body;
        await Coupon.findByIdAndDelete(id);
        res.json({ success: true, message: "Code promo supprimé" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const toggleCouponStatus = async (req, res) => {
    try {
        const { id, isActive } = req.body;
        await Coupon.findByIdAndUpdate(id, { isActive });
        res.json({ success: true, message: isActive ? "Code promo activé" : "Code promo désactivé" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ==================== CLIENT ====================

export const validateCoupon = async (req, res) => {
    try {
        const { code, amount, userId } = req.body;
        
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return res.json({ success: false, message: "Code promo invalide" });
        }
        
        if (!coupon.isValid()) {
            return res.json({ success: false, message: "Code promo expiré ou désactivé" });
        }
        
        if (amount < coupon.minPurchase) {
            return res.json({ success: false, message: `Montant minimum d'achat: ${coupon.minPurchase} FCFA` });
        }
        
        // Vérifier si l'utilisateur peut encore utiliser ce coupon
        if (userId && !coupon.canUserUse(userId)) {
            const usedCount = coupon.getUserUsageCount(userId);
            return res.json({ success: false, message: `Vous avez déjà utilisé ce code promo ${usedCount} fois (max: ${coupon.usagePerUser})` });
        }
        
        const discount = coupon.calculateDiscount(amount);
        const newAmount = amount - discount;
        
        res.json({
            success: true,
            message: "Code promo valide",
            coupon: {
                id: coupon._id,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                discountAmount: discount,
                newAmount: newAmount,
                usagePerUser: coupon.usagePerUser,
                currentUserUsage: userId ? coupon.getUserUsageCount(userId) : 0
            }
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const applyCoupon = async (req, res) => {
    try {
        const { couponId, userId } = req.body;
        
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.json({ success: false, message: "Code promo invalide" });
        }
        
        // Vérifier à nouveau avant d'appliquer
        if (!coupon.canUserUse(userId)) {
            return res.json({ success: false, message: "Vous avez atteint la limite d'utilisation de ce code promo" });
        }
        
        // Incrémenter le compteur global
        coupon.usedCount += 1;
        
        // Gérer le compteur par utilisateur
        const userRecord = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
        if (userRecord) {
            userRecord.count += 1;
        } else {
            coupon.usedBy.push({ userId, count: 1 });
        }
        
        await coupon.save();
        
        res.json({ success: true, message: "Code promo appliqué" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};