import mongoose from "mongoose";

// Une Invitation représente un lien d'activation envoyé par un admin,
// AVANT que le compte StaffUser n'existe réellement. La personne invitée
// choisit elle-même son mot de passe au moment de l'activation — l'admin
// ne le connaît jamais.
const invitationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    role: {
        type: String,
        enum: ['admin', 'commercant', 'livreur', 'assistant_shein'],
        required: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
    },
    expireA: {
        type: Date,
        required: true,
    },
    utilisee: {
        type: Boolean,
        default: false,
    },
    creePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
    },
}, { timestamps: true });

const Invitation = mongoose.models.invitation || mongoose.model('invitation', invitationSchema);

export default Invitation;