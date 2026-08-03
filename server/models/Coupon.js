import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    
    // Type de réduction
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true },
    
    // Conditions
    minPurchase: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },
    
    // Validité
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    
    // Limites d'utilisation
    usageLimit: { type: Number, default: null }, // Nombre max d'utilisations totales
    usagePerUser: { type: Number, default: 1 }, // 👈 NOUVEAU
    usedCount: { type: Number, default: 0 },
    
    eligibleProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'product' }],
    
    isActive: { type: Boolean, default: true },

    // null = coupon admin, valable sur toute la plateforme (comportement
    // inchangé). Renseigné = coupon créé par un commerçant : la remise ne
    // s'applique alors qu'aux articles de sa boutique dans le panier.
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'boutique',
        default: null,
        index: true,
    },
    
    // Suivi des utilisateurs avec compteur
    usedBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
        count: { type: Number, default: 1 }
    }],
    
}, { timestamps: true });

// Vérifier si le coupon est valide
couponSchema.methods.isValid = function() {
    const now = new Date();
    return (
        this.isActive &&
        now >= this.startDate &&
        now <= this.endDate &&
        (this.usageLimit === null || this.usedCount < this.usageLimit)
    );
};

// Vérifier si un utilisateur peut encore utiliser ce coupon
couponSchema.methods.canUserUse = function(userId) {
    const userRecord = this.usedBy.find(u => u.userId.toString() === userId.toString());
    const userUsedCount = userRecord ? userRecord.count : 0;
    return userUsedCount < this.usagePerUser;
};

// Compter les utilisations d'un utilisateur
couponSchema.methods.getUserUsageCount = function(userId) {
    const userRecord = this.usedBy.find(u => u.userId.toString() === userId.toString());
    return userRecord ? userRecord.count : 0;
};

// Calculer la réduction
couponSchema.methods.calculateDiscount = function(amount) {
    let discount = 0;
    if (this.discountType === 'percentage') {
        discount = (amount * this.discountValue) / 100;
        if (this.maxDiscount) {
            discount = Math.min(discount, this.maxDiscount);
        }
    } else {
        discount = this.discountValue;
    }
    return Math.min(discount, amount);
};

const Coupon = mongoose.models.coupon || mongoose.model('coupon', couponSchema);
export default Coupon;