import mongoose from "mongoose";

/**
 * Refund – Demande et suivi des remboursements.
 *
 * Pourquoi une collection séparée ?
 *   - Un remboursement peut être partiel, sur plusieurs articles
 *   - Il peut être fait en RCOINS ou par le moyen de paiement d'origine
 *   - Il passe par un workflow d'approbation (double approbation si > seuil)
 *
 * Le flux :
 *   REQUESTED → APPROVED → PROCESSING → COMPLETED / FAILED / REJECTED
 *
 * Le champ refundId sert à l'idempotence (éviter les doublons de remboursement).
 */
const refundSchema = new mongoose.Schema({
    // Commande concernée
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'order',
        required: true,
        index: true,
    },

    // Article(s) concerné(s) (IDs des items de la commande)
    itemIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
    },

    // Montant approuvé pour le remboursement
    montantApprouve: {
        type: Number,
        required: true,
        min: 0,
    },

    // Méthode de remboursement
    methode: {
        type: String,
        required: true,
        enum: ['rcoins', 'moyen_paiement_origine'],
        default: 'rcoins',
    },

    // Statut du remboursement
    statut: {
        type: String,
        required: true,
        enum: [
            'requested',    // Demande créée
            'approved',     // Approuvée (par finance_admin / super_admin)
            'processing',   // En cours de traitement
            'completed',    // Terminé
            'failed',       // Échec
            'rejected',     // Rejeté
        ],
        default: 'requested',
    },

    // Clé d'idempotence (pour éviter les doublons)
    refundId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },

    // Référence externe (fournisseur de paiement, virement, etc.)
    providerReference: {
        type: String,
        trim: true,
        default: null,
    },

    // Demandeur (staff qui a initié la demande)
    demandePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
    },

    // Approbateur (staff qui a approuvé)
    approuvePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },

    // Motif du remboursement
    motif: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
    },

    // Plafond net autorisé (pour les remboursements partiels)
    plafondNetAutorise: {
        type: Number,
        default: 0,
    },

    // Date d'approbation
    approuveLe: {
        type: Date,
        default: null,
    },

    // Date de completion
    completeLe: {
        type: Date,
        default: null,
    },

    // Note interne
    noteInterne: {
        type: String,
        trim: true,
        default: '',
        maxlength: 500,
    },

    // Note visible par le client
    noteClient: {
        type: String,
        trim: true,
        default: '',
        maxlength: 500,
    },
}, { timestamps: true });

// Index pour les requêtes fréquentes
refundSchema.index({ orderId: 1, statut: 1 });
refundSchema.index({ demandePar: 1, createdAt: -1 });
refundSchema.index({ refundId: 1 }, { unique: true });

const Refund = mongoose.models.refund ||
    mongoose.model('refund', refundSchema);

export default Refund;