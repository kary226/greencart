import mongoose from "mongoose";

/**
 * EXCEPTION  —  Guide RAMCI §13, §15, §20
 * =======================================
 *
 * Ce modèle ne sert PLUS à ralentir les opérations normales.
 *
 * Ce qu'il faisait avant : tout retrait dépassant un seuil ouvrait
 * automatiquement une demande d'approbation, qu'un second administrateur
 * devait traiter. Le guide écarte explicitement ce fonctionnement (§9,
 * §19 cas A) : « pas besoin d'un deuxième Admin Finance uniquement à cause
 * du montant ». Un montant élevé n'est pas une anomalie — c'est une
 * boutique qui marche.
 *
 * Ce qu'il fait maintenant (§13) : il porte les VRAIES exceptions, celles
 * qu'aucune règle automatique ne couvre —
 *   - un ajustement de portefeuille important ;
 *   - un remboursement hors des règles prévues ;
 *   - un dossier suspect, incohérent ou contesté remonté par un domaine ;
 *   - un litige que Support, Opérations et Finance n'ont pas su clore.
 *
 * Qui tranche : le Super Admin (§1 « autorité finale », §12 étape 7).
 * Les domaines DEMANDENT une exception, ils ne se l'accordent pas.
 */

const approvalRequestSchema = new mongoose.Schema({
    // Nature de l'exception.
    type: {
        type: String,
        enum: [
            'wallet_adjust',        // ajustement de portefeuille important (§13)
            'withdrawal_escalated', // retrait suspect/contesté remonté (§9)
            'refund_exceptionnel',  // remboursement hors règles (§11)
            'return_conteste',      // retour litigieux (§10, §19 cas C)
            'litige',               // conflit entre services (§12)
            'role_change',          // droits critiques (§13)
            // Conservé : d'anciennes demandes en base portent ces valeurs.
            'withdrawal',
            'refund',
        ],
        required: true,
    },

    // Domaine qui a remonté le dossier — sert à savoir qui rappeler quand
    // la décision tombe, et à mesurer d'où viennent les exceptions (§17.9).
    domaine: {
        type: String,
        enum: ['finance', 'operations', 'support', 'catalogue', 'direction', 'systeme'],
        default: 'systeme',
    },

    // POURQUOI ce dossier sort des règles normales. Obligatoire en pratique
    // (voir exceptionApprovalService) : une exception sans motif est une
    // validation de confort, exactement ce que le §13 cherche à éliminer.
    motif: {
        type: String,
        trim: true,
        default: '',
    },

    // Référence de l'objet concerné (commande, retrait, retour...), pour
    // retrouver le dossier sans fouiller le payload.
    cible: {
        modele: { type: String, default: null },
        id: { type: mongoose.Schema.Types.ObjectId, default: null },
        libelle: { type: String, default: '' },
    },
    // Payload : données nécessaires pour exécuter l'action une fois approuvée
    payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    // Montant concerné, s'il y en a un. Plus obligatoire : un litige de
    // livraison ou un changement de droits n'a pas de montant, et l'exiger
    // forçait à écrire des 0 qui n'avaient aucun sens.
    montant: {
        type: Number,
        default: 0,
    },
    // Demandeur (celui qui a initié l'action)
    demandePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        required: true,
    },
    // Statut de la demande
    statut: {
        type: String,
        enum: ['en_attente', 'approuvee', 'rejetee', 'expiree'],
        default: 'en_attente',
    },
    // Approbateur (celui qui a pris la décision)
    approuvePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'staffuser',
        default: null,
    },
    // Date de la décision
    decideLe: {
        type: Date,
        default: null,
    },
    // Commentaire de l'approbateur
    commentaire: {
        type: String,
        trim: true,
        default: '',
    },
    // Date d'expiration (par défaut 48h)
    expireLe: {
        type: Date,
        default: () => new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
}, { timestamps: true });

// Index pour les recherches fréquentes
approvalRequestSchema.index({ statut: 1, createdAt: -1 });
approvalRequestSchema.index({ demandePar: 1, statut: 1 });
approvalRequestSchema.index({ approuvePar: 1 });
approvalRequestSchema.index({ domaine: 1, statut: 1 });
approvalRequestSchema.index({ 'cible.id': 1 });

const ApprovalRequest = mongoose.models.approvalrequest ||
    mongoose.model('approvalrequest', approvalRequestSchema);

export default ApprovalRequest;