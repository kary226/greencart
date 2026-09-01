import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    TRANSITIONS,
    ETAPES,
    verifierTransition,
    transitionner,
    peutTransitionner,
    avancement,
} from '../services/orderWorkflowService.js';
import {
    evaluerEligibilite,
    etatLiberation,
    MOTIFS,
} from '../services/fundsReleaseService.js';
import {
    validerDemande,
    transitionAutorisee,
    TRANSITIONS_RETRAIT,
    MONTANT_MINIMUM,
} from '../services/withdrawalService.js';
import { TRANSITIONS_RETOUR, transitionRetourAutorisee } from '../services/returnWorkflowService.js';
import { verifierDecision, peutTrancher } from '../services/exceptionApprovalService.js';

console.error = () => {};

const commande = (surcharges = {}) => ({
    _id: 'cmd1',
    status: 'Shipped',
    items: [{ product: 'p1', quantity: 1, priceAtOrder: 1000, boutiqueId: 'b1' }],
    confirmationsBoutiques: [{ boutiqueId: 'b1' }],
    confirmeParAdminLe: null,
    litige: { enCours: false },
    ...surcharges,
});

// ═════════════════════════════════════════════════════════════════════════
describe('RAMCI §5 — cycle de commande : table unique de transitions', () => {

    it('couvre chaque statut du modèle Order', () => {
        const statutsModele = [
            'pending_payment', 'Order Placed', 'Checking Availability', 'Confirmed',
            'Collecting', 'Ready for Shipment', 'Shipped', 'Out for Delivery',
            'Delivered', 'Returned', 'Cancelled', 'Disputed',
        ];
        for (const statut of statutsModele) {
            assert.ok(statut in TRANSITIONS, `Statut absent de la table : ${statut}`);
            assert.ok(statut in ETAPES, `Statut sans étape lisible : ${statut}`);
        }
    });

    it('ne mène jamais vers un statut inconnu', () => {
        for (const [depuis, cibles] of Object.entries(TRANSITIONS)) {
            for (const vers of cibles) {
                assert.ok(vers in TRANSITIONS, `${depuis} mène vers un statut inconnu : ${vers}`);
            }
        }
    });

    it('laisse passer le chemin nominal du guide, étape par étape', () => {
        const chemin = [
            'pending_payment', 'Order Placed', 'Checking Availability', 'Confirmed',
            'Collecting', 'Ready for Shipment', 'Shipped', 'Out for Delivery', 'Delivered',
        ];
        for (let i = 0; i < chemin.length - 1; i++) {
            const resultat = verifierTransition(chemin[i], chemin[i + 1]);
            assert.strictEqual(resultat.ok, true, `${chemin[i]} → ${chemin[i + 1]} devrait être permis`);
        }
    });

    it('interdit de sauter les étapes — le bug que §5 vise', () => {
        // C'est exactement ce que permettait le findByIdAndUpdate direct
        // d'updateOrderStatus : livrer une commande jamais collectée.
        assert.strictEqual(verifierTransition('Order Placed', 'Delivered').ok, false);
        assert.strictEqual(verifierTransition('Confirmed', 'Shipped').ok, false);
        assert.strictEqual(verifierTransition('pending_payment', 'Shipped').ok, false);
    });

    it('les statuts terminaux ne mènent nulle part', () => {
        for (const terminal of ['Returned', 'Cancelled']) {
            assert.deepStrictEqual(TRANSITIONS[terminal], []);
        }
    });

    it('§2 — « Disputed » n’est pas une étape du flux normal', () => {
        for (const [depuis, cibles] of Object.entries(TRANSITIONS)) {
            assert.ok(!cibles.includes('Disputed'), `${depuis} ne doit pas mener à Disputed`);
        }
    });

    it('§12 — une commande en litige est gelée', () => {
        const order = commande({ status: 'Shipped', litige: { enCours: true } });
        const resultat = transitionner({ order, vers: 'Out for Delivery', verifierDroits: false });
        assert.strictEqual(resultat.ok, false);
        assert.strictEqual(resultat.code, 409);
        assert.strictEqual(order.status, 'Shipped', 'le statut ne doit pas avoir bougé');
    });

    it('applique la transition sur l’objet quand elle est valide', () => {
        const order = commande({ status: 'Ready for Shipment' });
        const resultat = transitionner({ order, vers: 'Shipped', verifierDroits: false });
        assert.strictEqual(resultat.ok, true);
        assert.strictEqual(order.status, 'Shipped');
    });

    describe('§16 — droits par transition', () => {
        it('le Super Admin peut tout', () => {
            const superAdmin = { role: 'super_admin', permissions: ['admin.all'] };
            for (const statut of Object.keys(TRANSITIONS)) {
                assert.strictEqual(peutTransitionner(superAdmin, statut), true);
            }
        });

        it('un livreur ne réceptionne pas à l’entrepôt', () => {
            const livreur = { role: 'livreur', permissions: ['deliveries.update_status'] };
            assert.strictEqual(peutTransitionner(livreur, 'Shipped'), false);
        });

        it('Opérations réceptionne', () => {
            const ops = { role: 'operations_admin', permissions: ['orders.receive'] };
            assert.strictEqual(peutTransitionner(ops, 'Shipped'), true);
        });
    });

    describe('§6 — le client voit un résultat, pas la mécanique', () => {
        it('rend une étape sur six, jamais un statut technique', () => {
            const vue = avancement(commande({ status: 'Collecting' }));
            assert.strictEqual(vue.etape, 3);
            assert.strictEqual(vue.total, 6);
            assert.ok(!/collecting/i.test(vue.libelle));
        });

        it('signale une commande terminée et une commande en exception', () => {
            assert.strictEqual(avancement(commande({ status: 'Delivered' })).termine, true);
            assert.strictEqual(avancement(commande({ status: 'Disputed' })).enException, true);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════
describe('RAMCI §8 — règle unique de libération des fonds', () => {

    it('libère une commande réceptionnée, sans litige', () => {
        assert.strictEqual(evaluerEligibilite(commande()).eligible, true);
    });

    it('bloque tant que le colis n’est pas réceptionné (§7)', () => {
        const resultat = evaluerEligibilite(commande({ status: 'Confirmed' }));
        assert.strictEqual(resultat.eligible, false);
        assert.strictEqual(resultat.motif, MOTIFS.STATUT);
    });

    it('bloque en cas de litige — le verrou qui manquait dans libererFonds', () => {
        const resultat = evaluerEligibilite(commande({ litige: { enCours: true } }));
        assert.strictEqual(resultat.eligible, false);
        assert.strictEqual(resultat.motif, MOTIFS.LITIGE);
    });

    it('le litige prime sur le statut : bloqué même hors réception', () => {
        const resultat = evaluerEligibilite(commande({ status: 'Confirmed', litige: { enCours: true } }));
        assert.strictEqual(resultat.motif, MOTIFS.LITIGE);
    });

    it('ne libère pas deux fois', () => {
        const resultat = evaluerEligibilite(commande({ confirmeParAdminLe: new Date() }));
        assert.strictEqual(resultat.eligible, false);
        assert.strictEqual(resultat.motif, MOTIFS.DEJA_LIBERE);
    });

    it('une commande sans boutique n’a rien à libérer, sans être « bloquée »', () => {
        const order = commande({
            items: [{ product: 'p1', quantity: 1, priceAtOrder: 1000, boutiqueId: null }],
            confirmationsBoutiques: [],
        });
        const resultat = evaluerEligibilite(order);
        assert.strictEqual(resultat.eligible, true);
        assert.strictEqual(resultat.motif, MOTIFS.RIEN_A_LIBERER);
        assert.strictEqual(etatLiberation(order).peutLiberer, false);
    });

    it('§14 — dit à l’écran quand le blocage relève du Super Admin', () => {
        const bloqueParLitige = etatLiberation(commande({ litige: { enCours: true } }));
        assert.strictEqual(bloqueParLitige.releveDuSuperAdmin, true);

        const bloqueParStatut = etatLiberation(commande({ status: 'Confirmed' }));
        assert.strictEqual(bloqueParStatut.releveDuSuperAdmin, false);
    });
});

// ═════════════════════════════════════════════════════════════════════════
describe('RAMCI §9 — retraits : un flux unique, sans double validation par seuil', () => {

    const demandeValide = {
        montant: 180000,
        operateur: 'orange_money',
        numero: '0700000000',
        titulaire: 'Awa',
        cleIdempotence: 'cle-1',
    };

    it('§19 cas A — 180 000 FCFA passe par le flux normal, sans seuil', () => {
        // Le cas exact du guide : « Awa demande 180 000 FCFA […] Pas besoin
        // d'un deuxième Admin Finance uniquement à cause du montant. »
        const resultat = validerDemande(demandeValide);
        assert.strictEqual(resultat.ok, true);
        assert.strictEqual(resultat.valeurs.montant, 180000);
    });

    it('aucun seuil de montant ne subsiste dans le service', () => {
        // Un montant absurdement grand reste une demande valide : c'est le
        // solde disponible qui décide, pas un plafond arbitraire.
        assert.strictEqual(validerDemande({ ...demandeValide, montant: 99_000_000 }).ok, true);
    });

    it('refuse un montant sous le minimum', () => {
        const resultat = validerDemande({ ...demandeValide, montant: MONTANT_MINIMUM - 1 });
        assert.strictEqual(resultat.ok, false);
    });

    it('refuse un opérateur hors liste fermée', () => {
        assert.strictEqual(validerDemande({ ...demandeValide, operateur: 'western_union' }).ok, false);
    });

    it('refuse un numéro mal formé, accepte les espaces de saisie', () => {
        assert.strictEqual(validerDemande({ ...demandeValide, numero: '070000' }).ok, false);
        const avecEspaces = validerDemande({ ...demandeValide, numero: '07 00 00 00 00' });
        assert.strictEqual(avecEspaces.ok, true);
        assert.strictEqual(avecEspaces.valeurs.numero, '0700000000');
    });

    it('exige une clé d’idempotence — un double clic ne part pas deux fois', () => {
        assert.strictEqual(validerDemande({ ...demandeValide, cleIdempotence: '' }).ok, false);
    });

    describe('transitions', () => {
        it('le chemin normal : en attente → en cours → payé', () => {
            assert.strictEqual(transitionAutorisee('en_attente', 'en_cours'), true);
            assert.strictEqual(transitionAutorisee('en_cours', 'payee'), true);
        });

        it('un retrait payé ou rejeté est définitif', () => {
            assert.deepStrictEqual(TRANSITIONS_RETRAIT.payee, []);
            assert.deepStrictEqual(TRANSITIONS_RETRAIT.rejetee, []);
        });

        it('un dossier escaladé peut revenir au circuit normal', () => {
            assert.strictEqual(transitionAutorisee('escalade', 'en_attente'), true);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════
describe('RAMCI §10 — retour de bout en bout', () => {

    it('suit l’ordre du guide : demande → récupération → réception → inspection → résolution', () => {
        assert.strictEqual(transitionRetourAutorisee('return_requested', 'return_pickup'), true);
        assert.strictEqual(transitionRetourAutorisee('return_pickup', 'return_received'), true);
        assert.strictEqual(transitionRetourAutorisee('return_received', 'return_inspection'), true);
        assert.strictEqual(transitionRetourAutorisee('return_inspection', 'resolved'), true);
    });

    it('n’inspecte pas un colis qui n’est pas arrivé', () => {
        assert.strictEqual(transitionRetourAutorisee('return_requested', 'return_inspection'), false);
        assert.strictEqual(transitionRetourAutorisee('return_pickup', 'return_inspection'), false);
    });

    it('un retour résolu est définitif', () => {
        assert.deepStrictEqual(TRANSITIONS_RETOUR.resolved, []);
    });
});

// ═════════════════════════════════════════════════════════════════════════
describe('RAMCI §13 — exceptions : qui tranche, et quand', () => {

    const superAdmin = { _id: 'sa', role: 'super_admin', permissions: ['admin.all'] };
    const finance = { _id: 'fin', role: 'finance_admin', permissions: ['wallet.adjust', 'exceptions.request'] };
    const dossier = (surcharges = {}) => ({
        _id: 'exc',
        statut: 'en_attente',
        demandePar: 'fin',
        expireLe: new Date(Date.now() + 3600_000),
        ...surcharges,
    });

    it('§1 — seul un arbitre tranche', () => {
        assert.strictEqual(peutTrancher(superAdmin), true);
        assert.strictEqual(peutTrancher(finance), false);
    });

    it('§3 — Finance ne tranche pas une exception, même la sienne', () => {
        const resultat = verifierDecision(dossier(), finance);
        assert.strictEqual(resultat.ok, false);
        assert.strictEqual(resultat.code, 403);
    });

    it('le demandeur ne tranche pas sa propre demande, même Super Admin', () => {
        const resultat = verifierDecision(dossier({ demandePar: 'sa' }), superAdmin);
        assert.strictEqual(resultat.ok, false);
        assert.strictEqual(resultat.code, 403);
    });

    it('un dossier déjà tranché ne se retranche pas', () => {
        const resultat = verifierDecision(dossier({ statut: 'approuvee' }), superAdmin);
        assert.strictEqual(resultat.code, 409);
    });

    it('un dossier expiré doit être rouvert, pas tranché en retard', () => {
        const resultat = verifierDecision(dossier({ expireLe: new Date(Date.now() - 1000) }), superAdmin);
        assert.strictEqual(resultat.code, 409);
    });

    it('un dossier recevable passe', () => {
        assert.strictEqual(verifierDecision(dossier(), superAdmin).ok, true);
    });
});
