import mongoose from "mongoose";

// Demande de retrait des fonds d'un commerçant.
//
// PRINCIPE CENTRAL : les fonds sont RÉSERVÉS dès la demande (le portefeuille
// est débité immédiatement), pas au moment du paiement. Sans cette
// réservation, la somme resterait affichée comme disponible entre la demande
// et le virement — le commerçant pourrait la redemander, ou un retour de
// colis pourrait la consommer entre-temps. Si la demande est rejetée, les
// fonds sont recrédités.
//
// Opérateurs proposés en liste fermée plutôt qu'en texte libre : un numéro
// mal recopié ou un opérateur mal orthographié, c'est un virement qui part
// au mauvais endroit.
export const OPERATEURS_RETRAIT = [
    { code: 'orange_money', libelle: 'Orange Money' },
    { code: 'mtn_money', libelle: 'MTN MoMo' },
    { code: 'moov_money', libelle: 'Moov Money' },
    { code: 'wave', libelle: 'Wave' },
];

const demandeRetraitSchema = new mongoose.Schema({
    commercialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
    },
    montant: {
        type: Number,
        required: true,
        min: 1000,
    },

    // ── Destination du virement ──────────────────────────────────────────
    operateur: {
        type: String,
        enum: OPERATEURS_RETRAIT.map((o) => o.code),
        required: true,
    },
    numero: {
        type: String,
        required: true,
        trim: true,
    },
    // Nom du titulaire du compte mobile money, pour que l'admin vérifie
    // avant d'envoyer : un numéro seul ne permet aucun contrôle.
    titulaire: {
        type: String,
        default: '',
        trim: true,
    },

    // ── Anti-doublon ─────────────────────────────────────────────────────
    //
    // Clé fournie par le client à chaque tentative. Un réseau capricieux
    // qui rejoue la même requête présente la MÊME clé : l'index unique
    // rejette la seconde écriture, et on renvoie la demande déjà créée au
    // lieu d'en ouvrir une deuxième. C'est la garantie qu'un seul retrait
    // part, même si le bouton est cliqué dix fois.
    cleIdempotence: {
        type: String,
        required: true,
        trim: true,
    },

    statut: {
        type: String,
        enum: [
            'en_attente',  // fonds réservés, à traiter par l'admin
            'en_cours',    // virement en cours d'exécution
            'payee',       // virement effectué
            'rejetee',     // refusée, fonds recrédités
        ],
        default: 'en_attente',
    },

    // Référence du virement (transaction mobile money), saisie par l'admin
    // comme preuve. C'est ce qui permet de retrouver le paiement en cas de
    // contestation du commerçant.
    reference: {
        type: String,
        default: '',
        trim: true,
    },
    preuvePaiement: {
        type: String,
        default: null,
    },
    traitePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },
    traiteLe: {
        type: Date,
        default: null,
    },
    noteAdmin: {
        type: String,
        default: '',
        trim: true,
    },
}, { timestamps: true });

demandeRetraitSchema.index({ commercialId: 1, createdAt: -1 });
demandeRetraitSchema.index({ statut: 1 });
// L'index UNIQUE est ce qui rend le doublon impossible au niveau de la base,
// pas seulement au niveau du code : deux requêtes simultanées ne peuvent pas
// toutes deux réussir, quel que soit l'ordre d'exécution.
demandeRetraitSchema.index({ cleIdempotence: 1 }, { unique: true });

const DemandeRetrait = mongoose.models.demanderetrait ||
    mongoose.model('demanderetrait', demandeRetraitSchema);

export default DemandeRetrait;
