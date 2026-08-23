import mongoose from "mongoose";

/**
 * ReconciliationLog – Historique des rapprochements Jèko / Wallet.
 *
 * Objectif : détecter les écarts entre les transactions enregistrées dans
 * notre système (Wallet, Orders) et les transactions réelles chez Jèko.
 *
 * Chaque log contient :
 *   - Les données Jèko (montant, référence, status)
 *   - Les données internes (walletId, orderId, montant)
 *   - L'écart constaté
 *   - Le statut (résolu ou non)
 */
const reconciliationLogSchema = new mongoose.Schema({
    // ─── Référence Jèko ──────────────────────────────────────────────
    jekoReference: {
        type: String,
        required: true,
        index: true,
    },
    jekoAmount: {
        type: Number,
        required: true,
    },
    jekoStatus: {
        type: String,
        default: 'successful',
    },
    jekoTransactionId: {
        type: String,
        default: null,
    },
    jekoDate: {
        type: Date,
        default: Date.now,
    },

    // ─── Référence interne ────────────────────────────────────────────
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'order',
        default: null,
        index: true,
    },
    walletTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'wallettransaction',
        default: null,
        index: true,
    },
    internalAmount: {
        type: Number,
        default: 0,
    },
    internalStatus: {
        type: String,
        enum: ['paid', 'pending', 'cancelled', 'refunded'],
        default: 'pending',
    },

    // ─── Écart ─────────────────────────────────────────────────────────
    montantEcart: {
        type: Number,
        default: 0,
    },
    typeEcart: {
        type: String,
        enum: ['montant', 'statut', 'manquant', 'doublon', 'aucun'],
        default: 'aucun',
    },

    // ─── Résolution ───────────────────────────────────────────────────
    resolu: {
        type: Boolean,
        default: false,
    },
    resoluPar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },
    resoluLe: {
        type: Date,
        default: null,
    },
    noteResolution: {
        type: String,
        trim: true,
        default: '',
    },

    // ─── Métadonnées ──────────────────────────────────────────────────
    runDate: {
        type: Date,
        default: Date.now,
        index: true,
    },
}, { timestamps: true });

// Index pour les recherches fréquentes
reconciliationLogSchema.index({ jekoReference: 1, runDate: -1 });
reconciliationLogSchema.index({ resolu: 1, runDate: -1 });

const ReconciliationLog = mongoose.models.reconciliationlog ||
    mongoose.model('reconciliationlog', reconciliationLogSchema);

export default ReconciliationLog;