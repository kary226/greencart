import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'user' }, // ✅ ObjectId
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'product' }, // ✅ ObjectId
        quantity: { type: Number, required: true },
        color: { type: String, default: null },
        size: { type: String, default: null },
        priceAtOrder: { type: Number, required: true }
    }],
    amount: { type: Number, required: true },
    address: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'address' }, // ✅ ObjectId
    status: {
        type: String,
        default: 'pending_payment',
        enum: ['pending_payment', 'Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled']
    },
    paymentType: { type: String, required: true },
    isPaid: { type: Boolean, required: true, default: false },
}, { timestamps: true });

// ✅ Index pour accélérer les recherches fréquentes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ isPaid: 1 });

const Order = mongoose.models.order || mongoose.model('order', orderSchema);

export default Order;
