import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
    color: { type: String, default: null },
    size: { type: String, default: null },
    stock: { type: Number, default: 0 }
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: Array, required: true },
    price: { type: Number, required: true },
    offerPrice: { type: Number, required: true },
    image: { type: Array, required: true },
    category: { type: String, required: true },
    inStock: { type: Boolean, default: true },
    variants: [variantSchema]
}, { timestamps: true });

const Product = mongoose.models.product || mongoose.model('product', productSchema);
export default Product;