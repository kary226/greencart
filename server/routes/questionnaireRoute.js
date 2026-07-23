import express from "express";
import authUser from "../middlewares/authUser.js";
import authSeller from "../middlewares/authSeller.js";
import {
    createQuestionnaire,
    getAllQuestionnaires,
    toggleQuestionnaire,
    deleteQuestionnaire,
    getStatsQuestionnaire,
    getQuestionnaireActif,
    repondreQuestionnaire,
} from "../controllers/questionnaireController.js";

const questionnaireRouter = express.Router();

// --- Admin (littérales avant /:id) ---
questionnaireRouter.post("/admin/create", authSeller, createQuestionnaire);
questionnaireRouter.get("/admin/all", authSeller, getAllQuestionnaires);
questionnaireRouter.post("/admin/:id/toggle", authSeller, toggleQuestionnaire);
questionnaireRouter.delete("/admin/:id", authSeller, deleteQuestionnaire);
questionnaireRouter.get("/admin/:id/stats", authSeller, getStatsQuestionnaire);

// --- Client ---
questionnaireRouter.get("/actif", getQuestionnaireActif);
questionnaireRouter.post("/:id/repondre", authUser, repondreQuestionnaire);

export default questionnaireRouter;