import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    // [PHASE 0 - PERF] Index manquant : userId est utilisé pour lister les
    // adresses d'un utilisateur (page compte, checkout) — sans index, ces
    // requêtes forcent un scan complet de la collection à mesure qu'elle
    // grossit.
    userId: {type: String, required: true, index: true},
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    email: {type: String, default: ''},
    street: {type: String, required: true},
    city: {type: String, default: ''},
    state: {type: String, default: ''},
    zipcode: {type: String, default: ''},
    country: {type: String, default: 'Côte d\'Ivoire'},
    phone: {type: String, required: true},
    // Champs pour localisation
    cityId: {type: mongoose.Schema.Types.ObjectId, ref: 'city', default: null},
    communeId: {type: mongoose.Schema.Types.ObjectId, ref: 'commune', default: null},
    cityName: {type: String, default: ''},
    communeName: {type: String, default: ''}
}, { timestamps: true });

const Address = mongoose.models.address || mongoose.model('address', addressSchema);
export default Address;