import Order from '../models/Order.js';
import DemandeRetrait from '../models/DemandeRetrait.js';
import Wallet from '../models/Wallet.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import ReturnCase from '../models/ReturnCase.js';
import Refund from '../models/Refund.js';
import JournalAction from '../models/JournalAction.js';
import { ROLES, libelleDuRole, domaineDuRole, PERMISSIONS as P } from '../configs/roles.js';
import { aLeDroit, aUnDesDroits } from '../middlewares/permission.js';

/**
 * CONSOLE  —  Guide RAMCI §14
 * ===========================
 * « Chaque acteur doit d'abord voir ce qu'il doit faire MAINTENANT. Les
 * détails techniques restent secondaires. »
 *
 * Avant, chaque écran admin chargeait sa propre liste et comptait ses
 * propres badges ; personne n'avait de vue « voici tes trois tâches ». Un
 * Admin Finance devait ouvrir quatre pages pour savoir s'il avait du travail.
 *
 * Cette route renvoie, pour le compte connecté, la liste des choses qui
 * L'ATTENDENT LUI — filtrée par ses permissions, pas par son rôle (§16).
 * Un compte qui cumule Finance et Opérations voit les deux, sans compte
 * supplémentaire (§13).
 */

/**
 * Une tâche = quelque chose à faire, un compteur, et où aller.
 * `urgence` sert au tri : ce qui bloque de l'argent ou un client passe devant.
 *
 * RÈGLE : une tâche n'apparaît que si le compte peut RÉELLEMENT l'accomplir.
 * On teste donc une permission d'ACTION (`withdrawals.process`), jamais de
 * lecture (`withdrawals.view`).
 *
 * Sans cette règle, l'Auditeur — qui a le droit de tout voir et celui de ne
 * rien modifier — se voyait proposer « 3 retraits à traiter » et « 2
 * exceptions à trancher ». Il cliquait, et chaque bouton lui était refusé.
 * Ceux qui ne font que consulter reçoivent la vue de contrôle plus bas.
 */
const tache = ({ cle, libelle, nombre, lien, urgence = 'normale', domaine }) => ({
    cle, libelle, nombre, lien, urgence, domaine,
});

