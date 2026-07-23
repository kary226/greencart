import mongoose from "mongoose";

const messageColisSchema = new mongoose.Schema({
    colisId: { type: mongoose.Schema.Types.ObjectId, ref: "colisshein", required: true },
    expediteurRole: { type: String, enum: ["client", "agent", "systeme"], required: true },
    expediteurId: { type: String, default: null }, // userId (client) ou email admin (agent) — null pour les messages système
    texte: { type: String, trim: true, maxlength: 2000, default: "" },
    imageUrl: { type: String, default: null },
    // "texte" = message classique, "devis" = carte devis avec bouton de paiement,
    // "systeme" = badge de confirmation posté automatiquement (paiement reçu, etc.),
    // "avis" = carte de demande d'avis (étoiles) envoyée par l'agent depuis un raccourci.
    type: { type: String, enum: ["texte", "devis", "systeme", "avis"], default: "texte" },
    payload: {
        montant: { type: Number, default: null },       // FCFA
        libelle: { type: String, default: null },        // ex. "Prix des articles", "Livraison (poids + Abidjan)"
        paymentType: { type: String, enum: ["shein_acompte", "shein_solde", null], default: null },
        detail: { type: String, default: null },          // ex. "3.2 kg × 2500 FCFA/kg + 1500 FCFA livraison Abidjan"
        superseded: { type: Boolean, default: false },    // true si un devis plus récent du même type a été envoyé depuis
        repondu: { type: Boolean, default: false },        // true dès que le client a soumis son avis pour cette carte
        etoilesDonnees: { type: Number, default: null },   // note (1-5) une fois l'avis soumis, affichée directement sans re-fetch
    },
}, { timestamps: true });

messageColisSchema.index({ colisId: 1, createdAt: 1 });

const MessageColis = mongoose.models.messagecolis || mongoose.model("messagecolis", messageColisSchema);

export default MessageColis;