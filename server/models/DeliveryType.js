import mongoose from "mongoose";

const deliveryTypeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Standard, Express, Retrait
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
}, { timestamps: true });

const DeliveryType = mongoose.models.deliveryType || mongoose.model('deliveryType', deliveryTypeSchema);
export default DeliveryType;