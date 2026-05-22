import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    userId: {type: String, required: true},
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    email: {type: String, default: ''},
    street: {type: String, required: true},
    city: {type: String, default: ''},
    state: {type: String, default: ''},
    zipcode: {type: String, default: ''},
    country: {type: String, default: 'Côte d\'Ivoire'},
    phone: {type: String, required: true},
    // Nouveaux champs pour localisation
    cityId: {type: mongoose.Schema.Types.ObjectId, ref: 'city', default: null},
    communeId: {type: mongoose.Schema.Types.ObjectId, ref: 'commune', default: null}
}, { timestamps: true });

const Address = mongoose.models.address || mongoose.model('address', addressSchema);
export default Address;