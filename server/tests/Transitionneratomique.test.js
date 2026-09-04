import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import Order from '../models/Order.js';
import JournalAction from '../models/JournalAction.js';
import { transitionnerAtomique } from '../services/orderWorkflowService.js';

/**
 * TESTS — transitionnerAtomique()
 * ================================================================
 * ramciWorkflow.test.js couvre déjà transitionner() (la variante en
 * mémoire). Celui-ci couvre spécifiquement ce que transitionner() ne
 * peut PAS garantir : le comportement sous concurrence réelle, puisque
 * transitionnerAtomique() existe justement pour les 5 endroits où une
 * requête concurrente (webhook dupliqué, double clic, deux livreurs)
 * est un scénario réaliste et pas une hypothèse d'école.
 *
 * On utilise une vraie base (MongoMemoryServer), pas un modèle simulé :
 * la garantie qu'on teste ici est celle de findOneAndUpdate lui-même
 * (atomicité), qu'un mock ne peut pas honnêtement reproduire.
 */

const originalConsoleError = console.error;

const creerCommande = (surcharges = {}) => Order.create({
    userId: 'user1',
    amount: 5000,
    address: 'addr1',
    paymentType: 'jeko',
    isPaid: false,
    status: 'pending_payment',
    items: [],
    ...surcharges,
});

