import { v2 as cloudinary } from "cloudinary";
import Banner from "../models/Banner.js";
import { withCache, invalidateCache, CACHE_KEYS } from "../configs/redisCache.js";

// Récupérer les bannières actives par position (top ou bottom)
// [PHASE 2 - PERF] Donnée peu volatile, très lue (chaque chargement de la
// Home) : cache Redis 5 min par position, invalidé à chaque écriture admin.
export const getBanners = async (req, res) => {
    try {
        const { position } = req.query;
        let filter = { active: true };
        let cacheKey = CACHE_KEYS.bannersAll;

        if (position && (position === 'top' || position === 'bottom')) {
            filter.position = position;
            cacheKey = position === 'top' ? CACHE_KEYS.bannersTop : CACHE_KEYS.bannersBottom;
        }

        const banners = await withCache(cacheKey, 300, () =>
            Banner.find(filter).sort({ order: 1 }).lean()
        );

        res.json({ success: true, banners });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// Récupérer toutes les bannières (admin)
export const getAllBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort({ order: 1 });
        res.json({ success: true, banners });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Ajouter une bannière (upload ou URL)
export const addBanner = async (req, res) => {
    try {
        const { title, subtitle, link, order, position, imageUrl } = req.body;
        const imageFile = req.file;
        
        let finalImageUrl = '';
        let publicId = null;

        if (imageFile) {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { 
                        folder: "banners",
                        resource_type: "image"
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(imageFile.buffer);
            });
            finalImageUrl = result.secure_url;
            publicId = result.public_id;
        }
        else if (imageUrl) {
            finalImageUrl = imageUrl;
        }
        else {
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

        await invalidateCache(CACHE_KEYS.bannersTop, CACHE_KEYS.bannersBottom, CACHE_KEYS.bannersAll); // [PHASE 2 - PERF]
        res.json({ success: true, message: "Bannière ajoutée", banner });
    } catch (error) {
        console.error("❌ Erreur addBanner:", error);
        res.json({ success: false, message: error.message });
    }
};

// Modifier une bannière
export const updateBanner = async (req, res) => {
    try {
        const { id, title, subtitle, link, order, active, position, imageUrl } = req.body;
        const imageFile = req.file;
        
        const updateData = { 
            title, 
            subtitle, 
            link, 
            order, 
            active: active !== undefined ? active : true,
            position 
        };

        if (imageFile) {
            const banner = await Banner.findById(id);
            if (banner?.publicId) {
                await cloudinary.uploader.destroy(banner.publicId);
            }
            
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { 
                        folder: "banners",
                        resource_type: "image"
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(imageFile.buffer);
            });
            updateData.image = result.secure_url;
            updateData.publicId = result.public_id;
        }
        else if (imageUrl && imageUrl !== '') {
            updateData.image = imageUrl;
            updateData.publicId = null;
        }

        await Banner.findByIdAndUpdate(id, updateData);
        await invalidateCache(CACHE_KEYS.bannersTop, CACHE_KEYS.bannersBottom, CACHE_KEYS.bannersAll); // [PHASE 2 - PERF]
        res.json({ success: true, message: "Bannière modifiée" });
    } catch (error) {
        console.error("❌ Erreur updateBanner:", error);
        res.json({ success: false, message: error.message });
    }
};

// Supprimer une bannière
export const deleteBanner = async (req, res) => {
    try {
        const { id } = req.body;
        const banner = await Banner.findById(id);
        if (banner?.publicId) {
            await cloudinary.uploader.destroy(banner.publicId);
        }
        await Banner.findByIdAndDelete(id);
        await invalidateCache(CACHE_KEYS.bannersTop, CACHE_KEYS.bannersBottom, CACHE_KEYS.bannersAll); // [PHASE 2 - PERF]
        res.json({ success: true, message: "Bannière supprimée" });
    } catch (error) {
        console.error("❌ Erreur deleteBanner:", error);
        res.json({ success: false, message: error.message });
    }
};