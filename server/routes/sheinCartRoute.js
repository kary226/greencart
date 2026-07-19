import express from "express";
import multer from "multer";
import authUser from "../middlewares/authUser.js";
import { analyzeCart, submitCart, getUserColis, getColisById } from "../controllers/sheinCartController.js";
import { getMessages, sendMessageClient } from "../controllers/messageColisController.js";

const sheinCartRouter = express.Router();

// Upload en mémoire, images uniquement — pas besoin de la config vidéo de configs/multer.js
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 10 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Seules les images sont acceptées"));
    },
});

sheinCartRouter.post("/analyze", authUser, upload.array("captures", 10), analyzeCart);
sheinCartRouter.post("/submit", authUser, submitCart);
sheinCartRouter.get("/user", authUser, getUserColis);
sheinCartRouter.get("/:id", authUser, getColisById);
sheinCartRouter.get("/:id/messages", authUser, getMessages);
sheinCartRouter.post("/:id/messages", authUser, sendMessageClient);

export default sheinCartRouter;