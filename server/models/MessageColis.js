import mongoose from "mongoose";

const messageColisSchema = new mongoose.Schema({
    colisId: { type: mongoose.Schema.Types.ObjectId, ref: "colisshein", required: true },
    expediteurRole: { type: String, enum: ["client", "agent", "systeme"], required: true },
    expediteurId: { type: String, default: null },
    texte: { type: String, trim: true, maxlength: 2000, default: "" },
    imageUrl: { type: String, default: null },
    type: { type: String, enum: ["texte", "devis", "systeme", "avis"], default: "texte" },
    
    // ✅ PHASE 5 : Agent StaffUser pour traçabilité
    agentStaffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
        index: true,
    },
    
    payload: {
        montant: { type: Number, default: null },
        libelle: { type: String, default: null },
        paymentType: { type: String, enum: ["shein_acompte", "shein_solde", null], default: null },
        detail: { type: String, default: null },
        superseded: { type: Boolean, default: false },
        repondu: { type: Boolean, default: false },
        etoilesDonnees: { type: Number, default: null },
    },
}, { timestamps: true });

messageColisSchema.index({ colisId: 1, createdAt: 1 });
messageColisSchema.index({ agentStaffId: 1 });

const MessageColis = mongoose.models.messagecolis || mongoose.model("messagecolis", messageColisSchema);

export default MessageColis;