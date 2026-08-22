import mongoose from "mongoose";

/**
 * WarehouseScan – Traçabilité physique des opérations en entrepôt.
 *
 * Pourquoi une collection séparée plutôt qu'un simple champ sur Order ?
 *   - Une commande peut avoir plusieurs scans (réception, préparation, expédition)
 *   - Un retour peut nécessiter une inspection avec photo
 *   - On garde l'historique complet des mouvements physiques
 *
 * Chaque scan est horodaté et rattaché à un staffuser (warehouse_admin ou admin).
 * Les photos sont stockées sur Cloudinary et référencées ici.
 */
const warehouseScanSchema = new mongoose.Schema({
    // Commande concernée
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'order',
        required: true,
        index: true,
    },

    // Article concerné (si scan sur un article spécifique, sinon null pour un scan global)
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },

    // Boutique concernée (pour les commandes multi-boutiques)
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'boutique',
        default: null,
        index: true,
    },

    // Type d'opération
    type: {
        type: String,
        required: true,
        enum: [
            'reception',        // Colis reçu en entrepôt
            'preparation',      // Colis en cours de préparation
            'expedition',       // Colis préparé et envoyé vers le livreur
            'retour_reception', // Colis retourné reçu en entrepôt
            'retour_inspection', // Inspection du colis retourné (avec photos)
            'retour_decision',  // Décision finale prise (bon état / endommagé)
        ],
    },

    // Staff qui a effectué le scan
    scannePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
    },

    // Date du scan (par défaut maintenant, mais permet de renseigner une date passée)
    scanneLe: {
        type: Date,
        default: Date.now,
    },

    // Emplacement physique en entrepôt (optionnel)
    emplacement: {
        type: String,
        trim: true,
        default: null,
    },

    // Photos prises lors du scan (ex: photo du colis à la réception, photo de l'inspection retour)
    photos: {
        type: [String],
        default: [],
    },

    // Note libre (état constaté, anomalies, etc.)
    note: {
        type: String,
        trim: true,
        default: '',
        maxlength: 500,
    },

    // Métadonnées supplémentaires (poids mesuré, dimensions, etc.)
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });

// Index pour les requêtes fréquentes
warehouseScanSchema.index({ orderId: 1, type: 1 });
warehouseScanSchema.index({ scannePar: 1, scanneLe: -1 });
warehouseScanSchema.index({ orderId: 1, boutiqueId: 1 });

const WarehouseScan = mongoose.models.warehousescan ||
    mongoose.model('warehousescan', warehouseScanSchema);

export default WarehouseScan;