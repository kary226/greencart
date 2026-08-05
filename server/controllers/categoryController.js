import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category.js";
import { withCache, invalidateCache, CACHE_KEYS } from "../configs/redisCache.js";

const uploadToCloudinary = (buffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "image" },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(buffer);
    });
};

// Récupérer toutes les catégories actives
// [PHASE 2 - PERF] Donnée peu volatile, très lue (chaque chargement de la
// Home) : cache Redis 5 min, invalidée explicitement à chaque écriture admin.
export const getCategories = async (req, res) => {
    try {
        const categories = await withCache(CACHE_KEYS.categoriesActive, 300, () =>
            Category.find({ active: true }).sort({ order: 1 }).lean()
        );
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

// Ajouter une catégorie
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

        if (imageFile) {
            const result = await uploadToCloudinary(imageFile.buffer, "categories");
            finalImageUrl = result.secure_url;
            publicId = result.public_id;
        } else if (imageUrl) {
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

        await invalidateCache(CACHE_KEYS.categoriesActive); // [PHASE 2 - PERF]
        res.json({ success: true, message: "Catégorie ajoutée", category });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Modifier une catégorie
export const updateCategory = async (req, res) => {
    try {
        const { id, name, slug, bgColor, order, active, imageUrl } = req.body;
        const imageFile = req.file;

        const updateData = { name, slug: slug?.toLowerCase().replace(/\s/g, '-'), bgColor, order, active };

        if (imageFile) {
            const oldCategory = await Category.findById(id);
            if (oldCategory?.publicId) {
                await cloudinary.uploader.destroy(oldCategory.publicId);
            }
            const result = await uploadToCloudinary(imageFile.buffer, "categories");
            updateData.image = result.secure_url;
            updateData.publicId = result.public_id;
        } else if (imageUrl !== undefined) {
            updateData.image = imageUrl;
            if (!imageUrl) updateData.publicId = null;
        }

        await Category.findByIdAndUpdate(id, updateData);
        await invalidateCache(CACHE_KEYS.categoriesActive); // [PHASE 2 - PERF]
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
        if (category?.publicId) {
            await cloudinary.uploader.destroy(category.publicId);
        }
        await Category.findByIdAndDelete(id);
        await invalidateCache(CACHE_KEYS.categoriesActive); // [PHASE 2 - PERF]
        res.json({ success: true, message: "Catégorie supprimée" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Activer / Désactiver une catégorie
export const toggleCategoryStatus = async (req, res) => {
    try {
        const { id } = req.body;
        const category = await Category.findById(id);
        if (!category) {
            return res.json({ success: false, message: "Catégorie non trouvée" });
        }
        const newStatus = !category.active;
        await Category.findByIdAndUpdate(id, { active: newStatus });
        await invalidateCache(CACHE_KEYS.categoriesActive); // [PHASE 2 - PERF]
        res.json({ success: true, message: newStatus ? "Catégorie activée" : "Catégorie désactivée", active: newStatus });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};