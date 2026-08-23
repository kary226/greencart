import express from "express";
import multer from "multer";
import authUser from "../middlewares/authUser.js";
import { analyzeCart, submitCart, getUserColis, getColisById } from "../controllers/sheinCartController.js";
import { initiateJekoAcompte, initiateJekoSolde } from "../controllers/jekoController.js";
import { getMessages, sendMessageClient, setClientTyping } from "../controllers/messageColisController.js";
import { soumettreAvis } from "../controllers/avisController.js";
// [CORRECTIF AUDIT — 23 août 2026] Les 8 routes /admin/* qui vivaient ici
// (authSeller) sont retirées : colisSheinAdminRouter est monté AVANT ce
// routeur dans server.js et couvre désormais l'intégralité de ces chemins
// (y compris demander-avis et avis/stats, ajoutées à cette occasion) via
// authStaff + RBAC. Les garder ici constituait du code mort — jamais
// atteint en pratique, mais entretenant une fausse impression de
// couverture. Voir Rapport d'audit d'implémentation, section 5.

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

// --- Routes client génériques (en dernier, elles absorbent tout le reste) ---
sheinCartRouter.get("/:id", authUser, getColisById);
sheinCartRouter.get("/:id/messages", authUser, getMessages);
// [SÉCURITÉ] authUser avant Multer — même raison que la route admin ci-dessus.
sheinCartRouter.post("/:id/messages", authUser, uploadChatImage.single("image"), sendMessageClient);
sheinCartRouter.post("/:id/typing", authUser, setClientTyping);
sheinCartRouter.post("/:id/avis", authUser, soumettreAvis);
sheinCartRouter.post("/:id/pay-acompte", authUser, initiateJekoAcompte);
sheinCartRouter.post("/:id/pay-solde", authUser, initiateJekoSolde);

export default sheinCartRouter;