// ─── GET /api/console ──────────────────────────────────────────────
export const maConsole = async (req, res) => {
    try {
        const staff = req.staffUser;
        const taches = [];

        // ── Direction : les exceptions d'abord (§1, §4, §12) ────────────
        //
        // Le Super Admin voit en premier ce que personne d'autre ne peut
        // trancher. Le reste — retraits, retours, commandes — est le travail
        // quotidien des domaines : §4, « il n'a pas besoin d'intervenir
        // lorsqu'un retrait normal respecte la procédure ».
        if (aLeDroit(staff, P.EXCEPTIONS_DECIDE)) {
            const exceptions = await ApprovalRequest.countDocuments({ statut: 'en_attente' });
            if (exceptions > 0) {
                taches.push(tache({
                    cle: 'exceptions',
                    libelle: exceptions === 1 ? 'Exception à trancher' : 'Exceptions à trancher',
                    nombre: exceptions,
                    lien: '/admin/approvals',
                    urgence: 'haute',
                    domaine: 'direction',
                }));
            }

            const litiges = await Order.countDocuments({ 'litige.enCours': true });
            if (litiges > 0) {
                taches.push(tache({
                    cle: 'litiges',
                    libelle: litiges === 1 ? 'Litige en cours' : 'Litiges en cours',
                    nombre: litiges,
                    lien: '/admin/litiges',
                    urgence: 'haute',
                    domaine: 'direction',
                }));
            }
        }

        // ── Finance (§8, §9, §11) ───────────────────────────────────────
        if (aUnDesDroits(staff, [P.WITHDRAWALS_PROCESS, P.WITHDRAWALS_APPROVE])) {
            const retraits = await DemandeRetrait.countDocuments({ statut: 'en_attente' });
            if (retraits > 0) {
                taches.push(tache({
                    cle: 'retraits',
                    libelle: retraits === 1 ? 'Retrait à traiter' : 'Retraits à traiter',
                    nombre: retraits,
                    lien: '/admin/withdrawals',
                    // Un retrait en attente, c'est de l'argent réservé qui
                    // ne bouge pas : le commerçant l'a déjà perdu de son
                    // solde disponible (§8).
                    urgence: 'haute',
                    domaine: 'finance',
                }));
            }

            const enCours = await DemandeRetrait.countDocuments({ statut: 'en_cours' });
            if (enCours > 0) {
                taches.push(tache({
                    cle: 'retraits_en_cours',
                    libelle: 'Virement(s) à confirmer (référence manquante)',
                    nombre: enCours,
                    lien: '/admin/withdrawals?statut=en_cours',
                    urgence: 'normale',
                    domaine: 'finance',
                }));
            }
        }

        if (aUnDesDroits(staff, [P.REFUNDS_APPROVE, P.REFUNDS_CREATE])) {
            // §10 : « Finance exécute le remboursement autorisé. » Ces
            // remboursements viennent d'être décidés par Opérations et
            // attendent Finance — c'est le lien qui manquait entre les deux.
            const aExecuter = await Refund.countDocuments({ statut: { $in: ['requested', 'approved'] } });
            if (aExecuter > 0) {
                taches.push(tache({
                    cle: 'remboursements',
                    libelle: aExecuter === 1 ? 'Remboursement à exécuter' : 'Remboursements à exécuter',
                    nombre: aExecuter,
                    lien: '/admin/refunds',
                    urgence: 'haute',
                    domaine: 'finance',
                }));
            }
        }

        if (aLeDroit(staff, P.ORDERS_APPROVE)) {
            // Commandes réceptionnées, sans litige, jamais libérées : ce sont
            // exactement celles que la règle du §8 rend payables.
            const aLiberer = await Order.countDocuments({
                status: 'Shipped',
                confirmeParAdminLe: null,
                'litige.enCours': { $ne: true },
            });
            if (aLiberer > 0) {
                taches.push(tache({
                    cle: 'liberation_fonds',
                    libelle: 'Commande(s) prête(s) — fonds à libérer',
                    nombre: aLiberer,
                    lien: '/admin/commandes?aValider=1',
                    urgence: 'normale',
                    domaine: 'finance',
                }));
            }
        }

        // ── Opérations (§7, §10) ────────────────────────────────────────
        if (aUnDesDroits(staff, [P.ORDERS_RECEIVE, P.WAREHOUSE_SCAN])) {
            const aReceptionner = await Order.countDocuments({ status: 'Ready for Shipment' });
            if (aReceptionner > 0) {
                taches.push(tache({
                    cle: 'reception',
                    libelle: 'Colis à réceptionner',
                    nombre: aReceptionner,
                    // [FIX] Pointait vers /admin/warehouse — l'écran de scan/
                    // journal, qui ne fait avancer aucun statut de commande.
                    // La vraie action (receptionnerColis) vit sur l'écran
                    // "Réception & remise", ajouté depuis.
                    lien: '/admin/reception',
                    urgence: 'haute',
                    domaine: 'operations',
                }));
            }

            // [NOUVEAU] Symétrique de la tâche ci-dessus, pour l'autre moitié
            // du même écran : un colis peut être réceptionné (Shipped) sans
            // que personne n'ait encore confirmé l'avoir remis en main au
            // livreur — cette tâche n'existait pas du tout, donc "Réception
            // & remise" n'avait jamais de compteur alors qu'il pouvait
            // pourtant y avoir une action en attente.
            const aRemettre = await Order.countDocuments({
                status: 'Shipped',
                livreurId: { $ne: null },
                remiseLivreurConfirmee: { $ne: true },
            });
            if (aRemettre > 0) {
                taches.push(tache({
                    cle: 'remise_livreur',
                    libelle: 'Remise(s) au livreur à confirmer',
                    nombre: aRemettre,
                    lien: '/admin/reception',
                    urgence: 'normale',
                    domaine: 'operations',
                }));
            }
        }

        if (aUnDesDroits(staff, [P.RETURNS_INSPECT, P.RETURNS_DECIDE])) {
            const aInspecter = await ReturnCase.countDocuments({
                statut: { $in: ['return_received', 'return_inspection'] },
            });
            if (aInspecter > 0) {
                taches.push(tache({
                    cle: 'retours_inspection',
                    libelle: 'Retour(s) à inspecter ou résoudre',
                    nombre: aInspecter,
                    lien: '/admin/returns',
                    urgence: 'normale',
                    domaine: 'operations',
                }));
            }
        }

        if (aLeDroit(staff, P.DELIVERIES_ASSIGN)) {
            const aAssigner = await Order.countDocuments({ status: 'Shipped', livreurId: null });
            if (aAssigner > 0) {
                taches.push(tache({
                    cle: 'livreur_a_assigner',
                    libelle: 'Commande(s) sans livreur',
                    nombre: aAssigner,
                    // [FIX] Pointait vers /admin/deliveries — un écran de
                    // suivi, sans aucun moyen d'assigner qui que ce soit.
                    // L'action réelle vit sur l'écran "Réassigner un livreur".
                    lien: '/admin/reassignation-livreur',
                    urgence: 'haute',
                    domaine: 'operations',
                }));
            }
        }

        // ── Support (§10, §12) ──────────────────────────────────────────
        if (aUnDesDroits(staff, [P.DISPUTES_OPEN, P.DISPUTES_RESPOND, P.RETURNS_DECIDE])) {
            const retoursOuverts = await ReturnCase.countDocuments({
                statut: { $in: ['return_requested', 'return_pickup'] },
            });
            if (retoursOuverts > 0) {
                taches.push(tache({
                    cle: 'retours_suivi',
                    libelle: 'Retour(s) en attente de récupération',
                    nombre: retoursOuverts,
                    lien: '/admin/returns',
                    urgence: 'normale',
                    domaine: 'support',
                }));
            }
        }

        // ── Commerçant (§14) ────────────────────────────────────────────
        if (aLeDroit(staff, P.ORDERS_CONFIRM) && staff.boutiqueId) {
            const aConfirmer = await Order.countDocuments({
                status: { $in: ['Order Placed', 'Checking Availability'] },
                'items.boutiqueId': staff.boutiqueId,
                'confirmationsBoutiques.boutiqueId': { $ne: staff.boutiqueId },
            });
            if (aConfirmer > 0) {
                taches.push(tache({
                    cle: 'articles_a_confirmer',
                    libelle: 'Article(s) à confirmer',
                    nombre: aConfirmer,
                    lien: '/commercant/commandes',
                    urgence: 'haute',
                    domaine: 'commercant',
                }));
            }

            // Un retrait refusé lui a été recrédité, mais rien ne le lui
            // disait tant qu'il n'ouvrait pas l'écran des retraits. C'est
            // pourtant la nouvelle qu'il attend le plus.
            const retraitsRejetes = await DemandeRetrait.countDocuments({
                commercialId: staff._id,
                statut: 'rejetee',
                traiteLe: { $gte: new Date(Date.now() - 7 * 86400000) },
            });
            if (retraitsRejetes > 0) {
                taches.push(tache({
                    cle: 'retrait_rejete',
                    libelle: retraitsRejetes === 1 ? 'Retrait refusé — fonds restitués' : 'Retraits refusés — fonds restitués',
                    nombre: retraitsRejetes,
                    lien: '/commercant/retraits',
                    urgence: 'haute',
                    domaine: 'commercant',
                }));
            }

            // Solde négatif : une dette née d'un retour arrivé après un
            // retrait. Elle se résorbe seule, mais il doit savoir pourquoi
            // son prochain retrait est bloqué.
            const wallet = await Wallet.findOne({ ownerId: staff._id }).select('solde').lean();
            if (wallet && wallet.solde < 0) {
                taches.push(tache({
                    cle: 'solde_negatif',
                    libelle: 'Solde négatif — à combler par vos ventes',
                    nombre: 1,
                    lien: '/commercant/portefeuille',
                    urgence: 'haute',
                    domaine: 'commercant',
                }));
            }
        }

        // ── Vue de contrôle (§3 : l'Auditeur voit et contrôle) ──────────
        //
        // Ce ne sont pas des tâches : personne n'attend une action. C'est ce
        // qu'un rôle de consultation doit avoir sous les yeux pour faire son
        // travail — le journal, et les dossiers en cours qu'il peut relire.
        const surveillance = [];
        if (aLeDroit(staff, P.AUDIT_VIEW)) {
            const [actions24h, exceptionsOuvertes, retraitsOuverts] = await Promise.all([
                JournalAction.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } }),
                ApprovalRequest.countDocuments({ statut: 'en_attente' }),
                DemandeRetrait.countDocuments({ statut: { $in: ['en_attente', 'en_cours', 'escalade'] } }),
            ]);

            surveillance.push(
                { cle: 'journal', libelle: 'Actions enregistrées ces 24 h', nombre: actions24h, lien: '/admin/audit' },
                { cle: 'exceptions_ouvertes', libelle: 'Exceptions ouvertes', nombre: exceptionsOuvertes, lien: '/admin/approvals' },
                { cle: 'retraits_ouverts', libelle: 'Retraits en cours de traitement', nombre: retraitsOuverts, lien: '/admin/withdrawals' },
            );
        }

        const rangUrgence = { haute: 0, normale: 1, basse: 2 };
        taches.sort((a, b) => rangUrgence[a.urgence] - rangUrgence[b.urgence] || b.nombre - a.nombre);

        return res.json({
            success: true,
            acteur: {
                nom: staff.nom,
                role: staff.role,
                // Le libellé vient de configs/roles.js : plus aucun écran
                // n'affiche « Seller » (§0, convention de nommage).
                roleLibelle: libelleDuRole(staff.role),
                domaine: domaineDuRole(staff.role),
                description: ROLES[staff.role]?.description || '',
            },
            taches,
            surveillance,
            // Le message quand il n'y a rien : dire « rien à faire » vaut
            // mieux qu'un écran vide, qui se lit comme un chargement raté.
            // Un rôle de consultation n'a jamais de tâche : lui annoncer
            // « rien ne vous attend » serait trompeur, son travail est ailleurs.
            message: taches.length > 0
                ? `${taches.reduce((n, t) => n + t.nombre, 0)} élément(s) attendent votre intervention.`
                : surveillance.length > 0
                    ? 'Aucune action ne vous revient — voici l’état du système.'
                    : 'Rien ne vous attend pour le moment.',
        });
    } catch (error) {
        console.error('Erreur maConsole:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET /api/console/roles ────────────────────────────────────────
//
// Le frontend a besoin des libellés et des domaines pour construire ses
// menus. Les lui servir depuis la source unique évite la dérive classique :
// un rôle renommé côté serveur mais toujours « Seller » côté écran (§0).
export const listerRoles = async (req, res) => {
    res.json({
        success: true,
        roles: Object.entries(ROLES).map(([cle, r]) => ({
            role: cle,
            libelle: r.libelle,
            domaine: r.domaine,
            description: r.description,
            deprecie: r.deprecie || null,
            nombrePermissions: r.permissions.length,
        })),
    });
};

// ─── GET /api/console/mes-droits ───────────────────────────────────
//
// §16 : « Le frontend masque ; le backend protège réellement. » Le frontend
// masque MIEUX s'il sait ce qu'il doit masquer — au lieu de le déduire du
// rôle, ce qui redevient faux dès qu'on ajoute une permission sur mesure.
export const mesDroits = async (req, res) => {
    res.json({
        success: true,
        // `nom` est repris ici pour que les écrans n'aient pas à appeler
        // /api/staff/is-auth en plus juste pour afficher un prénom.
        nom: req.staffUser.nom,
        role: req.staffUser.role,
        roleLibelle: libelleDuRole(req.staffUser.role),
        domaine: domaineDuRole(req.staffUser.role),
        permissions: req.staffUser.permissions || [],
        estArbitre: aLeDroit(req.staffUser, P.EXCEPTIONS_DECIDE),
    });
};