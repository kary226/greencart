import DemandeRetrait, { OPERATEURS_RETRAIT } from '../models/DemandeRetrait.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import { journaliser } from './journalService.js';
import { ouvrirException } from './exceptionApprovalService.js';

/**
 * WithdrawalService  —  Guide RAMCI §9, §13, §15, §19 cas A, §20
 * ==============================================================
 * « Flux unique de demande et traitement. »
 *
 * LE CHANGEMENT CENTRAL
 * ---------------------
 * Avant : un retrait supérieur à un seuil (100 000 FCFA par défaut) ouvrait
 * une demande d'approbation, SANS réserver les fonds, et attendait un second
 * administrateur. Deux problèmes, tous deux corrigés ici :
 *
 *   1. Le guide écarte ce principe (§9, §19 cas A) : « Awa demande
 *      180 000 FCFA. Finance vérifie le solde, réserve le montant, effectue
 *      le paiement manuel et ajoute la référence. Pas besoin d'un deuxième
 *      Admin Finance uniquement à cause du montant. » Un gros montant n'est
 *      pas une anomalie, c'est une boutique qui marche.
 *
 *   2. La branche « au-dessus du seuil » ne réservait PAS les fonds. Le
 *      solde restait affiché comme disponible pendant toute l'approbation :
 *      le commerçant pouvait le redemander, ou un retour de colis pouvait
 *      le consommer entre-temps — exactement le risque que la réservation
 *      immédiate existait pour supprimer. Le seuil créait donc un trou
 *      d'autant plus large que le montant était élevé.
 *
 * Désormais : UN SEUL CHEMIN, quel que soit le montant.
 *   demande → vérification du solde → RÉSERVATION → traitement Finance
 *           → paiement manuel + référence → payé
 *
 * Ce qui déclenche une seconde paire d'yeux n'est plus le montant mais le
 * DOUTE (§9) : « le Super Admin intervient si le dossier est suspect,
 * incohérent, exceptionnel ou contesté ». D'où `escalader()`, décidé par un
 * humain, motif obligatoire.
 */

export const MONTANT_MINIMUM = 1000;

/** Statuts depuis lesquels une demande peut encore bouger. */
const STATUTS_OUVERTS = ['en_attente', 'en_cours', 'escalade'];

// ─────────────────────────────────────────────────────────────────────────
// VALIDATION  (pure — testable sans base)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Contrôle la forme d'une demande. Séparée des I/O pour être testable :
 * c'est la partie où une erreur envoie de l'argent au mauvais endroit.
 *
 * @returns {{ok:true, valeurs:object} | {ok:false, message:string}}
 */
export const validerDemande = ({ montant, operateur, numero, titulaire, cleIdempotence }) => {
    if (!cleIdempotence || !String(cleIdempotence).trim()) {
        return { ok: false, message: 'Requête invalide' };
    }

    const montantDemande = Math.round(Number(montant) || 0);
    if (!Number.isFinite(montantDemande) || montantDemande < MONTANT_MINIMUM) {
        return {
            ok: false,
            message: `Montant minimum de retrait : ${MONTANT_MINIMUM} FCFA`,
        };
    }

    if (!OPERATEURS_RETRAIT.some((o) => o.code === operateur)) {
        return { ok: false, message: 'Opérateur invalide' };
    }

    const numeroPropre = String(numero || '').replace(/\s/g, '');
    if (!/^\d{10}$/.test(numeroPropre)) {
        return { ok: false, message: 'Numéro invalide — 10 chiffres attendus' };
    }

    return {
        ok: true,
        valeurs: {
            montant: montantDemande,
            operateur,
            numero: numeroPropre,
            titulaire: String(titulaire || '').trim(),
            cleIdempotence: String(cleIdempotence).trim(),
        },
    };
};

/** Transitions autorisées — §9, flux unique. */
export const TRANSITIONS_RETRAIT = Object.freeze({
    en_attente: ['en_cours', 'escalade', 'payee', 'rejetee'],
    en_cours: ['escalade', 'payee', 'rejetee'],
    // Un dossier escaladé revient au circuit normal si le Super Admin le
    // renvoie, ou se termine par sa décision.
    escalade: ['en_attente', 'en_cours', 'payee', 'rejetee'],
    payee: [],
    rejetee: [],
});

