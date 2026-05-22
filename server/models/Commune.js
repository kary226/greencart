import mongoose from "mongoose";

const communeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'city', required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Commune = mongoose.models.commune || mongoose.model('commune', communeSchema);
export default Commune;