import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Modèles
import Order from '../models/Order.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import ReconciliationLog from '../models/ReconciliationLog.js';
import StaffUser from '../models/StaffUser.js';
import JournalAction from '../models/JournalAction.js';

// Contrôleur / service testés
import {
    runReconciliation,
    listEcards,
    resolveEcart,
    getReconciliationStatsController,
} from '../controllers/reconciliationController.js';
import { resoudreEcart } from '../services/reconciliationService.js';

// Bruit attendu dans les tests (logs volontaires du service)
console.error = () => {};
console.log = () => {};

// ─── Petits mocks Express minimalistes (même patron que refundController.test.js) ───
const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    return res;
};

// Crée une commande payée par Jèko + (éventuellement) sa transaction wallet
// correspondante, pour simuler un scénario de rapprochement.
const creerCommandeJeko = async ({ amount, jekoRef, walletId, walletMontant }) => {
    const order = await Order.create({
        userId: new mongoose.Types.ObjectId().toString(),
        amount,
        paymentType: 'Jeko',
        isPaid: true,
        jeko_reference: jekoRef,
        address: new mongoose.Types.ObjectId().toString(),
        items: [],
    });

    if (walletId && walletMontant !== undefined) {
        await WalletTransaction.create({
            walletId,
            type: 'vente',
            compte: 'en_attente',
            montant: walletMontant,
            orderId: order._id,
            description: `Vente commande ${order._id}`,
        });
    }

    return order;
};

