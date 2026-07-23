import mongoose from "mongoose";

// Avis client sur le service (pas sur un produit — voir Review.js pour ça).
// Un avis est toujours rattaché à un colis SHEIN précis et à la carte de demande
// (messageId) qui l'a déclenché, pour empêcher un double envoi sur la même carte.
const avisServiceSchema = new mongoose.Schema({
    colisId: { type: mongoose.Schema.Types.ObjectId, ref: "colisshein", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: "messagecolis", required: true, unique: true },
    etoiles: { type: Number, required: true, min: 1, max: 5 },
    commentaire: { type: String, trim: true, maxlength: 500, default: "" },
}, { timestamps: true });

avisServiceSchema.index({ createdAt: -1 });

const AvisService = mongoose.models.avisservice || mongoose.model("avisservice", avisServiceSchema);

export default AvisService;