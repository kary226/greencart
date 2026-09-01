import ReturnCase from '../models/ReturnCase.js';
import Order from '../models/Order.js';
import Refund from '../models/Refund.js';
import WarehouseScan from '../models/WarehouseScan.js';
import { traiterRetourColis } from './walletService.js';
import { journaliser } from './journalService.js';
import { ouvrirException } from './exceptionApprovalService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * ReturnWorkflowService  —  Guide RAMCI §10, §12, §15, §19 cas B et C
 * ===================================================================
 * « Retour de bout en bout. »
 *
 * QUI FAIT QUOI (§10, tableau des acteurs) :
 *   Support     enregistre la demande et rassemble les informations
 *   Opérations  réceptionne et inspecte le produit
 *   Finance     exécute le remboursement autorisé
 *   Super Admin tranche les cas complexes ou conflictuels
 *
 * LE POINT QUI COMPTE (§10, réponse directe) :
 * « Un retour NORMAL n'a pas besoin de la validation personnelle du Super
 * Admin. Si le retour devient complexe, litigieux ou exceptionnel, le
 * Super Admin a le dernier mot. »
 *
 * Ce que le code faisait avant : `resolveReturn` créait un Refund déjà
 * marqué `approved`, approuvé par son propre auteur (`approuvePar` =
 * `demandePar`), et déclenchait la reprise d'argent dans la foulée. Le rôle
 * de Finance (§10 : « exécute le remboursement autorisé ») était donc
 * court-circuité : Opérations décidait ET exécutait le mouvement financier.
 * Ici, Opérations DÉCIDE, Finance EXÉCUTE — le Refund naît `requested`.
 */

/** Étapes du retour, dans l'ordre (§10). */
export const ETAPES_RETOUR = Object.freeze({
    return_requested: { numero: 1, libelle: 'Demande enregistrée', responsable: 'support' },
    return_pickup: { numero: 2, libelle: 'Colis récupéré', responsable: 'operations' },
    return_received: { numero: 3, libelle: 'Reçu à l’entrepôt', responsable: 'operations' },
    return_inspection: { numero: 4, libelle: 'En inspection', responsable: 'operations' },
    resolved: { numero: 5, libelle: 'Résolu', responsable: 'finance' },
});

/** Table unique des transitions — même principe que pour les commandes (§15). */
export const TRANSITIONS_RETOUR = Object.freeze({
    return_requested: ['return_pickup', 'return_received', 'resolved'],
    return_pickup: ['return_received', 'resolved'],
    return_received: ['return_inspection', 'resolved'],
    return_inspection: ['resolved'],
    resolved: [],
});

export const transitionRetourAutorisee = (depuis, vers) =>
    (TRANSITIONS_RETOUR[depuis] || []).includes(vers);

/** Résolutions possibles. Le terme « seller » est proscrit (§0, §7). */
export const RESOLUTIONS = Object.freeze({
    refund_client: 'Rembourser le client',
    partial_refund: 'Rembourser partiellement',
    renvoyer_commercant: 'Renvoyer l’article au commerçant',
    reject_return: 'Refuser le retour',
    // Ancienne valeur, conservée : des dossiers en base la portent.
    reroute_to_seller: 'Renvoyer l’article au commerçant',
});

/** Résolutions qui engagent de l'argent — donc Finance (§10, §11). */
const RESOLUTIONS_FINANCIERES = ['refund_client', 'partial_refund'];

// ─────────────────────────────────────────────────────────────────────────
// 1. OUVERTURE  (Support — §10)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Support enregistre la demande de retour et rassemble les informations.
 * Une seule instance par commande : `ReturnCase.orderId` est unique.
 */
export const ouvrirRetour = async ({ orderId, acteur, motif, itemIds = [], boutiqueId = null }) => {
    const order = await Order.findById(orderId);
    if (!order) return { ok: false, code: 404, message: 'Commande introuvable' };

    // On ne retourne que ce qui a été livré ou au moins expédié : un colis
    // encore en collecte s'annule, il ne se « retourne » pas.
    if (!['Delivered', 'Out for Delivery', 'Shipped'].includes(order.status)) {
        return {
            ok: false,
            code: 409,
            message: `Un retour ne peut être ouvert que sur une commande expédiée ou livrée (statut actuel : ${order.status})`,
        };
    }

    const existant = await ReturnCase.findOne({ orderId });
    if (existant) {
        return { ok: false, code: 409, message: 'Un retour est déjà ouvert sur cette commande', retour: existant };
    }

    const retour = await ReturnCase.create({
        orderId,
        boutiqueId,
        itemIds,
        statut: 'return_requested',
        noteInterne: String(motif || '').slice(0, 1000),
    });

    await journaliser({
        acteur: { id: acteur._id, nom: acteur.nom, role: acteur.role },
        action: 'returns.ouverture',
        cible: { id: retour._id, libelle: `Retour ${retour._id}` },
        note: `Motif: ${motif || '—'}`,
    });

    return { ok: true, code: 201, retour, message: 'Retour enregistré' };
};

