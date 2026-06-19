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