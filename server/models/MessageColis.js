import mongoose from "mongoose";

const messageColisSchema = new mongoose.Schema({
    colisId: { type: mongoose.Schema.Types.ObjectId, ref: "colisshein", required: true },
    expediteurRole: { type: String, enum: ["client", "agent"], required: true },
    expediteurId: { type: String, required: true }, // userId (client) ou email admin (agent) — pas de collection Seller
    texte: { type: String, trim: true, maxlength: 2000, default: "" },
    imageUrl: { type: String, default: null },
}, { timestamps: true });

messageColisSchema.index({ colisId: 1, createdAt: 1 });

const MessageColis = mongoose.models.messagecolis || mongoose.model("messagecolis", messageColisSchema);

export default MessageColis;