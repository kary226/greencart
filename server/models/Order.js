import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
    product: { type: String, required: true, ref: 'product' },
    quantity: { type: Number, required: true },
    color: { type: String, default: null },
    size: { type: String, default: null },
    priceAtOrder: { type: Number, required: true },
    // ✅ INSTANTANÉ PRODUIT : copié une fois pour toutes à la création de la
    // commande. Une commande ne doit JAMAIS dépendre de l'état actuel du
    // produit — si celui-ci est modifié, archivé ou supprimé plus tard,
    // l'historique du client doit rester identique à ce qu'il a vraiment
    // acheté. `name`/`image` sans `default` volontairement absents sur les
    // anciennes commandes (créées avant ce champ) : le frontend retombe sur
    // `populate('items.product')` dans ce cas (voir getUserOrders).
    name: { type: String, default: null },
    image: { type: String, default: null },
    sku: { type: String, default: null },
    availabilityStatus: {
        type: String,
        enum: ['pending', 'available', 'unavailable', 'collected'],
        default: 'pending',
    },
    unavailableReason: { type: String, default: null },
    collectedAt: { type: Date, default: null },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'staffuser', default: null },
    // ✅ NOUVEAU PHASE 3 : Boutique du produit au moment de la commande.
    // [FIX] null est une valeur valide et volontaire (produit du magasin
    // principal, hors système commerçant) — jekoController.js et
    // orderController.js écrivent explicitement `product.boutiqueId || null`.
    // required:true rejetait donc toute commande contenant un produit
    // "normal", ce qui est la quasi-totalité des commandes.
    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'boutique',
        default: null,
    }
});

