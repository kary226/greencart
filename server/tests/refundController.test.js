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
import ApprovalRequest from '../models/ApprovalRequest.js';
import Setting from '../models/Setting.js';

// Contrôleur testé
import { createRefund, rejectRefund, completeRefund, approveRefund } from '../controllers/refundController.js';

// Désactiver les logs (bruit attendu : erreurs et avertissements volontaires dans les tests)
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

describe('refundController - createRefund / rejectRefund / completeRefund', () => {
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
            ApprovalRequest.deleteMany({}),
            Setting.deleteMany({}),
        ]);

        client = await User.create({
            name: 'Client Test',
            email: `client-${Date.now()}-${Math.random()}@test.ci`,
            creditBalance: 0,
        });

        demandeur = await StaffUser.create({
            email: `demandeur-${Date.now()}-${Math.random()}@test.ci`,
            password: 'hash',
            nom: 'Demandeur',
            role: 'support_admin',
            statut: 'actif',
        });

        approbateur1 = await StaffUser.create({
            email: `approbateur1-${Date.now()}-${Math.random()}@test.ci`,
            password: 'hash',
            nom: 'Approbateur Un',
            role: 'finance_admin',
            statut: 'actif',
        });

        approbateur2 = await StaffUser.create({
            email: `approbateur2-${Date.now()}-${Math.random()}@test.ci`,
            password: 'hash',
            nom: 'Approbateur Deux',
            role: 'finance_admin',
            statut: 'actif',
        });

        order = await Order.create({
            userId: client._id.toString(),
            amount: 20000,
            paymentType: 'COD',
            isPaid: false,
            address: new mongoose.Types.ObjectId().toString(),
            items: [],
        });
    });

    // ─── createRefund ────────────────────────────────────────────────

    describe('createRefund', () => {
        it('crée et auto-approuve un remboursement sous le seuil, crédite immédiatement le RCOINS', async () => {
            const req = {
                body: { orderId: order._id.toString(), montant: 5000, motif: 'Article manquant' },
                staffUser: demandeur,
            };
            const res = mockRes();
            await createRefund(req, res);

            assert.strictEqual(res.statusCode, 201, `Attendu 201, reçu ${res.statusCode}: ${JSON.stringify(res.body)}`);
            assert.strictEqual(res.body.refund.statut, 'processing');

            const clientApres = await User.findById(client._id);
            assert.strictEqual(clientApres.creditBalance, 5000, 'Le client doit être crédité immédiatement (sous le seuil)');
        });

        it('refuse un montant supérieur au montant de la commande', async () => {
            const req = {
                body: { orderId: order._id.toString(), montant: 999999, motif: 'Test' },
                staffUser: demandeur,
            };
            const res = mockRes();
            await createRefund(req, res);

            assert.strictEqual(res.statusCode, 400);
            const clientApres = await User.findById(client._id);
            assert.strictEqual(clientApres.creditBalance, 0, 'Aucun crédit ne doit avoir eu lieu');
        });

        it('applique le garde-fou d\'exclusivité RCOINS / remboursement monétaire : refuse un 2e remboursement sur une commande déjà créditée', async () => {
            const req1 = {
                body: { orderId: order._id.toString(), montant: 3000, motif: 'Premier remboursement' },
                staffUser: demandeur,
            };
            await createRefund(req1, mockRes());

            // Deuxième demande de remboursement sur la MÊME commande, déjà créditée en RCOINS.
            const req2 = {
                body: { orderId: order._id.toString(), montant: 2000, motif: 'Deuxième tentative' },
                staffUser: demandeur,
            };
            const res2 = mockRes();
            await createRefund(req2, res2);

            assert.strictEqual(res2.statusCode, 409, `Le garde-fou doit bloquer un 2e remboursement (409), reçu ${res2.statusCode}`);

            const clientApres = await User.findById(client._id);
            assert.strictEqual(clientApres.creditBalance, 3000, 'Le solde ne doit refléter que le premier remboursement');
        });

        it('au-dessus du seuil : crée une ApprovalRequest, ne crédite PAS immédiatement', async () => {
            await Setting.create({ key: 'finance.approval.wallet_adjust_threshold', value: 10000 });

            const req = {
                body: { orderId: order._id.toString(), montant: 15000, motif: 'Gros remboursement' },
                staffUser: demandeur,
            };
            const res = mockRes();
            await createRefund(req, res);

            assert.strictEqual(res.statusCode, 202, `Attendu 202 (en attente d'approbation), reçu ${res.statusCode}: ${JSON.stringify(res.body)}`);
            assert.strictEqual(res.body.refund.statut, 'requested', 'Ne doit pas être auto-approuvé au-dessus du seuil');

            const clientApres = await User.findById(client._id);
            assert.strictEqual(clientApres.creditBalance, 0, 'Aucun crédit avant approbation explicite');

            const approvals = await ApprovalRequest.find({});
            assert.strictEqual(approvals.length, 1, 'Une ApprovalRequest doit avoir été créée');

            // Vérifie que le circuit d'approbation classique fonctionne ensuite
            const refundId = res.body.refund._id;
            const reqApprove = { params: { id: refundId.toString() }, body: {}, staffUser: approbateur1 };
            const resApprove = mockRes();
            await approveRefund(reqApprove, resApprove);
            assert.strictEqual(resApprove.statusCode, 200);

            const clientFinal = await User.findById(client._id);
            assert.strictEqual(clientFinal.creditBalance, 15000, 'Crédité seulement après approbation explicite');
        });
    });

    // ─── rejectRefund ────────────────────────────────────────────────

    describe('rejectRefund', () => {
        const creerRefundEnAttente = async (montant = 4000) => Refund.create({
            orderId: order._id,
            montantApprouve: montant,
            methode: 'rcoins',
            statut: 'requested',
            refundId: `RF-REJ-${Date.now()}-${Math.random()}`,
            demandePar: demandeur._id,
            motif: 'Test rejet',
        });

        it('rejette une demande "requested" et ne crédite jamais le client', async () => {
            const refund = await creerRefundEnAttente();
            const req = { params: { id: refund._id.toString() }, body: { motif: 'Non justifié' }, staffUser: approbateur1 };
            const res = mockRes();
            await rejectRefund(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.refund.statut, 'rejected');

            const clientApres = await User.findById(client._id);
            assert.strictEqual(clientApres.creditBalance, 0);
        });

        it('empêche le demandeur de rejeter sa propre demande', async () => {
            const refund = await creerRefundEnAttente();
            const req = { params: { id: refund._id.toString() }, body: {}, staffUser: demandeur };
            const res = mockRes();
            await rejectRefund(req, res);
            assert.strictEqual(res.statusCode, 403);
        });

        it('refuse de rejeter un remboursement déjà traité', async () => {
            const refund = await creerRefundEnAttente();
            await rejectRefund({ params: { id: refund._id.toString() }, body: {}, staffUser: approbateur1 }, mockRes());

            const res2 = mockRes();
            await rejectRefund({ params: { id: refund._id.toString() }, body: {}, staffUser: approbateur2 }, res2);
            assert.strictEqual(res2.statusCode, 409);
        });

        it('race condition : approve et reject concurrents sur le même remboursement — un seul doit gagner, jamais les deux', async () => {
            const refund = await creerRefundEnAttente(6000);

            const reqApprove = { params: { id: refund._id.toString() }, body: {}, staffUser: approbateur1 };
            const reqReject = { params: { id: refund._id.toString() }, body: { motif: 'Suspect' }, staffUser: approbateur2 };
            const resApprove = mockRes();
            const resReject = mockRes();

            await Promise.all([
                approveRefund(reqApprove, resApprove),
                rejectRefund(reqReject, resReject),
            ]);

            // Exactement un des deux doit avoir réussi (200), l'autre doit avoir été
            // rejeté par le verrou atomique (409). Les deux à 200 = incohérence grave
            // (refund à la fois crédité et rejeté). Les deux à 409 = bug différent
            // (l'action n'a jamais eu lieu).
            const codes = [resApprove.statusCode, resReject.statusCode].sort();
            assert.deepStrictEqual(codes, [200, 409], `Exactement un des deux doit gagner. Reçu: approve=${resApprove.statusCode}, reject=${resReject.statusCode}`);

            const refundFinal = await Refund.findById(refund._id);
            const clientApres = await User.findById(client._id);

            if (resApprove.statusCode === 200) {
                assert.strictEqual(refundFinal.statut, 'processing');
                assert.strictEqual(clientApres.creditBalance, 6000);
            } else {
                assert.strictEqual(refundFinal.statut, 'rejected');
                assert.strictEqual(clientApres.creditBalance, 0);
            }
        });
    });

    // ─── completeRefund ──────────────────────────────────────────────

    describe('completeRefund', () => {
        it('marque comme terminé un remboursement "processing"', async () => {
            const refund = await Refund.create({
                orderId: order._id,
                montantApprouve: 2000,
                methode: 'rcoins',
                statut: 'processing',
                refundId: `RF-COMP-${Date.now()}`,
                demandePar: demandeur._id,
                motif: 'Test',
            });
            const req = { params: { id: refund._id.toString() }, body: { providerReference: 'REF-123' }, staffUser: approbateur1 };
            const res = mockRes();
            await completeRefund(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.refund.statut, 'completed');
            assert.strictEqual(res.body.refund.providerReference, 'REF-123');
        });

        it('refuse de terminer un remboursement déjà "completed"', async () => {
            const refund = await Refund.create({
                orderId: order._id,
                montantApprouve: 2000,
                methode: 'rcoins',
                statut: 'completed',
                refundId: `RF-COMP2-${Date.now()}`,
                demandePar: demandeur._id,
                motif: 'Test',
                completeLe: new Date(),
            });
            const req = { params: { id: refund._id.toString() }, body: {}, staffUser: approbateur1 };
            const res = mockRes();
            await completeRefund(req, res);
            assert.strictEqual(res.statusCode, 409);
        });

        it('refuse de terminer un remboursement encore "requested"', async () => {
            const refund = await Refund.create({
                orderId: order._id,
                montantApprouve: 2000,
                methode: 'rcoins',
                statut: 'requested',
                refundId: `RF-COMP3-${Date.now()}`,
                demandePar: demandeur._id,
                motif: 'Test',
            });
            const req = { params: { id: refund._id.toString() }, body: {}, staffUser: approbateur1 };
            const res = mockRes();
            await completeRefund(req, res);
            assert.strictEqual(res.statusCode, 409);
        });

        it('deux complétions concurrentes sur le même remboursement : une seule doit réussir', async () => {
            const refund = await Refund.create({
                orderId: order._id,
                montantApprouve: 2000,
                methode: 'rcoins',
                statut: 'approved',
                refundId: `RF-COMP4-${Date.now()}`,
                demandePar: demandeur._id,
                motif: 'Test',
            });
            const req1 = { params: { id: refund._id.toString() }, body: { providerReference: 'A' }, staffUser: approbateur1 };
            const req2 = { params: { id: refund._id.toString() }, body: { providerReference: 'B' }, staffUser: approbateur2 };
            const res1 = mockRes();
            const res2 = mockRes();

            await Promise.all([
                completeRefund(req1, res1),
                completeRefund(req2, res2),
            ]);

            const codes = [res1.statusCode, res2.statusCode].sort();
            assert.deepStrictEqual(codes, [200, 409], `Exactement un des deux doit réussir. Reçu: ${res1.statusCode} / ${res2.statusCode}`);
        });
    });
});