// ─────────────────────────────────────────────────────────────────────────
// 2. RÉCEPTION ET INSPECTION  (Opérations — §10)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fait avancer un retour dans son cycle, en contrôlant la transition.
 * `photos` est exigé à la réception : sans preuve visuelle, l'état constaté
 * n'est opposable à personne le jour où le commerçant conteste.
 */
export const avancerRetour = async ({ retour, acteur, vers, note = '', photos = [], etat = null }) => {
    if (!transitionRetourAutorisee(retour.statut, vers)) {
        return {
            ok: false,
            code: 409,
            message: `Transition impossible : « ${ETAPES_RETOUR[retour.statut]?.libelle || retour.statut} » → « ${ETAPES_RETOUR[vers]?.libelle || vers} »`,
        };
    }

    if (vers === 'return_received' && (!photos || photos.length === 0)) {
        return {
            ok: false,
            code: 400,
            message: 'Au moins une photo est obligatoire à la réception du colis retourné',
        };
    }

    if (['return_received', 'return_inspection'].includes(vers)) {
        const scan = await WarehouseScan.create({
            orderId: retour.orderId,
            boutiqueId: retour.boutiqueId || null,
            type: vers === 'return_received' ? 'retour_reception' : 'retour_inspection',
            scannePar: acteur._id,
            photos: photos || [],
            note: note || (etat ? `État constaté : ${etat}` : ''),
        });
        if (!retour.scans.some((s) => String(s) === String(scan._id))) {
            retour.scans.push(scan._id);
        }
    }

    retour.statut = vers;
    if (note) retour.noteInterne = `${retour.noteInterne}\n${note}`.trim().slice(0, 1000);
    await retour.save();

    await journaliser({
        acteur: { id: acteur._id, nom: acteur.nom, role: acteur.role },
        action: vers === 'return_received' ? 'returns.reception' : 'returns.inspect',
        cible: { id: retour._id, libelle: `Retour ${retour._id}` },
        note: `${vers}${etat ? ` — état : ${etat}` : ''}`,
    });

    return { ok: true, retour, message: `Retour passé à « ${ETAPES_RETOUR[vers].libelle} »` };
};

// ─────────────────────────────────────────────────────────────────────────
// 3. RÉSOLUTION  (§10, §11, §19 cas B)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Résout un retour NORMAL. Pas de Super Admin dans la boucle (§10 : « un
 * retour normal n'a pas besoin de la validation personnelle du Super
 * Admin »).
 *
 * La reprise d'argent au commerçant est immédiate — c'est la conséquence
 * mécanique du retour physique (§8 : « retour → conséquence financière
 * selon le résultat »). Le remboursement AU CLIENT, lui, naît `requested` :
 * il attend Finance (§10, §11 « Finance exécute le remboursement
 * autorisé »).
 */
