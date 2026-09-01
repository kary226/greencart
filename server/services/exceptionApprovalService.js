import ApprovalRequest from '../models/ApprovalRequest.js';
import StaffUser from '../models/StaffUser.js';
import PushSubscription from '../models/PushSubscription.js';
import { journaliser } from './journalService.js';
import { sendEmail } from '../configs/email.js';
import webpush from '../configs/webpush.js';
import { ROLES_ARBITRE, PERMISSIONS, domaineDuRole } from '../configs/roles.js';

/**
 * ExceptionApprovalService  —  Guide RAMCI §13, §15, §20
 * ======================================================
 * « Seulement les décisions renforcées. »
 *
 * Une exception, c'est un dossier que les règles normales ne savent pas
 * clore. Trois garde-fous, et ils sont la raison d'être de ce fichier :
 *
 *   1. UN MOTIF EST OBLIGATOIRE. Sans lui, l'escalade devient un réflexe et
 *      le Super Admin se retrouve à valider des dossiers ordinaires — le
 *      travers exact que le §13 veut supprimer.
 *
 *   2. LE DEMANDEUR NE TRANCHE PAS. Même Super Admin. Une décision prise
 *      par celui qui l'a demandée n'est pas un arbitrage.
 *
 *   3. UN SEUL DOSSIER OUVERT PAR CIBLE. Deux exceptions sur le même
 *      retrait, ce sont deux décisions contradictoires possibles.
 */

/** Longueur minimale d'un motif — en dessous, ce n'est pas une explication. */
const MOTIF_MINIMUM = 10;

/**
 * Ce compte peut-il TRANCHER une exception ? (§1, §4)
 * Volontairement restrictif : c'est le point de décision finale du système.
 */
export const peutTrancher = (staffUser) => {
    if (!staffUser) return false;
    const perms = staffUser.permissions || [];
    return ROLES_ARBITRE.includes(staffUser.role)
        || perms.includes(PERMISSIONS.ADMIN_ALL)
        || perms.includes(PERMISSIONS.EXCEPTIONS_DECIDE);
};

/**
 * Ouvre une exception et la remonte au Super Admin.
 *
 * @param {object} params
 * @param {string} params.type      voir l'enum d'ApprovalRequest
 * @param {object} params.acteur    { _id|id, nom, role } — qui remonte le dossier
 * @param {string} params.motif     pourquoi ce dossier sort des règles (≥10 car.)
 * @param {object} [params.cible]   { modele, id, libelle }
 * @param {object} [params.payload] données nécessaires à l'exécution
 * @param {number} [params.montant]
 * @returns {Promise<{ok:boolean, approval?:object, message?:string, code?:number}>}
 */
export const ouvrirException = async ({
    type,
    acteur,
    motif,
    cible = {},
    payload = {},
    montant = 0,
}) => {
    const acteurId = acteur?._id || acteur?.id;
    if (!acteurId) {
        return { ok: false, code: 401, message: 'Acteur inconnu' };
    }

    // ── Anti-blocage : un arbitre n'escalade pas vers lui-même ──────────
    //
    // Découvert en exerçant le flux de bout en bout. Si celui qui remonte le
    // dossier est DÉJÀ le Super Admin, on aboutit à une impasse : plus
    // personne ne peut traiter le dossier au niveau du domaine (il est
    // escaladé) et le seul arbitre ne peut pas trancher sa propre demande.
    // Le retrait restait bloqué pour toujours, fonds réservés compris.
    //
    // Le §4 donne la sortie : « il peut agir lorsque ses permissions
    // l'autorisent ». Un Super Admin qui constate une anomalie n'a personne
    // à saisir — il décide. C'est aussi la situation d'une petite équipe
    // (§13), où l'arbitre est souvent celui qui regarde les dossiers.
    if (peutTrancher(acteur)) {
        return {
            ok: false,
            code: 409,
            message: "Vous avez déjà l'autorité finale sur ce dossier : traitez-le directement plutôt que de l'escalader",
        };
    }

    const motifPropre = String(motif || '').trim();
    if (motifPropre.length < MOTIF_MINIMUM) {
        return {
            ok: false,
            code: 400,
            message: `Un motif d'au moins ${MOTIF_MINIMUM} caractères est obligatoire pour ouvrir une exception`,
        };
    }

    // Un seul dossier ouvert par cible (§13).
    if (cible?.id) {
        const dejaOuverte = await ApprovalRequest.findOne({
            'cible.id': cible.id,
            statut: 'en_attente',
        });
        if (dejaOuverte) {
            return {
                ok: false,
                code: 409,
                message: 'Une exception est déjà ouverte sur ce dossier',
                approval: dejaOuverte,
            };
        }
    }

    const approval = await ApprovalRequest.create({
        type,
        domaine: domaineDuRole(acteur.role) === 'inconnu' ? 'systeme' : domaineDuRole(acteur.role),
        motif: motifPropre,
        cible: {
            modele: cible.modele || null,
            id: cible.id || null,
            libelle: cible.libelle || '',
        },
        payload,
        montant: Math.round(Number(montant) || 0),
        demandePar: acteurId,
    });

    await journaliser({
        acteur: { id: acteurId, nom: acteur.nom, role: acteur.role },
        action: 'exception.ouverte',
        cible: { id: approval._id, libelle: `Exception ${type}` },
        note: `Motif: ${motifPropre}`,
    });

    // Fire-and-forget : une notification qui tombe ne doit pas empêcher
    // l'exception d'exister.
    notifierArbitres(approval).catch((e) =>
        console.error('[exception] notification arbitres:', e.message)
    );

    return { ok: true, approval };
};

