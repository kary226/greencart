import multer from "multer";

// [FIX H1] memoryStorage : compatible avec addProduct (productController.js)
// qui utilise déjà item.buffer pour uploader vers Cloudinary via
// upload_stream — pas de fichier écrit sur disque, ce qui convient aussi
// mieux à un environnement serverless (Vercel) sans disque persistant.
// fileFilter + limits.fileSize empêchent l'upload de fichiers arbitraires
// ou surdimensionnés.
const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Type de fichier non autorisé. Seuls JPEG, PNG et WEBP sont acceptés."));
    }
};

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo par fichier
    fileFilter: fileFilter,
});