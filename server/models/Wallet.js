import mongoose from "mongoose";
// Import explicite plutôt que mongoose.model('wallettransaction') à la
// volée : recalculer un solde exige que le modèle des transactions soit
// enregistré, et rien ne garantit qu'un script l'ait importé avant. Sans
// cet import, la méthode échoue selon l'ordre de chargement des fichiers —
// exactement le genre de panne qui n'apparaît qu'en production.
import WalletTransaction from "./WalletTransaction.js";

// Portefeuille d'un commerçant, à DEUX SOLDES.
//
// Pourquoi deux soldes et non deux portefeuilles : l'argent qui passe de
// « en attente » à « disponible » ne doit jamais pouvoir se perdre entre
// deux documents. Ici le transfert est une écriture comptable dans un seul
// portefeuille — il ne peut pas y avoir de moitié de virement.
//
//   soldeEnAttente : crédité DÈS la commande. Le commerçant VOIT son argent,
//                    ce qui est la condition pour qu'il accepte de remettre
//                    le colis. Mais il ne peut pas encore le retirer.
//
//   solde          : argent LIBÉRÉ par l'admin, seul retirable.
//                    Le champ garde son nom d'origine : tout le code
//                    existant qui vérifie « le portefeuille est-il soldé ? »
//                    avant une suppression continue de fonctionner, et
//                    continue de parler du bon montant (le retirable).
const walletSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
        unique: true,
    },
    // Disponible : retirable.
    solde: {
        type: Number,
        default: 0,
        min: 0,
    },
    // En attente : visible, pas encore retirable.
    soldeEnAttente: {
        type: Number,
        default: 0,
        min: 0,
    },
}, { timestamps: true });

// Recalcule les DEUX soldes depuis l'historique des transactions.
//
// Les transactions sont la source de vérité : les soldes ne sont qu'un
// cache. On peut donc toujours reconstruire un portefeuille faux à partir
// de son historique — propriété indispensable dès qu'il s'agit d'argent.
walletSchema.methods.recalculerSoldes = async function () {
    const resultats = await WalletTransaction.aggregate([
        { $match: { walletId: this._id } },
        {
            $group: {
                // Les transactions antérieures à la mise en place des deux
                // soldes n'ont pas de champ `compte` : elles concernaient de
                // l'argent déjà acquis, donc disponible.
                _id: { $ifNull: ['$compte', 'disponible'] },
                total: { $sum: '$montant' },
            },
        },
    ]);

    const parCompte = new Map(resultats.map((r) => [r._id, r.total]));

    // Jamais de solde négatif affiché : un total négatif signalerait une
    // incohérence de données, pas une dette du commerçant.
    this.solde = Math.max(0, parCompte.get('disponible') || 0);
    this.soldeEnAttente = Math.max(0, parCompte.get('en_attente') || 0);

    await this.save();
    return { solde: this.solde, soldeEnAttente: this.soldeEnAttente };
};

// Conservé sous son ancien nom : du code appelle encore recalculerSolde().
walletSchema.methods.recalculerSolde = async function () {
    const { solde } = await this.recalculerSoldes();
    return solde;
};

walletSchema.index({ ownerId: 1 });

const Wallet = mongoose.models.wallet || mongoose.model('wallet', walletSchema);

export default Wallet;
