import mongoose from "mongoose";

const citySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const City = mongoose.models.city || mongoose.model('city', citySchema);
export default City;