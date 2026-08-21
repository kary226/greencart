import mongoose from "mongoose";

// Écriture comptable du portefeuille d'un commerçant.
//
// Les transactions sont la SOURCE DE VÉRITÉ : les deux soldes du
// portefeuille en sont recalculés (Wallet.recalculerSoldes). Un solde faux
// se répare donc toujours, tant que l'historique est intact.
//
// Chaque écriture précise sur QUEL compte elle agit — c'est ce qui permet
// aux deux soldes de coexister sans ambiguïté. Une libération de fonds
// s'écrit en DEUX transactions (une sortie « en_attente », une entrée
// « disponible ») : à aucun moment l'argent n'existe en double ni ne
// disparaît, et l'opération se relit entièrement dans l'historique.
const walletTransactionSchema = new mongoose.Schema({
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'wallet',
        required: true,
    },
    type: {
        type: String,
        enum: [
            'vente',        // crédit à la commande (arrive en attente)
            'liberation',   // transfert en attente -> disponible (2 écritures)
            'retrait',      // sortie vers le commerçant
            'ajustement',   // correction manuelle
            'annulation',   // reprise d'un crédit (commande annulée/retournée)
        ],
        required: true,
    },
    // Compte visé. Absent sur les transactions antérieures aux deux soldes :
    // elles portaient de l'argent déjà acquis, donc traitées comme
    // « disponible » au recalcul (voir Wallet.recalculerSoldes).
    compte: {
        type: String,
        enum: ['en_attente', 'disponible'],
        default: 'disponible',
    },
    montant: {
        type: Number,
        required: true,
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'order',
        default: null,
    },
    // Boutique concernée : une commande multi-boutiques produit une écriture
    // par boutique, il faut pouvoir les distinguer.
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'boutique',
        default: null,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    demandeRetraitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'demanderetrait',
        default: null,
    },
    soldeApres: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ orderId: 1 });
walletTransactionSchema.index({ demandeRetraitId: 1 });
// Sert au garde-fou anti-double-crédit : « cette commande a-t-elle déjà été
// créditée pour cette boutique ? »
walletTransactionSchema.index({ orderId: 1, boutiqueId: 1, type: 1 });

const WalletTransaction = mongoose.models.wallettransaction ||
    mongoose.model('wallettransaction', walletTransactionSchema);

export default WalletTransaction;