describe('reconciliationController / reconciliationService — Rapprochement Jèko', () => {
    let mongoServer;
    let staff, wallet;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await Promise.all([
            Order.deleteMany({}),
            Wallet.deleteMany({}),
            WalletTransaction.deleteMany({}),
            ReconciliationLog.deleteMany({}),
            StaffUser.deleteMany({}),
            JournalAction.deleteMany({}),
        ]);

        staff = await StaffUser.create({
            email: `staff-${Date.now()}-${Math.random()}@test.ci`,
            password: 'hash',
            nom: 'Agent Finance',
            role: 'finance_admin',
            statut: 'actif',
        });

        wallet = await Wallet.create({ ownerId: staff._id, solde: 0, soldeEnAttente: 0 });
    });

    // ─── reconcilierJeko / runReconciliation ────────────────────────────

    describe('runReconciliation', () => {
        it('ne signale aucun écart quand le montant Jèko et le montant wallet correspondent', async () => {
            await creerCommandeJeko({
                amount: 10000, jekoRef: 'JEKO-1', walletId: wallet._id, walletMontant: 10000,
            });

            const req = { body: {} };
            const res = mockRes();
            await runReconciliation(req, res);

            assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
            assert.strictEqual(res.body.summary.orders, 1);
            assert.strictEqual(res.body.summary.ecarts, 0);
            assert.strictEqual(res.body.summary.ok, 1);

            const log = await ReconciliationLog.findOne({ jekoReference: 'JEKO-1' });
            assert.strictEqual(log.typeEcart, 'aucun');
            assert.strictEqual(log.resolu, false, 'sans autoResoudre, le log reste non résolu même sans écart');
        });

        it('détecte un écart quand le montant wallet ne correspond pas au montant Jèko', async () => {
            await creerCommandeJeko({
                amount: 10000, jekoRef: 'JEKO-2', walletId: wallet._id, walletMontant: 8000,
            });

            const res = mockRes();
            await runReconciliation({ body: {} }, res);

            assert.strictEqual(res.body.summary.ecarts, 1);
            const log = await ReconciliationLog.findOne({ jekoReference: 'JEKO-2' });
            assert.strictEqual(log.typeEcart, 'montant');
            assert.strictEqual(log.montantEcart, 2000);
            assert.strictEqual(log.resolu, false);
        });

        it('détecte un écart quand une commande Jèko payée n\'a aucune transaction wallet', async () => {
            await creerCommandeJeko({ amount: 15000, jekoRef: 'JEKO-3' }); // pas de wallet correspondant

            const res = mockRes();
            await runReconciliation({ body: {} }, res);

            assert.strictEqual(res.body.summary.ecarts, 1);
            const log = await ReconciliationLog.findOne({ jekoReference: 'JEKO-3' });
            assert.strictEqual(log.internalAmount, 0);
            assert.strictEqual(log.montantEcart, 15000);
        });

        it('avec autoResoudre=true, résout automatiquement les lignes sans écart mais laisse les écarts ouverts', async () => {
            await creerCommandeJeko({ amount: 5000, jekoRef: 'JEKO-OK', walletId: wallet._id, walletMontant: 5000 });
            await creerCommandeJeko({ amount: 7000, jekoRef: 'JEKO-KO', walletId: wallet._id, walletMontant: 1000 });

            const res = mockRes();
            await runReconciliation({ body: { autoResoudre: true } }, res);

            const logOk = await ReconciliationLog.findOne({ jekoReference: 'JEKO-OK' });
            const logKo = await ReconciliationLog.findOne({ jekoReference: 'JEKO-KO' });
            assert.strictEqual(logOk.resolu, true, 'une ligne sans écart doit être auto-résolue');
            assert.strictEqual(logKo.resolu, false, 'une ligne EN écart ne doit jamais être auto-résolue, même avec autoResoudre=true');
        });

        it('signale les transactions wallet orphelines (sans commande Jèko payée correspondante)', async () => {
            // Transaction wallet sur une commande qui n'est PAS payée par Jèko
            const order = await Order.create({
                userId: new mongoose.Types.ObjectId().toString(),
                amount: 3000,
                paymentType: 'COD',
                isPaid: false,
                address: new mongoose.Types.ObjectId().toString(),
                items: [],
            });
            await WalletTransaction.create({
                walletId: wallet._id,
                type: 'vente',
                compte: 'en_attente',
                montant: 3000,
                orderId: order._id,
                description: 'Vente orpheline',
            });

            const res = mockRes();
            await runReconciliation({ body: {} }, res);

            assert.strictEqual(res.body.summary.walletWithoutOrder, 1);
        });

        it('un deuxième run met à jour le log existant au lieu d\'en créer un doublon', async () => {
            await creerCommandeJeko({ amount: 10000, jekoRef: 'JEKO-DOUBLON', walletId: wallet._id, walletMontant: 8000 });

            await runReconciliation({ body: {} }, mockRes());
            await runReconciliation({ body: {} }, mockRes());

            const logs = await ReconciliationLog.find({ jekoReference: 'JEKO-DOUBLON' });
            assert.strictEqual(logs.length, 1, 'un deuxième run sur le même écart non résolu ne doit pas dupliquer le log');
        });

        it('journalise le run (JournalAction)', async () => {
            await creerCommandeJeko({ amount: 10000, jekoRef: 'JEKO-JOURNAL', walletId: wallet._id, walletMontant: 10000 });
            await runReconciliation({ body: {} }, mockRes());

            const entry = await JournalAction.findOne({ action: 'reconciliation.run' });
            assert.ok(entry, 'le run doit être journalisé');
        });
    });

    // ─── listEcards / getReconciliationEcards ───────────────────────────

    describe('listEcards', () => {
        it('ne retourne que les écarts non résolus', async () => {
            await creerCommandeJeko({ amount: 10000, jekoRef: 'JEKO-A', walletId: wallet._id, walletMontant: 6000 });
            await creerCommandeJeko({ amount: 5000, jekoRef: 'JEKO-B', walletId: wallet._id, walletMontant: 5000 });
            await runReconciliation({ body: { autoResoudre: true } }, mockRes());

            const res = mockRes();
            await listEcards({}, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.ecarts.length, 1);
            assert.strictEqual(res.body.ecarts[0].jekoReference, 'JEKO-A');
        });
    });

    // ─── resolveEcart / resoudreEcart ────────────────────────────────────

    describe('resolveEcart', () => {
        it('résout un écart et enregistre qui l\'a résolu', async () => {
            await creerCommandeJeko({ amount: 10000, jekoRef: 'JEKO-RESOLVE', walletId: wallet._id, walletMontant: 4000 });
            await runReconciliation({ body: {} }, mockRes());
            const log = await ReconciliationLog.findOne({ jekoReference: 'JEKO-RESOLVE' });

            const req = { params: { id: log._id.toString() }, body: { note: 'Vérifié manuellement, OK' }, staffUser: staff };
            const res = mockRes();
            await resolveEcart(req, res);

            assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
            const logApres = await ReconciliationLog.findById(log._id);
            assert.strictEqual(logApres.resolu, true);
            assert.strictEqual(logApres.resoluPar.toString(), staff._id.toString());
            assert.strictEqual(logApres.noteResolution, 'Vérifié manuellement, OK');
        });

        it('refuse de résoudre un écart déjà résolu', async () => {
            await creerCommandeJeko({ amount: 10000, jekoRef: 'JEKO-DEJA', walletId: wallet._id, walletMontant: 4000 });
            await runReconciliation({ body: {} }, mockRes());
            const log = await ReconciliationLog.findOne({ jekoReference: 'JEKO-DEJA' });

            await resolveEcart({ params: { id: log._id.toString() }, body: {}, staffUser: staff }, mockRes());

            const res2 = mockRes();
            await resolveEcart({ params: { id: log._id.toString() }, body: {}, staffUser: staff }, res2);
            assert.strictEqual(res2.statusCode, 500, 'la 2e résolution doit échouer proprement');
            assert.match(res2.body.message, /déjà résolu/i);
        });

        it('renvoie une erreur pour un log introuvable', async () => {
            const res = mockRes();
            await resolveEcart({ params: { id: new mongoose.Types.ObjectId().toString() }, body: {}, staffUser: staff }, res);
            assert.strictEqual(res.statusCode, 500);
            assert.match(res.body.message, /introuvable/i);
        });

        // ─── Non-régression : même correctif que 2.1 (refunds), porté ici ──
        //
        // resoudreEcart() suivait le même patron que l'ancien
        // approveRefund() avant correctif : findById() puis mutation puis
        // save(), sans verrou atomique. Confirmé en exécution réelle :
        // deux résolutions concurrentes réussissaient toutes les deux
        // (200/200) et produisaient deux entrées de journal (JournalAction)
        // pour un seul événement. Corrigé par un findOneAndUpdate
        // atomique ({_id, resolu:false}, ...), même patron que
        // refundController.approveRefund().
        it('deux résolutions concurrentes sur le même écart : une seule réussit, une seule entrée de journal créée', async () => {
            await creerCommandeJeko({ amount: 10000, jekoRef: 'JEKO-RACE', walletId: wallet._id, walletMontant: 4000 });
            await runReconciliation({ body: {} }, mockRes());
            const log = await ReconciliationLog.findOne({ jekoReference: 'JEKO-RACE' });

            const req = { params: { id: log._id.toString() }, body: { note: 'concurrent' }, staffUser: staff };
            const [res1, res2] = [mockRes(), mockRes()];

            await Promise.all([
                resolveEcart(req, res1),
                resolveEcart(req, res2),
            ]);

            const statuts = [res1.statusCode, res2.statusCode].sort();
            const journalEntries = await JournalAction.countDocuments({ action: 'reconciliation.resolve', cibleId: log._id });

            console.log(
                `[diagnostic reconciliation] statuts: ${statuts.join(' / ')} — entrées de journal créées: ${journalEntries} (attendu: 1)`
            );

            assert.strictEqual(journalEntries, 1, `une seule entrée de journal doit être créée — statuts obtenus: ${statuts.join(' / ')}`);
            const nbSucces = statuts.filter((s) => s === 200).length;
            assert.strictEqual(nbSucces, 1, `une seule des deux résolutions concurrentes doit réussir (200) — statuts obtenus: ${statuts.join(' / ')}`);
        });
    });

    // ─── getReconciliationStatsController ────────────────────────────────

    describe('getReconciliationStatsController', () => {
        it('calcule correctement total / écarts / résolus / taux de résolution', async () => {
            await creerCommandeJeko({ amount: 5000, jekoRef: 'JEKO-S1', walletId: wallet._id, walletMontant: 5000 });
            await creerCommandeJeko({ amount: 5000, jekoRef: 'JEKO-S2', walletId: wallet._id, walletMontant: 1000 });
            await runReconciliation({ body: { autoResoudre: true } }, mockRes());

            const res = mockRes();
            await getReconciliationStatsController({}, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.stats.total, 2);
            assert.strictEqual(res.body.stats.ecarts, 1);
            assert.strictEqual(res.body.stats.resolvus, 1);
            assert.strictEqual(res.body.stats.tauxResolution, 50);
        });
    });
});