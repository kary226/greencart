import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'user' }, // ✅ ObjectId
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, default: '' },
    street: { type: String, required: true },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipcode: { type: String, default: '' },
    country: { type: String, default: "Côte d'Ivoire" },
    phone: { type: String, required: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'city', default: null },
    communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'commune', default: null },
    cityName: { type: String, default: '' },
    communeName: { type: String, default: '' }
}, { timestamps: true });

// ✅ Index pour accélérer la recherche des adresses d'un utilisateur
addressSchema.index({ userId: 1 });

const Address = mongoose.models.address || mongoose.model('address', addressSchema);
export default Address;
