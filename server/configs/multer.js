import multer from "multer";

const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Type de fichier non autorisé. Seuls JPEG, PNG et WEBP sont acceptés."));
    }
};

export const upload = multer({
    storage: multer.memoryStorage(), // stockage en mémoire (pas de dossier uploads/)
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo par fichier
    fileFilter: fileFilter,
});