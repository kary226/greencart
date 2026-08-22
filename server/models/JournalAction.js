import mongoose from "mongoose";

// Journal des actions du staff — qui a fait quoi, quand, sur quoi.
//
// Motivation directe : un commerçant peut supprimer un article de sa
// boutique, y compris un article fourni par la plateforme. C'est voulu, mais
// une suppression sans trace est irrécupérable ET inexplicable — personne ne
// peut dire ce qui a disparu ni qui l'a fait. Le journal rend l'action
// réversible dans les faits : on sait exactement ce qu'il faut recréer.
//
// Ce n'est PAS une copie de sauvegarde : `apercu` retient de quoi identifier
// et reconstituer l'essentiel (nom, code, prix, stock), pas l'article entier.
const journalActionSchema = new mongoose.Schema({
    // Auteur. Dénormalisé volontairement (nom + rôle recopiés) : le compte
    // peut être supprimé plus tard, la trace doit rester lisible.
    acteurId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },
    acteurNom: { type: String, default: '—', trim: true },
    acteurRole: { type: String, default: 'inconnu', trim: true },

    action: {
        type: String,
        required: true,
        enum: [
            'produit.creation',
            'produit.modification',
            'produit.stock',
            'produit.archivage',
            'produit.suppression',
            'produit.restauration',
            'commande.liberation',
            'commande.litige_declare',
            'commande.litige_resolu',
            'commande.ajustement',
            'commande.remboursement_manuel',
            'commande.forcage_statut',
            'commande.remise_livreur',
            'commande.assignation_livreur',
            // [PHASE 0] Nouvelles actions sensibles (gouvernance financière et comptes)
            'wallet.ajustement',
            'retrait.approbation',
            'retrait.rejet',
            'staff.statut',
            'staff.role',
            'staff.suppression',
            'staff.invitation',
            'boutique.statut',
            'boutique.autorisations',
        ],
        index: true,
    },

    // Cible de l'action, également dénormalisée pour survivre à sa suppression.
    cibleId: { type: mongoose.Schema.Types.ObjectId, default: null },
    cibleLibelle: { type: String, default: '', trim: true },

    boutiqueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'boutique',
        default: null,
        index: true,
    },

    // Instantané au moment de l'action : de quoi comprendre la portée sans
    // avoir à recouper avec autre chose.
    apercu: {
        sku: { type: String, default: null },
        prix: { type: Number, default: null },
        stock: { type: Number, default: null },
        nombreImages: { type: Number, default: null },
        origine: { type: String, default: null },
    },

    // Précision libre : « archivé car déjà commandé », « champs refusés »...
    note: { type: String, default: '', trim: true },
}, { timestamps: true });

// Les deux lectures réelles : le journal complet trié par date, et le
// journal d'une boutique donnée.
journalActionSchema.index({ createdAt: -1 });
journalActionSchema.index({ boutiqueId: 1, createdAt: -1 });

const JournalAction = mongoose.models.journalaction
    || mongoose.model('journalaction', journalActionSchema);

export default JournalAction;