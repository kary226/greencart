import express from "express";
import multer from "multer";
import authUser from "../middlewares/authUser.js";
import authSeller from "../middlewares/authSeller.js";
import { analyzeCart, submitCart, getUserColis, getColisById, payAcompte, paySolde } from "../controllers/sheinCartController.js";
import { getMessages, sendMessageClient, setClientTyping } from "../controllers/messageColisController.js";
import { demanderAvis, soumettreAvis, getStatsAvis } from "../controllers/avisController.js";
import {
    getAllColisAdmin,
    getColisAdminById,
    validateColis,
    updateStatutColis,
    getMessagesAdmin,
    sendMessageAgent,
    setAgentTyping,
    definirEstimationArrivee,
} from "../controllers/colisSheinAdminController.js";

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

// Chat : une seule image par message (champ "image"), texte et image optionnels
// individuellement mais pas les deux en même temps — validé côté contrôleur.
const uploadChatImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Seules les images sont acceptées"));
    },
});

// --- Routes client (littérales) ---
sheinCartRouter.post("/analyze", authUser, upload.array("captures", 10), analyzeCart);
sheinCartRouter.post("/submit", authUser, submitCart);
sheinCartRouter.get("/user", authUser, getUserColis);

// --- Routes admin (littérales — DOIVENT être déclarées avant /:id, sinon "/admin/all"
// serait interprété comme /:id avec id="admin" et n'atteindrait jamais ce bloc) ---
sheinCartRouter.get("/admin/all", authSeller, getAllColisAdmin);
sheinCartRouter.get("/admin/avis/stats", authSeller, getStatsAvis); // avant /admin/:id, sinon "avis" est lu comme un id
sheinCartRouter.get("/admin/:id", authSeller, getColisAdminById);
sheinCartRouter.post("/admin/:id/validate", authSeller, validateColis);
sheinCartRouter.post("/admin/:id/statut", authSeller, updateStatutColis);
sheinCartRouter.post("/admin/:id/estimation-arrivee", authSeller, definirEstimationArrivee);
sheinCartRouter.post("/admin/:id/demander-avis", authSeller, demanderAvis);
sheinCartRouter.get("/admin/:id/messages", authSeller, getMessagesAdmin);
sheinCartRouter.post("/admin/:id/messages", uploadChatImage.single("image"), authSeller, sendMessageAgent);
sheinCartRouter.post("/admin/:id/typing", authSeller, setAgentTyping);

// --- Routes client génériques (en dernier, elles absorbent tout le reste) ---
sheinCartRouter.get("/:id", authUser, getColisById);
sheinCartRouter.get("/:id/messages", authUser, getMessages);
sheinCartRouter.post("/:id/messages", uploadChatImage.single("image"), authUser, sendMessageClient);
sheinCartRouter.post("/:id/typing", authUser, setClientTyping);
sheinCartRouter.post("/:id/avis", authUser, soumettreAvis);
sheinCartRouter.post("/:id/pay-acompte", authUser, payAcompte);
sheinCartRouter.post("/:id/pay-solde", authUser, paySolde);

export default sheinCartRouter;