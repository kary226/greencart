import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    userId: {type: String, required: true, ref: 'user'},
    items: [{
        product: {type: String, required: true, ref: 'product'},
        quantity: {type: Number, required: true},
        color: {type: String, default: null },
        size: {type: String, default: null },
        priceAtOrder: {type: Number, required: true}
    }],
    amount: {type: Number, required: true},
    // [FIX] Détail du calcul du montant, manquant jusqu'ici : sans ces
    // champs, le reçu PDF (OrderReceiptPDF.jsx) et MyOrders.jsx ne peuvent
    // pas afficher la livraison ni le coupon réellement appliqués, même
    // s'ils ont été pris en compte dans 'amount' au moment du calcul.
    deliveryPrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    couponApplied: { type: String, default: null },
    address: {type: String, required: true, ref: 'address'},
    status: { 
        type: String, 
        default: 'pending_payment',
        enum: ['pending_payment', 'Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled']
    },
    paymentType: {type: String, required: true},
    isPaid: {type: Boolean, required: true, default: false},
},{ timestamps: true })

const Order = mongoose.models.order || mongoose.model('order', orderSchema)

export default Order