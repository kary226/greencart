import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category.js";

// Récupérer toutes les catégories actives
export const getCategories = async (req, res) => {
    try {
        const categories = await Category.find({ active: true }).sort({ order: 1 });
        res.json({ success: true, categories });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Récupérer toutes les catégories (admin)
export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ order: 1 });
        res.json({ success: true, categories });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Ajouter une catégorie (upload ou URL)
export const addCategory = async (req, res) => {
    try {
        const { name, slug, bgColor, order, imageUrl } = req.body;
        const imageFile = req.file;
        
        let finalImageUrl = '';
        let publicId = null;

        if (!name || !slug) {
            return res.json({ success: false, message: "Nom et slug requis" });
        }
        
        const existing = await Category.findOne({ $or: [{ name }, { slug }] });
        if (existing) {
            return res.json({ success: false, message: "Catégorie déjà existante" });
        }
        
        // Cas 1 : Upload d'un fichier
        if (imageFile) {
            const result = await cloudinary.uploader.upload(imageFile.path, {
                folder: "categories",
                resource_type: "image"
            });
            finalImageUrl = result.secure_url;
            publicId = result.public_id;
        }
        // Cas 2 : URL externe
        else if (imageUrl) {
            finalImageUrl = imageUrl;
        }
        
        const category = await Category.create({
            name,
            slug: slug.toLowerCase().replace(/\s/g, '-'),
            image: finalImageUrl,
            publicId,
            bgColor: bgColor || '#f0f0f0',
            order: order || 0,
            active: true
        });
        
        res.json({ success: true, message: "Catégorie ajoutée", category });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Modifier une catégorie (upload ou URL)
export const updateCategory = async (req, res) => {
    try {
        const { id, name, slug, bgColor, order, active, imageUrl } = req.body;
        const imageFile = req.file;
        
        const updateData = {
            name,
            slug: slug?.toLowerCase().replace(/\s/g, '-'),
            bgColor,
            order,
            active
        };
        
        // Si nouvelle image uploadée
        if (imageFile) {
            // Supprimer l'ancienne image de Cloudinary si elle existe
            const oldCategory = await Category.findById(id);
            if (oldCategory?.publicId) {
                await cloudinary.uploader.destroy(oldCategory.publicId);
            }
            const result = await cloudinary.uploader.upload(imageFile.path, {
                folder: "categories",
                resource_type: "image"
            });
            updateData.image = result.secure_url;
            updateData.publicId = result.public_id;
        }
        // Si nouvelle URL externe fournie
        else if (imageUrl !== undefined) {
            updateData.image = imageUrl;
            if (!imageUrl) {
                updateData.publicId = null;
            }
        }
        
        await Category.findByIdAndUpdate(id, updateData);
        res.json({ success: true, message: "Catégorie modifiée" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Supprimer une catégorie
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.body;
        const category = await Category.findById(id);
        
        // Supprimer l'image de Cloudinary si elle existe
        if (category?.publicId) {
            await cloudinary.uploader.destroy(category.publicId);
        }
        
        await Category.findByIdAndDelete(id);
        res.json({ success: true, message: "Catégorie supprimée" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};