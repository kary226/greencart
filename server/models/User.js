import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, default: null },   // null pour les comptes Google
    googleId: { type: String, default: null },    // ID unique Google
    avatar: { type: String, default: '' },        // photo de profil Google
    cartItems: { type: Object, default: {} },
    // Crédit interne GreenCart utilisé pour les remboursements d'articles
    // indisponibles/retours sur commandes déjà payées.
    creditBalance: { type: Number, default: 0, min: 0 },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'product' }],
    phone: { type: String, default: '' },
    street: { type: String, default: '' },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'city', default: null },
    communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'commune', default: null },
    cityName: { type: String, default: '' },
    communeName: { type: String, default: '' },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null }
}, { minimize: false, timestamps: true })

const User = mongoose.models.user || mongoose.model('user', userSchema)

export default User;