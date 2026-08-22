import mongoose from "mongoose";

/**
 * Demande d'approbation pour une action sensible (ajustement de wallet, retrait, etc.)
 *
 * Principe : si le montant d'une opération dépasse un seuil configurable,
 * l'opération n'est pas exécutée immédiatement. Une ApprovalRequest est créée,
 * et un second administrateur (différent du demandeur) doit l'approuver ou la rejeter.
 *
 * Une fois approuvée, l'opération est exécutée (transaction wallet, retrait, etc.).
 * Une fois rejetée, rien ne se passe (ou on annule les réservations).
 *
 * Seuils stockés dans Setting sous les clés :
 *   - finance.approval.wallet_adjust_threshold  (par défaut 50000)
 *   - finance.approval.withdrawal_threshold     (par défaut 100000)
 */
const approvalRequestSchema = new mongoose.Schema({
    // Type d'action à approuver
    type: {
        type: String,
        enum: ['wallet_adjust', 'withdrawal', 'refund', 'role_change'],
        required: true,
    },
    // Payload : données nécessaires pour exécuter l'action une fois approuvée
    payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    // Montant concerné (pour affichage et seuil)
    montant: {
        type: Number,
        required: true,
    },
    // Demandeur (celui qui a initié l'action)
    demandePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
    },
    // Statut de la demande
    statut: {
        type: String,
        enum: ['en_attente', 'approuvee', 'rejetee', 'expiree'],
        default: 'en_attente',
    },
    // Approbateur (celui qui a pris la décision)
    approuvePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },
    // Date de la décision
    decideLe: {
        type: Date,
        default: null,
    },
    // Commentaire de l'approbateur
    commentaire: {
        type: String,
        trim: true,
        default: '',
    },
    // Date d'expiration (par défaut 48h)
    expireLe: {
        type: Date,
        default: () => new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
}, { timestamps: true });

// Index pour les recherches fréquentes
approvalRequestSchema.index({ statut: 1, createdAt: -1 });
approvalRequestSchema.index({ demandePar: 1, statut: 1 });
approvalRequestSchema.index({ approuvePar: 1 });

const ApprovalRequest = mongoose.models.approvalrequest ||
    mongoose.model('approvalrequest', approvalRequestSchema);

export default ApprovalRequest;