/**
 * Vérifie qu'une décision est recevable, AVANT d'exécuter quoi que ce soit.
 * Séparée de la décision elle-même pour être testable sans base.
 */
export const verifierDecision = (approval, acteur) => {
    if (!approval) return { ok: false, code: 404, message: 'Exception introuvable' };

    if (approval.statut !== 'en_attente') {
        return { ok: false, code: 409, message: `Cette exception est déjà ${approval.statut}` };
    }

    if (approval.expireLe && approval.expireLe < new Date()) {
        return { ok: false, code: 409, message: 'Cette exception a expiré — rouvrez un dossier' };
    }

    const acteurId = String(acteur?._id || acteur?.id || '');
    if (String(approval.demandePar) === acteurId) {
        return {
            ok: false,
            code: 403,
            message: 'Vous ne pouvez pas trancher votre propre demande',
        };
    }

    if (!peutTrancher(acteur)) {
        return {
            ok: false,
            code: 403,
            message: "Seul le Super Admin tranche une exception",
        };
    }

    return { ok: true };
};

/**
 * Tranche une exception. L'exécution métier est déléguée à l'appelant via
 * `executer` : ce service décide QUI peut trancher et trace la décision,
 * il ne sait rien des portefeuilles ni des retraits.
 *
 * @param {object} params
 * @param {object} params.approval
 * @param {object} params.acteur
 * @param {'approuvee'|'rejetee'} params.decision
 * @param {string} [params.commentaire]
 * @param {Function} [params.executer] async (approval, acteur) => any
 */
export const trancher = async ({ approval, acteur, decision, commentaire = '', executer = null }) => {
    const controle = verifierDecision(approval, acteur);
    if (!controle.ok) return controle;

    if (!['approuvee', 'rejetee'].includes(decision)) {
        return { ok: false, code: 400, message: 'Décision invalide' };
    }

    let resultat = null;
    if (decision === 'approuvee' && typeof executer === 'function') {
        // Si l'exécution échoue, l'exception RESTE en attente : marquer
        // « approuvée » une décision qui n'a rien produit rendrait le
        // journal mensonger et le dossier introuvable.
        resultat = await executer(approval, acteur);
    }

    approval.statut = decision;
    approval.approuvePar = acteur._id || acteur.id;
    approval.decideLe = new Date();
    approval.commentaire = String(commentaire || '').trim();
    await approval.save();

    await journaliser({
        acteur: { id: acteur._id || acteur.id, nom: acteur.nom, role: acteur.role },
        action: decision === 'approuvee' ? 'approval.approuvee' : 'approval.rejetee',
        cible: { id: approval._id, libelle: `Exception ${approval.type}` },
        note: `Motif initial: ${approval.motif} | Décision: ${commentaire || '—'}`,
    });

    return { ok: true, approval, resultat };
};

/** Compte les exceptions ouvertes — alimente l'écran d'accueil du Super Admin (§14). */
export const compterExceptionsOuvertes = async () =>
    ApprovalRequest.countDocuments({ statut: 'en_attente' });

// ─────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────

/**
 * Prévient ceux qui peuvent trancher. On cible les rôles arbitres plutôt
 * que « tout le monde chez Finance » : une exception qui arrive à quinze
 * personnes n'arrive à personne.
 */
const notifierArbitres = async (approval) => {
    const arbitres = await StaffUser.find({
        role: { $in: ROLES_ARBITRE },
        statut: 'actif',
    }).select('email nom _id');

    if (!arbitres.length) {
        console.warn('[exception] aucun Super Admin actif à prévenir');
        return;
    }

    const montant = approval.montant
        ? ` (${approval.montant.toLocaleString('fr-FR')} FCFA)`
        : '';
    const sujet = `Exception à trancher — ${approval.type}${montant}`;
    const corps = `Motif : ${approval.motif}`;

    for (const arbitre of arbitres) {
        try {
            await sendEmail(arbitre.email, sujet, `
                <h2>${sujet}</h2>
                <p>Bonjour ${arbitre.nom},</p>
                <p>${corps}</p>
                <p><a href="${process.env.FRONTEND_URL}/admin/approvals/${approval._id}">Ouvrir le dossier</a></p>
            `);
        } catch (e) {
            console.error('[exception] email:', e.message);
        }

        const abonnements = await PushSubscription.find({ userId: arbitre._id });
        for (const sub of abonnements) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
                    JSON.stringify({
                        title: sujet,
                        body: corps,
                        icon: '/logo.png',
                        data: { approvalId: approval._id },
                    })
                );
            } catch (e) {
                console.error('[exception] push:', e.message);
            }
        }
    }
};

export default { ouvrirException, trancher, verifierDecision, peutTrancher };
