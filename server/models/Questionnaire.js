import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema({
    id: { type: String, required: true },          // identifiant court, généré côté client (ex. "q1")
    libelle: { type: String, required: true },       // ex. "Comment évalues-tu la rapidité de livraison ?"
    type: { type: String, enum: ["etoiles", "texte"], default: "etoiles" },
}, { _id: false });

// Un questionnaire = un mini-formulaire d'avis que l'admin peut déclencher auprès
// des clients (ex. après un colis livré). "declencheur" indique automatiquement à
// quel moment le proposer côté client, sans que l'admin ait à le faire à la main.
const questionnaireSchema = new mongoose.Schema({
    titre: { type: String, required: true },
    description: { type: String, default: "" },
    questions: { type: [QuestionSchema], default: [] },
    declencheur: {
        type: String,
        enum: ["colis_livre", "commande_livree", "manuel"],
        default: "manuel",
    },
    actif: { type: Boolean, default: true },
}, { timestamps: true });

const Questionnaire = mongoose.models.questionnaire || mongoose.model("questionnaire", questionnaireSchema);
export default Questionnaire;