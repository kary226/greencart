import Coupon from "../models/Coupon.js";
import Product from "../models/Product.js";

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

// ==================== COMMERÇANT ====================
// Un commerçant ne voit/gère que ses propres coupons (boutiqueId = sa
// boutique) et ne peut cibler que ses propres produits.

export const getMesCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ boutiqueId: req.staffUser.boutiqueId }).sort({ createdAt: -1 });
        res.json({ success: true, coupons });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Vérifie que chaque id d'eligibleProducts appartient bien à la boutique
// du commerçant — sinon il pourrait cibler (et remiser) les produits
// d'un autre vendeur.
const filtrerProduitsDeLaBoutique = async (eligibleProducts, boutiqueId) => {
    if (!eligibleProducts || eligibleProducts.length === 0) return [];
    const produits = await Product.find({ _id: { $in: eligibleProducts }, boutiqueId }).select('_id');
    return produits.map((p) => p._id);
};

export const addMonCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, minPurchase, maxDiscount, startDate, endDate, usageLimit, usagePerUser, eligibleProducts } = req.body;
        const boutiqueId = req.staffUser.boutiqueId;
        if (!boutiqueId) {
            return res.json({ success: false, message: "Vous n'avez pas de boutique" });
        }

        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.json({ success: false, message: "Ce code promo existe déjà" });
        }

        const produitsAutorises = await filtrerProduitsDeLaBoutique(eligibleProducts, boutiqueId);

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
            eligibleProducts: produitsAutorises,
            boutiqueId,
        });

        res.json({ success: true, message: "Code promo ajouté", coupon });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const updateMonCoupon = async (req, res) => {
    try {
        const { id, code, discountType, discountValue, minPurchase, maxDiscount, startDate, endDate, usageLimit, usagePerUser, eligibleProducts, isActive } = req.body;
        const boutiqueId = req.staffUser.boutiqueId;

        const coupon = await Coupon.findOne({ _id: id, boutiqueId });
        if (!coupon) {
            return res.json({ success: false, message: "Code promo introuvable" });
        }

        const produitsAutorises = await filtrerProduitsDeLaBoutique(eligibleProducts, boutiqueId);

        coupon.code = code.toUpperCase();
        coupon.discountType = discountType;
        coupon.discountValue = Number(discountValue);
        coupon.minPurchase = minPurchase ? Number(minPurchase) : 0;
        coupon.maxDiscount = maxDiscount ? Number(maxDiscount) : null;
        coupon.startDate = new Date(startDate);
        coupon.endDate = new Date(endDate);
        coupon.usageLimit = usageLimit ? Number(usageLimit) : null;
        coupon.usagePerUser = usagePerUser ? Number(usagePerUser) : 1;
        coupon.eligibleProducts = produitsAutorises;
        if (isActive !== undefined) coupon.isActive = isActive;
        await coupon.save();

        res.json({ success: true, message: "Code promo modifié" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const deleteMonCoupon = async (req, res) => {
    try {
        const { id } = req.body;
        const result = await Coupon.findOneAndDelete({ _id: id, boutiqueId: req.staffUser.boutiqueId });
        if (!result) {
            return res.json({ success: false, message: "Code promo introuvable" });
        }
        res.json({ success: true, message: "Code promo supprimé" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const toggleMonCouponStatus = async (req, res) => {
    try {
        const { id, isActive } = req.body;
        const result = await Coupon.findOneAndUpdate({ _id: id, boutiqueId: req.staffUser.boutiqueId }, { isActive });
        if (!result) {
            return res.json({ success: false, message: "Code promo introuvable" });
        }
        res.json({ success: true, message: isActive ? "Code promo activé" : "Code promo désactivé" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ==================== CLIENT ====================

export const validateCoupon = async (req, res) => {
    try {
        const { code, amount, userId, items } = req.body;
        
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return res.json({ success: false, message: "Code promo invalide" });
        }
        
        if (!coupon.isValid()) {
            return res.json({ success: false, message: "Code promo expiré ou désactivé" });
        }

        // Un coupon commerçant (boutiqueId renseigné) ne s'applique qu'aux
        // articles de sa boutique dans le panier — recalculé ici à partir
        // des produits réels si le panier détaillé est fourni. Un coupon
        // admin garde le comportement inchangé (remise sur 'amount' brut).
        let baseAmount = amount;
        if (coupon.boutiqueId && Array.isArray(items)) {
            const productIds = items.map((it) => it.product);
            const produits = await Product.find({ _id: { $in: productIds } }).select('offerPrice boutiqueId');
            const produitsById = Object.fromEntries(produits.map((p) => [p._id.toString(), p]));
            baseAmount = items.reduce((sum, it) => {
                const p = produitsById[it.product];
                if (!p || !p.boutiqueId || p.boutiqueId.toString() !== coupon.boutiqueId.toString()) return sum;
                if (coupon.eligibleProducts.length > 0 && !coupon.eligibleProducts.some((el) => el.toString() === it.product)) return sum;
                return sum + p.offerPrice * it.quantity;
            }, 0);
        }
        
        if (baseAmount < coupon.minPurchase) {
            return res.json({ success: false, message: `Montant minimum d'achat: ${coupon.minPurchase} FCFA` });
        }
        
        // Vérifier si l'utilisateur peut encore utiliser ce coupon
        if (userId && !coupon.canUserUse(userId)) {
            const usedCount = coupon.getUserUsageCount(userId);
            return res.json({ success: false, message: `Vous avez déjà utilisé ce code promo ${usedCount} fois (max: ${coupon.usagePerUser})` });
        }
        
        const discount = coupon.calculateDiscount(baseAmount);
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