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
    couponApplied: { type: String, default: null },
    address: { type: String, required: true, ref: 'address' },
    status: { 
        type: String, 
        default: 'pending_payment',
        enum: ['pending_payment', 'Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled']
    },
    paymentType: { type: String, required: true },
    isPaid: { type: Boolean, required: true, default: false },
    // Référence de transaction Jèko.
    jeko_reference: { type: String, default: null },
    estimatedDeliveryStart: { type: Date, default: null },
    estimatedDeliveryEnd: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
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
}, { timestamps: true });

// Index pour accélérer les requêtes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ livreurId: 1 });

const Order = mongoose.models.order || mongoose.model('order', orderSchema);

export default Order;