describe('orderWorkflowService — transitionnerAtomique()', () => {
    let mongoServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
        console.error = () => {}; // journaliser loggue ses propres échecs, pas utile ici
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
        console.error = originalConsoleError;
    });

    beforeEach(async () => {
        await Order.deleteMany({});
        await JournalAction.deleteMany({});
    });

    it('applique la transition quand le statut de départ est légal et qu’il n’y a pas de conflit', async () => {
        const commande = await creerCommande({ status: 'pending_payment' });

        const resultat = await transitionnerAtomique({
            Order,
            orderId: commande._id,
            vers: 'Cancelled',
            depuis: 'pending_payment',
            filtreConcurrence: { isPaid: { $ne: true } },
            verifierDroits: false,
        });

        assert.strictEqual(resultat.ok, true);
        assert.strictEqual(resultat.depuis, 'pending_payment');

        const relue = await Order.findById(commande._id);
        assert.strictEqual(relue.status, 'Cancelled');
    });

    it('refuse et NE MODIFIE RIEN si la condition de concurrence a basculé entre-temps (isPaid déjà vrai)', async () => {
        // Simule : le webhook Jèko a confirmé le paiement une milliseconde
        // avant que cancelOrder() n'arrive — exactement le scénario que le
        // commentaire d'origine de cancelOrder() décrivait.
        const commande = await creerCommande({ status: 'pending_payment', isPaid: true });

        const resultat = await transitionnerAtomique({
            Order,
            orderId: commande._id,
            vers: 'Cancelled',
            depuis: 'pending_payment',
            filtreConcurrence: { isPaid: { $ne: true } },
            verifierDroits: false,
        });

        assert.strictEqual(resultat.ok, false);
        assert.strictEqual(resultat.code, 409);

        const relue = await Order.findById(commande._id);
        assert.strictEqual(relue.status, 'pending_payment', 'le statut ne doit pas bouger si la condition de concurrence échoue');
    });

    it('refuse deux réservations de collecte simultanées sur la même commande — une seule doit gagner', async () => {
        // Le vrai scénario de reserverCollecte()/reserverCollecteLivreur() :
        // deux livreurs cliquent "réserver" sur la même commande.
        const commande = await creerCommande({ status: 'Confirmed', collecteLivreurId: null });

        const tentative = (livreurId) => transitionnerAtomique({
            Order,
            orderId: commande._id,
            vers: 'Collecting',
            depuis: 'Confirmed',
            filtreConcurrence: { collecteLivreurId: null },
            champsSupplementaires: { collecteLivreurId: livreurId },
            verifierDroits: false,
        });

        // collecteLivreurId est un ObjectId dans le schéma Order — 'livreurA'
        // n'est pas une valeur castable, il faut de vrais ObjectId.
        const livreurA = new mongoose.Types.ObjectId();
        const livreurB = new mongoose.Types.ObjectId();

        const [resultatA, resultatB] = await Promise.all([tentative(livreurA), tentative(livreurB)]);
        const succes = [resultatA, resultatB].filter((r) => r.ok);
        const echecs = [resultatA, resultatB].filter((r) => !r.ok);

        assert.strictEqual(succes.length, 1, 'une seule des deux réservations concurrentes doit réussir');
        assert.strictEqual(echecs.length, 1);
        assert.strictEqual(echecs[0].code, 409);

        const relue = await Order.findById(commande._id);
        const gagnant = [livreurA, livreurB].find((id) => id.equals(relue.collecteLivreurId));
        assert.ok(gagnant, 'la commande doit porter le livreurId de la tentative qui a réellement gagné');
    });

    it('refuse une transition absente de la table TRANSITIONS, même si le filtre Mongo matcherait', async () => {
        const commande = await creerCommande({ status: 'Delivered' });

        const resultat = await transitionnerAtomique({
            Order,
            orderId: commande._id,
            vers: 'Cancelled', // Delivered -> Cancelled n'existe pas dans TRANSITIONS
            depuis: 'Delivered',
            verifierDroits: false,
        });

        assert.strictEqual(resultat.ok, false);
        assert.strictEqual(resultat.code, 409);

        const relue = await Order.findById(commande._id);
        assert.strictEqual(relue.status, 'Delivered');
    });

    it('refuse avec 403 si l’acteur n’a pas la permission requise — sans toucher la commande', async () => {
        const commande = await creerCommande({ status: 'Confirmed', collecteLivreurId: null });
        const acteurSansDroits = { _id: 'staff1', nom: 'Livreur Sans Droits', role: 'livreur', permissions: [] };

        const resultat = await transitionnerAtomique({
            Order,
            orderId: commande._id,
            vers: 'Collecting',
            depuis: 'Confirmed',
            filtreConcurrence: { collecteLivreurId: null },
            acteur: acteurSansDroits,
            verifierDroits: true,
        });

        assert.strictEqual(resultat.ok, false);
        assert.strictEqual(resultat.code, 403);

        const relue = await Order.findById(commande._id);
        assert.strictEqual(relue.status, 'Confirmed', 'la commande ne doit pas bouger si les droits manquent');
    });

    it('un litige en cours gèle une transition normale, mais pas une annulation', async () => {
        const enLitige = await creerCommande({ status: 'Shipped', litige: { enCours: true } });

        const geleTentative = await transitionnerAtomique({
            Order, orderId: enLitige._id, vers: 'Out for Delivery', depuis: 'Shipped', verifierDroits: false,
        });
        assert.strictEqual(geleTentative.ok, false);

        const annulationTentative = await transitionnerAtomique({
            Order, orderId: enLitige._id, vers: 'Cancelled', depuis: 'Shipped', verifierDroits: false,
        });
        assert.strictEqual(annulationTentative.ok, true, 'Cancelled doit rester possible malgré le litige (voir TRANSITIONS)');
    });

    it('journalise systématiquement — y compris pour une transition système sans acteur humain', async () => {
        const commande = await creerCommande({ status: 'pending_payment' });

        await transitionnerAtomique({
            Order,
            orderId: commande._id,
            vers: 'Checking Availability',
            depuis: 'pending_payment',
            filtreConcurrence: { isPaid: { $ne: true } },
            champsSupplementaires: { isPaid: true },
            acteur: null,
            verifierDroits: false,
            note: 'paiement confirmé par Jèko (webhook)',
        });

        // journaliser() est volontairement "fire and forget" (voir
        // journalService.js : la trace ne doit jamais retarder ni faire
        // échouer l'action métier) — transitionnerAtomique() ne l'attend
        // donc pas. On laisse ici un court instant pour que l'écriture,
        // déclenchée juste avant, ait le temps d'atteindre la base avant
        // de vérifier qu'elle y est bien.
        await new Promise((resolve) => setTimeout(resolve, 100));

        const entrees = await JournalAction.find({ cibleId: commande._id.toString() });
        assert.strictEqual(entrees.length, 1);
        assert.strictEqual(entrees[0].acteurNom, 'système');
        assert.match(entrees[0].note, /pending_payment.*Checking Availability/);
    });
});