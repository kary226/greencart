import mongoose from "mongoose";

const deliveryPriceSchema = new mongoose.Schema({
    deliveryTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'deliveryType', required: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'city', default: null },
    communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'commune', default: null },
    price: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Une seule combinaison par type/city/commune
deliveryPriceSchema.index({ deliveryTypeId: 1, cityId: 1, communeId: 1 }, { unique: true });

const DeliveryPrice = mongoose.models.deliveryPrice || mongoose.model('deliveryPrice', deliveryPriceSchema);
export default DeliveryPrice;