export const resoudreRetour = async ({
    retour,
    acteur,
    resolution,
    responsabilite = 'non_determinee',
    montantDecide = 0,
    motif = '',
    methode = 'rcoins',
    noteInterne = '',
    noteClient = '',
}) => {
    if (retour.statut === 'resolved') {
        return { ok: false, code: 409, message: 'Ce retour est déjà résolu' };
    }
    if (!Object.keys(RESOLUTIONS).includes(resolution)) {
        return {
            ok: false,
            code: 400,
            message: `Résolution invalide. Options : ${Object.keys(RESOLUTIONS).join(', ')}`,
        };
    }
    // Décider sans avoir vu le colis, c'est décider sur la parole du client.
    if (retour.statut === 'return_requested') {
        return {
            ok: false,
            code: 409,
            message: 'Le colis doit avoir été réceptionné et inspecté avant résolution',
        };
    }

    const order = await Order.findById(retour.orderId);
    if (!order) return { ok: false, code: 404, message: 'Commande introuvable' };

    let refund = null;
    if (RESOLUTIONS_FINANCIERES.includes(resolution)) {
        const montant = Math.round(Number(montantDecide) || 0) || order.amount;
        if (montant > order.amount) {
            return {
                ok: false,
                code: 400,
                message: `Le montant (${montant} FCFA) dépasse celui de la commande (${order.amount} FCFA)`,
            };
        }

        refund = await Refund.create({
            orderId: order._id,
            itemIds: retour.itemIds || [],
            montantApprouve: montant,
            methode,
            // ── LE CHANGEMENT ──────────────────────────────────────────
            // 'requested', pas 'approved'. Auparavant Opérations créait un
            // remboursement déjà approuvé, avec `approuvePar` = son propre
            // auteur : celui qui décide du retour signait aussi la sortie
            // d'argent. §10 sépare les deux : Opérations inspecte et décide,
            // Finance exécute.
            statut: 'requested',
            refundId: uuidv4(),
            demandePar: acteur._id,
            approuvePar: null,
            motif: motif || `Retour résolu — ${RESOLUTIONS[resolution]}`,
            plafondNetAutorise: montant,
            noteInterne,
            noteClient,
        });

        await journaliser({
            acteur: { id: acteur._id, nom: acteur.nom, role: acteur.role },
            action: 'refund.requested',
            cible: { id: refund._id, libelle: `Remboursement ${refund.refundId}` },
            note: `Montant: ${montant} FCFA — à exécuter par Finance`,
        });
    }

    // Reprise de l'argent côté commerçant + stock. Idempotent.
    const resultatFinancier = await traiterRetourColis(order, {
        boutiqueIds: retour.boutiqueId ? [retour.boutiqueId] : null,
        etat: responsabilite === 'commercant' ? 'endommage' : 'bon_etat',
    });

    retour.statut = 'resolved';
    retour.resolution = resolution;
    retour.responsabilite = responsabilite;
    retour.montantDecide = Math.round(Number(montantDecide) || 0);
    retour.refundId = refund?._id || null;
    retour.noteInterne = noteInterne || retour.noteInterne;
    retour.noteClient = noteClient || '';
    retour.traitePar = acteur._id;
    retour.traiteLe = new Date();
    await retour.save();

    await journaliser({
        acteur: { id: acteur._id, nom: acteur.nom, role: acteur.role },
        action: 'returns.resolve',
        cible: { id: retour._id, libelle: `Retour ${retour._id}` },
        note: `Résolution: ${resolution}, responsabilité: ${responsabilite}`,
    });

    return {
        ok: true,
        retour,
        refund,
        resultatFinancier,
        message: refund
            ? 'Retour résolu — remboursement transmis à Finance pour exécution'
            : 'Retour résolu',
    };
};

// ─────────────────────────────────────────────────────────────────────────
// 4. ESCALADE  (§10, §12, §19 cas C)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Remonte un retour contesté au Super Admin (§19 cas C : « si le conflit
 * reste sans solution automatique, le Super Admin tranche »).
 *
 * Le dossier n'est PAS résolu : le figer résolu avant l'arbitrage
 * reviendrait à trancher soi-même.
 */
export const escaladerRetour = async ({ retour, acteur, motif }) => {
    if (retour.statut === 'resolved') {
        return { ok: false, code: 409, message: 'Ce retour est déjà résolu' };
    }

    const order = await Order.findById(retour.orderId).select('amount').lean();

    const resultat = await ouvrirException({
        type: 'return_conteste',
        acteur,
        motif,
        montant: order?.amount || 0,
        cible: { modele: 'returncase', id: retour._id, libelle: `Retour ${retour._id}` },
        payload: { returnCaseId: retour._id, orderId: retour.orderId },
    });

    if (!resultat.ok) return resultat;

    await journaliser({
        acteur: { id: acteur._id, nom: acteur.nom, role: acteur.role },
        action: 'returns.escalade',
        cible: { id: retour._id, libelle: `Retour ${retour._id}` },
        note: `Motif: ${motif}`,
    });

    return {
        ok: true,
        retour,
        approval: resultat.approval,
        message: 'Retour escaladé — le Super Admin tranchera',
    };
};

/** Avancement lisible par le client (§6, §14). */
export const avancementRetour = (retour) => {
    const etape = ETAPES_RETOUR[retour?.statut] || { numero: 0, libelle: '—', responsable: '—' };
    return {
        etape: etape.numero,
        total: 5,
        libelle: etape.libelle,
        responsable: etape.responsable,
        termine: retour?.statut === 'resolved',
    };
};

export default {
    ouvrirRetour,
    avancerRetour,
    resoudreRetour,
    escaladerRetour,
    avancementRetour,
    TRANSITIONS_RETOUR,
};
