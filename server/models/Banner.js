import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema({
    image: { type: String, required: true },
    publicId: { type: String }, // Pour stocker l'ID Cloudinary (utile pour suppression)
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    link: { type: String, default: '/products' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    position: { type: String, enum: ['top', 'bottom'], default: 'top' } // 👈 NOUVEAU CHAMP
}, { timestamps: true });

const Banner = mongoose.models.banner || mongoose.model('banner', bannerSchema);
export default Banner;