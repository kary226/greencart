import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    image: { type: String, default: '' },
    bgColor: { type: String, default: '#f0f0f0' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
}, { timestamps: true });

const Category = mongoose.models.category || mongoose.model('category', categorySchema);
export default Category;