export const transitionAutorisee = (depuis, vers) =>
    (TRANSITIONS_RETRAIT[depuis] || []).includes(vers);

// ─────────────────────────────────────────────────────────────────────────
// DEMANDE  (commerçant)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Enregistre une demande de retrait et RÉSERVE immédiatement les fonds.
 *
 * La réservation est faite dans le même geste que la création : entre les
 * deux, la somme resterait affichée comme disponible.
 *
 * @param {object} params
 * @param {object} params.commercant compte staff demandeur
 * @param {object} params.donnees    corps de la requête
 * @returns {Promise<{ok:boolean, code?:number, message?:string, demande?:object, rejeu?:boolean, soldeRestant?:number}>}
 */
export const demanderRetrait = async ({ commercant, donnees }) => {
    const controle = validerDemande(donnees);
    if (!controle.ok) return { ok: false, code: 400, message: controle.message };

    const { montant, operateur, numero, titulaire, cleIdempotence } = controle.valeurs;

    // Rejeu réseau : la même clé renvoie la demande déjà créée.
    const dejaCreee = await DemandeRetrait.findOne({ cleIdempotence });
    if (dejaCreee) {
        return { ok: true, code: 200, rejeu: true, demande: dejaCreee, message: 'Demande déjà enregistrée' };
    }

    const wallet = await Wallet.findOne({ ownerId: commercant._id });
    if (!wallet) return { ok: false, code: 404, message: 'Portefeuille introuvable' };
    await wallet.recalculerSoldes();

    if (wallet.solde < montant) {
        const complement = wallet.soldeEnAttente > 0
            ? ` ${wallet.soldeEnAttente.toLocaleString('fr-FR')} FCFA sont encore en attente de validation.`
            : '';
        return {
            ok: false,
            code: 400,
            message: `Solde disponible insuffisant : ${wallet.solde.toLocaleString('fr-FR')} FCFA.${complement}`,
        };
    }

    // Une seule demande ouverte à la fois : deux retraits simultanés sur le
    // même portefeuille, c'est une réservation qui saute.
    const enCours = await DemandeRetrait.findOne({
        commercialId: commercant._id,
        statut: { $in: STATUTS_OUVERTS },
    });
    if (enCours) {
        return {
            ok: false,
            code: 409,
            message: 'Une demande de retrait est déjà en cours de traitement',
        };
    }

    let demande;
    try {
        demande = await DemandeRetrait.create({
            commercialId: commercant._id,
            montant,
            operateur,
            numero,
            titulaire,
            cleIdempotence,
            statut: 'en_attente',
        });
    } catch (error) {
        // Course perdue sur l'index unique : l'autre requête a créé la
        // demande, on renvoie la sienne plutôt qu'une 500.
        if (error.code === 11000) {
            const existante = await DemandeRetrait.findOne({ cleIdempotence });
            return { ok: true, code: 200, rejeu: true, demande: existante, message: 'Demande déjà enregistrée' };
        }
        throw error;
    }

    await WalletTransaction.create({
        walletId: wallet._id,
        type: 'retrait',
        compte: 'disponible',
        montant: -montant,
        description: 'Retrait demandé — fonds réservés',
        demandeRetraitId: demande._id,
    });
    await wallet.recalculerSoldes();

    await journaliser({
        acteur: { id: commercant._id, nom: commercant.nom, role: commercant.role },
        action: 'retrait.demande',
        cible: { id: demande._id, libelle: `Demande retrait ${demande._id}` },
        note: `Montant: ${montant}, opérateur: ${operateur} — fonds réservés`,
    });

    return {
        ok: true,
        code: 201,
        demande,
        soldeRestant: wallet.solde,
        message: 'Demande enregistrée — le virement sera exécuté sous peu',
    };
};

