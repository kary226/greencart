import Questionnaire from "../models/Questionnaire.js";
import ReponseQuestionnaire from "../models/ReponseQuestionnaire.js";

// ---------- Admin ----------

// POST /api/questionnaire/admin/create
export const createQuestionnaire = async (req, res) => {
    try {
        const { titre, description, questions, declencheur } = req.body;
        if (!titre || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ success: false, message: "Titre et au moins une question sont requis" });
        }
        const questionnaire = await Questionnaire.create({
            titre,
            description: description || "",
            questions: questions.map((q, i) => ({
                id: q.id || `q${i + 1}`,
                libelle: q.libelle,
                type: q.type === "texte" ? "texte" : "etoiles",
            })),
            declencheur: declencheur || "manuel",
        });
        res.json({ success: true, questionnaire });
    } catch (error) {
        console.error("Erreur createQuestionnaire:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/questionnaire/admin/all
export const getAllQuestionnaires = async (req, res) => {
    try {
        const questionnaires = await Questionnaire.find().sort({ createdAt: -1 });
        // Nombre de réponses par questionnaire, pour l'affichage en liste sans requête séparée
        const counts = await ReponseQuestionnaire.aggregate([
            { $group: { _id: "$questionnaireId", total: { $sum: 1 }, moyenne: { $avg: "$moyenneEtoiles" } } },
        ]);
        const countMap = Object.fromEntries(counts.map((c) => [String(c._id), { total: c.total, moyenne: c.moyenne }]));
        const enrichis = questionnaires.map((q) => {
            const obj = q.toObject();
            obj.totalReponses = countMap[String(q._id)]?.total || 0;
            obj.moyenneEtoiles = countMap[String(q._id)]?.moyenne
                ? Math.round(countMap[String(q._id)].moyenne * 10) / 10
                : null;
            return obj;
        });
        res.json({ success: true, questionnaires: enrichis });
    } catch (error) {
        console.error("Erreur getAllQuestionnaires:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/questionnaire/admin/:id/toggle
export const toggleQuestionnaire = async (req, res) => {
    try {
        const questionnaire = await Questionnaire.findById(req.params.id);
        if (!questionnaire) return res.status(404).json({ success: false, message: "Questionnaire introuvable" });
        questionnaire.actif = !questionnaire.actif;
        await questionnaire.save();
        res.json({ success: true, questionnaire });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/questionnaire/admin/:id
export const deleteQuestionnaire = async (req, res) => {
    try {
        await Questionnaire.findByIdAndDelete(req.params.id);
        await ReponseQuestionnaire.deleteMany({ questionnaireId: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/questionnaire/admin/:id/stats — étoiles obtenues, question par question
export const getStatsQuestionnaire = async (req, res) => {
    try {
        const questionnaire = await Questionnaire.findById(req.params.id);
        if (!questionnaire) return res.status(404).json({ success: false, message: "Questionnaire introuvable" });

        const reponses = await ReponseQuestionnaire.find({ questionnaireId: req.params.id }).sort({ createdAt: -1 });

        const totalReponses = reponses.length;
        const moyenneGlobale = totalReponses
            ? Math.round((reponses.reduce((sum, r) => sum + (r.moyenneEtoiles || 0), 0) / totalReponses) * 10) / 10
            : 0;

        // Distribution 1 à 5 étoiles, toutes questions "etoiles" confondues
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        // Moyenne par question, pour repérer une question qui plombe la note globale
        const parQuestion = {};
        questionnaire.questions.forEach((q) => { parQuestion[q.id] = { libelle: q.libelle, type: q.type, sommeEtoiles: 0, nbEtoiles: 0, commentaires: [] }; });

        reponses.forEach((r) => {
            r.reponses.forEach((rep) => {
                const q = parQuestion[rep.questionId];
                if (!q) return;
                if (rep.etoiles) {
                    distribution[rep.etoiles] = (distribution[rep.etoiles] || 0) + 1;
                    q.sommeEtoiles += rep.etoiles;
                    q.nbEtoiles += 1;
                }
                if (rep.texte) q.commentaires.push(rep.texte);
            });
        });

        const statsParQuestion = Object.entries(parQuestion).map(([id, q]) => ({
            id,
            libelle: q.libelle,
            type: q.type,
            moyenne: q.nbEtoiles ? Math.round((q.sommeEtoiles / q.nbEtoiles) * 10) / 10 : null,
            commentaires: q.commentaires,
        }));

        res.json({
            success: true,
            questionnaire,
            totalReponses,
            moyenneGlobale,
            distribution,
            statsParQuestion,
            reponses,
        });
    } catch (error) {
        console.error("Erreur getStatsQuestionnaire:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ---------- Client ----------

// GET /api/questionnaire/actif?declencheur=colis_livre
export const getQuestionnaireActif = async (req, res) => {
    try {
        const { declencheur } = req.query;
        const filtre = { actif: true };
        if (declencheur) filtre.declencheur = { $in: [declencheur, "manuel"] };
        const questionnaire = await Questionnaire.findOne(filtre).sort({ createdAt: -1 });
        res.json({ success: true, questionnaire: questionnaire || null });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/questionnaire/:id/repondre
export const repondreQuestionnaire = async (req, res) => {
    try {
        const { userId, userName, reponses, contexteType, contexteId } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: "Vous devez être connecté" });
        if (!Array.isArray(reponses) || reponses.length === 0) {
            return res.status(400).json({ success: false, message: "Réponse vide" });
        }

        const etoiles = reponses.filter((r) => r.etoiles).map((r) => Number(r.etoiles));
        const moyenneEtoiles = etoiles.length ? etoiles.reduce((a, b) => a + b, 0) / etoiles.length : null;

        const reponse = await ReponseQuestionnaire.create({
            questionnaireId: req.params.id,
            userId,
            userName: userName || "Client",
            contexteType: contexteType || null,
            contexteId: contexteId || null,
            reponses,
            moyenneEtoiles,
        });

        res.json({ success: true, reponse });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Tu as déjà répondu à ce questionnaire pour cet élément." });
        }
        console.error("Erreur repondreQuestionnaire:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};