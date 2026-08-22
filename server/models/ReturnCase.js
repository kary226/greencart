import mongoose from "mongoose";

/**
 * ReturnCase – Machine à états des retours.
 *
 * Pourquoi une collection séparée ?
 *   - Un retour a un cycle de vie complexe (demande, pickup, réception, inspection, résolution)
 *   - Plusieurs commandes peuvent avoir des retours indépendants
 *   - La décision de responsabilité (commerçant / transport / client) est structurée
 *
 * Le flux complet :
 *   DELIVERED → RETURN_REQUESTED → RETURN_PICKUP → RETURN_RECEIVED (scan + photo)
 *   → RETURN_INSPECTION → RESOLUTION → REFUND_CLIENT / REROUTE_TO_SELLER / REJECT_RETURN
 *
 * La résolution déclenche l'appel à traiterRetourColis() (dans walletService.js)
 * pour reprendre l'argent et réintégrer (ou non) le stock.
 */
const returnCaseSchema = new mongoose.Schema({
    // Commande concernée
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'order',
        required: true,
        unique: true, // Une seule instance de ReturnCase par commande
    },

    // Boutique concernée (si retour partiel, sinon null)
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'boutique',
        default: null,
        index: true,
    },

    // Articles retournés (IDs des items de la commande concernés)
    itemIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
    },

    // État actuel du retour
    statut: {
        type: String,
        required: true,
        enum: [
            'return_requested',    // Client demande le retour
            'return_pickup',       // Colis récupéré par le transporteur
            'return_received',     // Colis reçu en entrepôt (scan + photo obligatoire)
            'return_inspection',   // En cours d'inspection
            'resolved',            // Résolu
        ],
        default: 'return_requested',
    },

    // Décision de responsabilité (après inspection)
    responsabilite: {
        type: String,
        enum: ['commercant', 'transport', 'client', 'non_determinee'],
        default: 'non_determinee',
    },

    // Montant décidé pour la résolution (remboursement, débit, etc.)
    montantDecide: {
        type: Number,
        default: 0,
    },

    // Scans associés (IDs WarehouseScan)
    scans: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'warehousescan',
        default: [],
    },

    // Référence au remboursement (Refund) si applicable
    refundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'refund',
        default: null,
    },

    // Décision finale
    resolution: {
        type: String,
        enum: [
            'refund_client',    // Rembourser le client (RCOINS ou moyen d'origine)
            'reroute_to_seller',// Renvoyer au commerçant (bon état)
            'reject_return',    // Retour refusé (frais ou responsabilité client)
            'partial_refund',   // Remboursement partiel
        ],
        default: null,
    },

    // Note interne (visible uniquement par staff/admin)
    noteInterne: {
        type: String,
        trim: true,
        default: '',
        maxlength: 1000,
    },

    // Note visible par le client (optionnelle)
    noteClient: {
        type: String,
        trim: true,
        default: '',
        maxlength: 500,
    },

    // Traité par (staff qui a pris la décision finale)
    traitePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },

    // Date de résolution
    traiteLe: {
        type: Date,
        default: null,
    },

    // Date d'expiration (si le retour n'est pas traité dans les délais)
    expireLe: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

// Index pour les recherches fréquentes
returnCaseSchema.index({ statut: 1, createdAt: -1 });
returnCaseSchema.index({ orderId: 1 });
returnCaseSchema.index({ boutiqueId: 1, statut: 1 });

const ReturnCase = mongoose.models.returncase ||
    mongoose.model('returncase', returnCaseSchema);

export default ReturnCase;