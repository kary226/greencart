import Order from '../models/Order.js';
import DemandeRetrait from '../models/DemandeRetrait.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import ReturnCase from '../models/ReturnCase.js';
import Refund from '../models/Refund.js';
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
        if (aUnDesDroits(staff, [P.EXCEPTIONS_DECIDE, P.EXCEPTIONS_VIEW])) {
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
                    lien: '/admin/commandes?litige=1',
                    urgence: 'haute',
                    domaine: 'direction',
                }));
            }
        }

        // ── Finance (§8, §9, §11) ───────────────────────────────────────
        if (aUnDesDroits(staff, [P.WITHDRAWALS_VIEW, P.WITHDRAWALS_PROCESS, P.WALLET_VIEW])) {
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

        if (aUnDesDroits(staff, [P.REFUNDS_VIEW, P.REFUNDS_APPROVE])) {
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
                    lien: '/admin/warehouse',
                    urgence: 'haute',
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
                    lien: '/admin/deliveries',
                    urgence: 'haute',
                    domaine: 'operations',
                }));
            }
        }

        // ── Support (§10, §12) ──────────────────────────────────────────
        if (aUnDesDroits(staff, [P.DISPUTES_VIEW, P.RETURNS_VIEW])) {
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
            // Le message quand il n'y a rien : dire « rien à faire » vaut
            // mieux qu'un écran vide, qui se lit comme un chargement raté.
            message: taches.length === 0
                ? 'Rien ne vous attend pour le moment.'
                : `${taches.reduce((n, t) => n + t.nombre, 0)} élément(s) attendent votre intervention.`,
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
