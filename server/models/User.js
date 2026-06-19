import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, default: null },
    googleId: { type: String, default: null },
    avatar: { type: String, default: '' },
    cartItems: { type: Object, default: {} },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'product' }],
    phone: { type: String, default: '' },
    street: { type: String, default: '' },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'city', default: null },
    communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'commune', default: null },
    cityName: { type: String, default: '' },
    communeName: { type: String, default: '' },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null }
}, { minimize: false, timestamps: true });

// ✅ Index pour accélérer les recherches
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ resetPasswordToken: 1 });

const User = mongoose.models.user || mongoose.model('user', userSchema);

export default User;
