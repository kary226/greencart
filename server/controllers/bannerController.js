import { v2 as cloudinary } from "cloudinary";
import Banner from "../models/Banner.js";

// Bannières actives (client)
export const getBanners = async (req, res) => {
    try {
        const { position } = req.query;
        const filter = { active: true };
        if (position && (position === 'top' || position === 'bottom')) {
            filter.position = position;
        }
        const banners = await Banner.find(filter).sort({ order: 1 });
        res.json({ success: true, banners });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// Toutes les bannières (admin)
export const getAllBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort({ order: 1 });
        res.json({ success: true, banners });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Ajouter une bannière
export const addBanner = async (req, res) => {
    try {
        const { title, subtitle, link, order, position, imageUrl } = req.body;
        const imageFile = req.file;

        let finalImageUrl = '';
        let publicId = null;

        if (imageFile) {
            const result = await cloudinary.uploader.upload(imageFile.path, {
                folder: "banners", resource_type: "image"
            });
            finalImageUrl = result.secure_url;
            publicId = result.public_id;
        } else if (imageUrl) {
            finalImageUrl = imageUrl;
        } else {
            return res.json({ success: false, message: "Veuillez fournir une image (upload ou URL)" });
        }

        const banner = await Banner.create({
            image: finalImageUrl,
            publicId,
            title: title || '',
            subtitle: subtitle || '',
            link: link || '/products',
            order: order || 0,
            position: position || 'top',
            active: true
        });

        res.json({ success: true, message: "Bannière ajoutée", banner });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Modifier une bannière
export const updateBanner = async (req, res) => {
    try {
        const { id, title, subtitle, link, order, active, position, imageUrl } = req.body;
        const updateData = {
            title, subtitle, link, order,
            active: active !== undefined ? active : true,
            position
        };

        if (req.file) {
            const banner = await Banner.findById(id);
            if (banner?.publicId) await cloudinary.uploader.destroy(banner.publicId);
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "banners", resource_type: "image"
            });
            updateData.image = result.secure_url;
            updateData.publicId = result.public_id;
        } else if (imageUrl && imageUrl !== '') {
            updateData.image = imageUrl;
            updateData.publicId = null;
        }

        await Banner.findByIdAndUpdate(id, updateData);
        res.json({ success: true, message: "Bannière modifiée" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Supprimer une bannière
export const deleteBanner = async (req, res) => {
    try {
        const { id } = req.body;
        const banner = await Banner.findById(id);
        if (banner?.publicId) await cloudinary.uploader.destroy(banner.publicId);
        await Banner.findByIdAndDelete(id);
        res.json({ success: true, message: "Bannière supprimée" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