// ─────────────────────────────────────────────────────────────────────────
// TRAITEMENT  (Finance, seule — §9, §13)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Restitue les fonds réservés d'une demande refusée. Idempotent : deux
 * rejets ne recréditent pas deux fois.
 */
const restituerFonds = async (demande) => {
    const wallet = await Wallet.findOne({ ownerId: demande.commercialId });
    if (!wallet) return false;

    const dejaRestitue = await WalletTransaction.exists({
        demandeRetraitId: demande._id,
        type: 'ajustement',
    });
    if (dejaRestitue) return false;

    await WalletTransaction.create({
        walletId: wallet._id,
        type: 'ajustement',
        compte: 'disponible',
        montant: demande.montant,
        description: 'Retrait refusé — fonds restitués',
        demandeRetraitId: demande._id,
    });
    await wallet.recalculerSoldes();
    return true;
};

/**
 * Traite une demande : en cours, payée ou rejetée. UNE personne Finance
 * autorisée suffit (§13 : « retrait normal → une personne Finance
 * autorisée »).
 *
 * @param {object} params
 * @param {object} params.demande
 * @param {object} params.acteur
 * @param {'en_cours'|'payee'|'rejetee'} params.statut
 * @param {string} [params.reference]      obligatoire pour « payee »
 * @param {string} [params.noteAdmin]
 * @param {string} [params.preuvePaiement]
 */
export const traiterRetrait = async ({ demande, acteur, statut, reference, noteAdmin, preuvePaiement }) => {
    if (!['en_cours', 'payee', 'rejetee'].includes(statut)) {
        return { ok: false, code: 400, message: 'Statut invalide' };
    }

    if (!transitionAutorisee(demande.statut, statut)) {
        return {
            ok: false,
            code: 409,
            message: `Transition impossible : ${demande.statut} → ${statut}`,
        };
    }

    // Un dossier escaladé attend la décision du Super Admin. Le laisser
    // traiter par Finance viderait l'escalade de son sens.
    if (demande.statut === 'escalade' && !acteurPeutLeverEscalade(acteur)) {
        return {
            ok: false,
            code: 403,
            message: 'Ce dossier est escaladé — seul le Super Admin peut le traiter',
        };
    }

    // La référence du virement est LA preuve opposable en cas de
    // contestation (§9 « preuve + référence »). Sans elle, « payé » est une
    // affirmation invérifiable.
    if (statut === 'payee' && !String(reference || '').trim()) {
        return {
            ok: false,
            code: 400,
            message: 'La référence du virement est obligatoire pour marquer un retrait payé',
        };
    }

    if (statut === 'rejetee') {
        await restituerFonds(demande);
    }

    demande.statut = statut;
    demande.traitePar = acteur._id;
    demande.traiteLe = new Date();
    if (noteAdmin !== undefined) demande.noteAdmin = String(noteAdmin).trim();
    if (reference !== undefined) demande.reference = String(reference).trim();
    if (preuvePaiement) demande.preuvePaiement = preuvePaiement;
    if (statut !== 'escalade') demande.escalade.active = false;
    await demande.save();

    const actions = { payee: 'retrait.approbation', rejetee: 'retrait.rejet', en_cours: 'retrait.en_cours' };
    await journaliser({
        acteur: { id: acteur._id, nom: acteur.nom, role: acteur.role },
        action: actions[statut],
        cible: { id: demande._id, libelle: `Demande retrait ${demande._id}` },
        note: `Montant: ${demande.montant}, opérateur: ${demande.operateur}, référence: ${reference || '—'}`,
    });

    const messages = {
        en_cours: 'Virement marqué en cours',
        payee: 'Retrait marqué comme payé',
        rejetee: 'Demande rejetée — fonds restitués au commerçant',
    };

    return { ok: true, demande, message: messages[statut] };
};

const acteurPeutLeverEscalade = (acteur) => {
    const perms = acteur?.permissions || [];
    return ['super_admin', 'admin'].includes(acteur?.role)
        || perms.includes('admin.all')
        || perms.includes('exceptions.decide');
};