const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true, ref: 'user' },
    items: [orderItemSchema],
    amount: { type: Number, required: true },
    deliveryPrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    // Montant en RCOINS (crédit interne client) déduit du total de cette
    // commande. Débité de User.creditBalance à la création de la commande —
    // voir server/models/CustomerCredit.js (debiterClient).
    creditUsed: { type: Number, default: 0 },
    // Horodatage du remboursement de `creditUsed`, posé une seule fois si la
    // commande n'aboutit jamais (annulation client ou échec de paiement).
    // Sert de verrou atomique : deux chemins peuvent tenter le remboursement
    // pour la même commande (POST /order/cancel côté client ET le webhook
    // Jèko en cas de statut d'échec) — seul le premier à passer ce filtre
    // (creditRefundedAt: null) déclenche réellement le crédit. Voir
    // rembourserCreditAnnulation() dans models/CustomerCredit.js.
    creditRefundedAt: { type: Date, default: null },
    couponApplied: { type: String, default: null },
    address: { type: String, required: true, ref: 'address' },
    status: { 
        type: String, 
        default: 'pending_payment',
        // [FIX] 'Checking Availability', 'Collecting' et 'Ready for Shipment'
        // sont posés par confirmerCommandeCommercant / reserverCollecte /
        // collecterArticle, mais manquaient de cet enum : chaque order.save()
        // qui tentait ces statuts échouait avec une ValidationError Mongoose,
        // ce qui bloquait tout le circuit (confirmation commerçant, réservation
        // livreur, collecte) sans message clair côté client.
        enum: ['pending_payment', 'Order Placed', 'Checking Availability', 'Confirmed', 'Collecting', 'Ready for Shipment', 'Shipped', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled', 'Disputed']
    },
    // ✅ RETOUR COLIS — précise, au moment où le statut passe à 'Returned',
    // si les articles reviennent en état revendable (réintégrés au stock)
    // ou sont endommagés/invendables (argent repris au commerçant, mais
    // stock NON réincrémenté). Posé une seule fois par celui qui constate
    // le retour (admin) — voir traiterRetourColis() dans walletService.js.
    retourEtat: {
        type: String,
        enum: ['bon_etat', 'endommage'],
        default: null,
    },
    retourNote: { type: String, default: null, trim: true },
    retourTraiteLe: { type: Date, default: null },
    paymentType: { type: String, required: true },
    isPaid: { type: Boolean, required: true, default: false },
    // Référence de transaction Jèko.
    jeko_reference: { type: String, default: null },
    estimatedDeliveryStart: { type: Date, default: null },
    estimatedDeliveryEnd: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    refundDue: { type: Number, default: 0 },
    refundCreditedAt: { type: Date, default: null },
    // ✅ NOUVEAU PHASE 3 : Livreur assigné
    livreurId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
        index: true,
    },

    // ── Circuit de confirmation multi-boutiques ──────────────────────────
    //
    // Une commande peut concerner plusieurs boutiques. Chaque commerçant
    // concerné doit confirmer qu'il a VU la commande et MIS SON COLIS DE
    // CÔTÉ. Quand tous ont confirmé, la commande devient prête côté admin.
    //
    // On enregistre une ligne par boutique plutôt qu'un simple booléen :
    // c'est le seul moyen de savoir QUI n'a pas encore confirmé, donc qui
    // relancer quand une commande traîne.
    confirmationsBoutiques: [{
        boutiqueId: { type: mongoose.Schema.Types.ObjectId, ref: 'boutique', required: true },
        // Dénormalisé : le compte peut être supprimé, la trace doit rester.
        confirmeParNom: { type: String, default: '' },
        confirmePar: { type: mongoose.Schema.Types.ObjectId, ref: 'staffuser', default: null },
        confirmeLe: { type: Date, default: Date.now },
    }],

    // Validation finale par l'admin : c'est ELLE qui libère les fonds des
    // commerçants (passage du solde « en attente » au solde retirable).
    confirmeParAdminLe: { type: Date, default: null },
    confirmeParAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },
    // Réservation atomique d'une collecte par un livreur.
    collecteLivreurId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
        index: true,
    },
    collecteReserveeLe: { type: Date, default: null },
    // [NOUVEAU] Expiration de la réservation de collecte (doc §9-10) : une
    // commande réservée par un livreur qui abandonne son téléphone ne doit
    // pas rester bloquée indéfiniment. Voir services/collecteService.js —
    // libérée automatiquement si aucun article n'a encore été collecté.
    collecteExpireLe: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    shippedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'staffuser', default: null },

    // [NOUVEAU] Remise physique du colis par le Seller au livreur en charge
    // de la livraison finale — distincte de la collecte (commerçant →
    // entrepôt) et distincte de Shipped (entrepôt → prêt à partir). Tant
    // que ce n'est pas confirmé, le livreur ne peut pas passer la commande
    // à 'Out for Delivery' : sans ce verrou, rien ne garantissait qu'il
    // avait vraiment le colis en main avant de partir livrer.
    remiseLivreurConfirmee: { type: Boolean, default: false },
    remiseLivreurConfirmeeLe: { type: Date, default: null },

    // ── Litiges (doc §15) ─────────────────────────────────────────────────
    //
    // Un litige déclaré AVANT Shipped/libération bloque explicitement la
    // libération financière (voir services/walletService + orderController
    // confirmerCommandeAdmin). Après libération, il ne modifie jamais
    // l'historique déjà écrit : il ne peut que créer une retenue (dette
    // commerçant) ou un remboursement client exceptionnel, en plus.
    litige: {
        enCours: { type: Boolean, default: false },
        raison: { type: String, default: null, trim: true },
        declarePar: { type: mongoose.Schema.Types.ObjectId, ref: 'staffuser', default: null },
        declareParNom: { type: String, default: null },
        declareLe: { type: Date, default: null },
        // Statut logistique interrompu par le passage à 'Disputed', pour le
        // restaurer tel quel une fois le litige résolu.
        statutAvant: { type: String, default: null },
        resoluLe: { type: Date, default: null },
        resoluPar: { type: mongoose.Schema.Types.ObjectId, ref: 'staffuser', default: null },
        resolution: {
            type: String,
            enum: ['classe', 'dette_commercant', 'remboursement_client', null],
            default: null,
        },
        note: { type: String, default: null, trim: true },
    },
}, { timestamps: true });

// Index pour accélérer les requêtes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
// livreurId a déjà `index: true` sur le champ — .index() redondant supprimé.
orderSchema.index({ 'litige.enCours': 1 });
orderSchema.index({ collecteExpireLe: 1 });

const Order = mongoose.models.order || mongoose.model('order', orderSchema);

export default Order;