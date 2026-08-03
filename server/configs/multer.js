import multer from "multer";

// ✅ FILTRE : Accepter images ET vidéos
const fileFilter = (req, file, cb) => {
    // ✅ Accepter les images (produits, logo, catégorie, etc.)
    if ((file.fieldname === 'images' || file.fieldname === 'logo' || file.fieldname === 'image') &&
        (file.mimetype.startsWith('image/'))) {
        cb(null, true);
    }
    // ✅ Accepter les vidéos
    else if (file.fieldname === 'video' && 
             (file.mimetype.startsWith('video/'))) {
        cb(null, true);
    }
    // ❌ Rejeter les autres
    else {
        cb(new Error(`Format non autorisé pour le champ "${file.fieldname}". Seuls les images et vidéos sont acceptés.`));
    }
};

// ✅ CONFIGURATION AVEC LIMITES AUGMENTÉES
export const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 150 * 1024 * 1024, // 150 MB par fichier (pour les vidéos)
        files: 15, // 10 images + 1 vidéo + marge
        fieldSize: 50 * 1024 * 1024, // 50 MB pour les champs texte (productData JSON)
    },
    fileFilter: fileFilter,
});