// ─────────────────────────────────────────────────────────────────────────
// ESCALADE  (§9 : suspect, incohérent, exceptionnel ou contesté)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Remonte un retrait au Super Admin. Remplace la double validation par
 * seuil : ce n'est plus le montant qui déclenche le contrôle, c'est le
 * doute d'un humain qui regarde le dossier.
 *
 * Les fonds RESTENT réservés : un dossier douteux est justement celui où on
 * ne veut pas que la somme redevienne disponible.
 */
export const escalader = async ({ demande, acteur, motif }) => {
    if (!STATUTS_OUVERTS.includes(demande.statut)) {
        return { ok: false, code: 409, message: `Cette demande est déjà ${demande.statut}` };
    }
    if (demande.statut === 'escalade') {
        return { ok: false, code: 409, message: 'Ce dossier est déjà escaladé' };
    }

    const resultat = await ouvrirException({
        type: 'withdrawal_escalated',
        acteur,
        motif,
        montant: demande.montant,
        cible: {
            modele: 'demanderetrait',
            id: demande._id,
            libelle: `Retrait ${demande.montant} FCFA`,
        },
        payload: {
            demandeRetraitId: demande._id,
            commercialId: demande.commercialId,
            montant: demande.montant,
            operateur: demande.operateur,
            numero: demande.numero,
        },
    });

    if (!resultat.ok) return resultat;

    demande.escalade = {
        active: true,
        motif: String(motif).trim(),
        parId: acteur._id,
        parNom: acteur.nom,
        le: new Date(),
        approvalId: resultat.approval._id,
        statutAvant: demande.statut,
    };
    demande.statut = 'escalade';
    await demande.save();

    await journaliser({
        acteur: { id: acteur._id, nom: acteur.nom, role: acteur.role },
        action: 'retrait.escalade',
        cible: { id: demande._id, libelle: `Demande retrait ${demande._id}` },
        note: `Motif: ${motif}`,
    });

    return {
        ok: true,
        demande,
        approval: resultat.approval,
        message: 'Dossier escaladé — le Super Admin tranchera',
    };
};

/**
 * Exécute la décision du Super Admin sur un retrait escaladé.
 * Appelée par exceptionApprovalService.trancher via son `executer`.
 */
export const executerDecisionEscalade = async (approval, arbitre, { paye = false, reference = '' } = {}) => {
    const demande = await DemandeRetrait.findById(approval.payload?.demandeRetraitId);
    if (!demande) throw new Error('Demande de retrait introuvable');

    // Approuver, c'est rendre le dossier au circuit normal : Finance
    // effectue le virement et saisit la référence. On ne marque pas « payé »
    // à la place de celui qui fait le virement.
    if (!paye) {
        demande.statut = demande.escalade?.statutAvant || 'en_attente';
        demande.escalade.active = false;
        await demande.save();
        return { demande, message: 'Dossier rendu au circuit normal' };
    }

    return traiterRetrait({ demande, acteur: arbitre, statut: 'payee', reference });
};

/** Annule un retrait escaladé rejeté par le Super Admin : fonds restitués. */
export const executerRejetEscalade = async (approval, arbitre) => {
    const demande = await DemandeRetrait.findById(approval.payload?.demandeRetraitId);
    if (!demande) return null;
    if (!STATUTS_OUVERTS.includes(demande.statut)) return demande;

    await restituerFonds(demande);
    demande.statut = 'rejetee';
    demande.traitePar = arbitre._id;
    demande.traiteLe = new Date();
    demande.escalade.active = false;
    demande.noteAdmin = `Rejeté par le Super Admin — ${approval.commentaire || approval.motif}`;
    await demande.save();

    await journaliser({
        acteur: { id: arbitre._id, nom: arbitre.nom, role: arbitre.role },
        action: 'retrait.rejet',
        cible: { id: demande._id, libelle: `Demande retrait ${demande._id}` },
        note: `Rejet après escalade — fonds restitués`,
    });

    return demande;
};

export default {
    demanderRetrait,
    traiterRetrait,
    escalader,
    validerDemande,
    transitionAutorisee,
    MONTANT_MINIMUM,
};
