import User from "../models/User.js";
import mongoose from "mongoose";

// Ajouter un produit à la wishlist
export const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.body.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Convertir en ObjectId pour la comparaison
        const productObjectId = new mongoose.Types.ObjectId(productId);
        const alreadyExists = user.wishlist.some(id => id.equals(productObjectId));
        
        if (!alreadyExists) {
            user.wishlist.push(productObjectId);
            await user.save();
        }

        res.json({ success: true, message: "Ajouté aux favoris" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Retirer un produit de la wishlist
export const removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.body.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "Utilisateur non trouvé" });
        }

        // Convertir en ObjectId pour la comparaison
        const productObjectId = new mongoose.Types.ObjectId(productId);
        user.wishlist = user.wishlist.filter(id => !id.equals(productObjectId));
        await user.save();

        res.json({ success: true, message: "Retiré des favoris" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Récupérer la wishlist de l'utilisateur
export const getWishlist = async (req, res) => {
    try {
        const userId = req.body.userId;
        const user = await User.findById(userId).populate('wishlist');
        
        if (!user) {
            return res.json({ success: false, message: "Utilisateur non trouvé" });
        }

        res.json({ success: true, wishlist: user.wishlist });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};