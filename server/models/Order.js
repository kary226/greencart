import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
    product: { type: String, required: true, ref: 'product' },
    quantity: { type: Number, required: true },
    color: { type: String, default: null },
    size: { type: String, default: null },
    priceAtOrder: { type: Number, required: true },
    // ✅ NOUVEAU PHASE 3 : Boutique du produit au moment de la commande.
    // [FIX] null est une valeur valide et volontaire (produit du magasin
    // principal, hors système commerçant) — geniuspayController.js et
    // orderController.js écrivent explicitement `product.boutiqueId || null`.
    // required:true rejetait donc toute commande contenant un produit
    // "normal", ce qui est la quasi-totalité des commandes.
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'boutique',
        default: null,
    }
});

const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true, ref: 'user' },
    items: [orderItemSchema],
    amount: { type: Number, required: true },
    deliveryPrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    couponApplied: { type: String, default: null },
    address: { type: String, required: true, ref: 'address' },
    status: { 
        type: String, 
        default: 'pending_payment',
        enum: ['pending_payment', 'Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled']
    },
    paymentType: { type: String, required: true },
    isPaid: { type: Boolean, required: true, default: false },
    // Référence de transaction Jèko — déclarée explicitement (contrairement
    // à geniuspay_reference, absente du schéma et donc silencieusement
    // ignorée par Mongoose en mode strict).
    jeko_reference: { type: String, default: null },
    estimatedDeliveryStart: { type: Date, default: null },
    estimatedDeliveryEnd: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    // ✅ NOUVEAU PHASE 3 : Livreur assigné
    livreurId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
        index: true,
    },
}, { timestamps: true });

// Index pour accélérer les requêtes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ livreurId: 1 });

const Order = mongoose.models.order || mongoose.model('order', orderSchema);

export default Order;