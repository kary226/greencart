import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Modèles
import Refund from '../models/Refund.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import StaffUser from '../models/StaffUser.js';
import CustomerCreditTransaction from '../models/CustomerCreditTransaction.js';

// Contrôleur testé
import { approveRefund, createRefund } from '../controllers/refundController.js';

// Désactiver les logs (bruit attendu : erreurs 409 volontaires dans les tests)
console.error = () => {};
console.log = () => {};

// ─── Petits mocks Express minimalistes ─────────────────────────────────
const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    return res;
};

describe('refundController - Idempotence du crédit RCOINS', () => {
    let mongoServer;
    let client, demandeur, approbateur1, approbateur2, order;

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
            Refund.deleteMany({}),
            Order.deleteMany({}),
            User.deleteMany({}),
            StaffUser.deleteMany({}),
            CustomerCreditTransaction.deleteMany({}),
        ]);

        client = await User.create({
            name: 'Client Test',
            email: `client-${Date.now()}@test.ci`,
            creditBalance: 0,
        });

        demandeur = await StaffUser.create({
            email: `demandeur-${Date.now()}@test.ci`,
            password: 'hash',
            nom: 'Demandeur',
            role: 'support_admin',
            statut: 'actif',
        });

        approbateur1 = await StaffUser.create({
            email: `approbateur1-${Date.now()}@test.ci`,
            password: 'hash',
            nom: 'Approbateur Un',
            role: 'finance_admin',
            statut: 'actif',
        });

        approbateur2 = await StaffUser.create({
            email: `approbateur2-${Date.now()}@test.ci`,
            password: 'hash',
            nom: 'Approbateur Deux',
            role: 'finance_admin',
            statut: 'actif',
        });

        order = await Order.create({
            userId: client._id.toString(),
            amount: 10000,
            paymentType: 'COD',
            isPaid: false,
            address: new mongoose.Types.ObjectId().toString(),
            items: [],
        });
    });

    it('reproduit le double-crédit : deux approbations concurrentes sur le même remboursement créditent deux fois', async () => {
        const refund = await Refund.create({
            orderId: order._id,
            montantApprouve: 5000,
            methode: 'rcoins',
            statut: 'requested',
            refundId: `RF-${Date.now()}`,
            demandePar: demandeur._id,
            motif: 'Article manquant',
        });

        // Deux admins différents cliquent "Approuver" quasi simultanément
        // (ou : un seul admin, mais un retry réseau double la requête).
        const req1 = {
            params: { id: refund._id.toString() },
            body: {},
            staffUser: approbateur1,
        };
        const req2 = {
            params: { id: refund._id.toString() },
            body: {},
            staffUser: approbateur2,
        };
        const res1 = mockRes();
        const res2 = mockRes();

        await Promise.all([
            approveRefund(req1, res1),
            approveRefund(req2, res2),
        ]);

        const clientApres = await User.findById(client._id);
        const transactions = await CustomerCreditTransaction.find({ orderId: order._id });

        console.warn(
            `[diagnostic] statuts HTTP: ${res1.statusCode} / ${res2.statusCode} — ` +
            `solde client: ${clientApres.creditBalance} FCFA (attendu: 5000) — ` +
            `transactions de crédit créées: ${transactions.length} (attendu: 1)`
        );

        // Ce test est volontairement écrit pour révéler le bug : sur le code
        // actuel (itemId aléatoire + lecture/écriture non atomique du statut),
        // ces deux assertions échouent — le client est crédité deux fois
        // (10000 FCFA au lieu de 5000, 2 transactions au lieu d'1).
        assert.strictEqual(
            clientApres.creditBalance,
            5000,
            `BUG CONFIRMÉ : le client a été crédité ${clientApres.creditBalance} FCFA au lieu de 5000 — double-crédit.`
        );
        assert.strictEqual(
            transactions.length,
            1,
            `BUG CONFIRMÉ : ${transactions.length} transactions de crédit créées pour un seul remboursement au lieu d'1.`
        );
    });

    it('un retry séquentiel (approve appelé deux fois de suite sur le même refund déjà "processing") ne doit pas re-créditer', async () => {
        const refund = await Refund.create({
            orderId: order._id,
            montantApprouve: 3000,
            methode: 'rcoins',
            statut: 'requested',
            refundId: `RF-SEQ-${Date.now()}`,
            demandePar: demandeur._id,
            motif: 'Retard de livraison',
        });

        const req = {
            params: { id: refund._id.toString() },
            body: {},
            staffUser: approbateur1,
        };

        // Premier appel : passe, crédite normalement.
        await approveRefund(req, mockRes());

        // Deuxième appel : le refund est maintenant "processing", donc le
        // garde-fou `statut !== 'requested'` DEVRAIT bloquer — c'est le cas
        // même sur le code actuel, car ce chemin est séquentiel (pas de
        // race condition ici). Ce test sert de témoin : il doit rester vert
        // avant et après le correctif.
        const res2 = mockRes();
        await approveRefund(req, res2);

        assert.strictEqual(res2.statusCode, 409, 'Le deuxième appel séquentiel doit être rejeté (409)');

        const clientApres = await User.findById(client._id);
        assert.strictEqual(clientApres.creditBalance, 3000, 'Le solde ne doit refléter qu\'un seul crédit');
    });
});