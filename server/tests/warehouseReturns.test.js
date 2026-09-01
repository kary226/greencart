import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

// Modèles
import Order from '../models/Order.js';
import StaffUser from '../models/StaffUser.js';
import WarehouseScan from '../models/WarehouseScan.js';
import ReturnCase from '../models/ReturnCase.js';
import Refund from '../models/Refund.js';
import JournalAction from '../models/JournalAction.js';

// Contrôleurs testés
import {
    createWarehouseScan,
    getWarehouseScans,
    listWarehouseScans,
} from '../controllers/warehouseController.js';
import {
    listReturns,
    getReturnById,
    inspectReturn,
    resolveReturn,
    rejectReturn,
} from '../controllers/returnController.js';

// Désactiver les logs (bruit attendu : erreurs et avertissements volontaires dans les tests)
console.error = () => {};
console.log = () => {};

// ─── Mock Cloudinary ─────────────────────────────────────────────────────
// cloudinary.uploader est un objet mutable partagé (même instance importée
// ici et dans warehouseController.js) : on peut le patcher directement sans
// loader ni flag expérimental. Restauré après chaque test qui l'utilise
// pour ne pas polluer les autres.
const originalUploadStream = cloudinary.uploader.upload_stream;
const mockCloudinarySuccess = () => {
    cloudinary.uploader.upload_stream = (options, callback) => ({
        end: () => callback(null, { secure_url: 'https://mock.cloudinary.test/photo.jpg' }),
    });
};
const restoreCloudinary = () => {
    cloudinary.uploader.upload_stream = originalUploadStream;
};

// ─── Petits mocks Express minimalistes (même patron que refundController.test.js) ───
const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    return res;
};

const mockReq = ({ body = {}, params = {}, query = {}, files = [], staffUser } = {}) => ({
    body, params, query, files, staffUser,
});

describe('warehouseController / returnController — Entrepôt & Retours', () => {
    let mongoServer;
    let staff, order;

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
            StaffUser.deleteMany({}),
            WarehouseScan.deleteMany({}),
            ReturnCase.deleteMany({}),
            Refund.deleteMany({}),
            JournalAction.deleteMany({}),
        ]);

        staff = await StaffUser.create({
            email: `staff-${Date.now()}-${Math.random()}@test.ci`,
            password: 'hash',
            nom: 'Agent Entrepôt',
            role: 'warehouse_admin',
            statut: 'actif',
        });

        // items: [] volontairement — traiterRetourColis() (walletService) est
        // déjà couvert par walletService.test.js ; ici on ne teste que
        // l'intégration côté returnController, donc une commande sans article
        // fait no-op côté wallet (voir traiterRetourColis: return anticipé si
        // order.items est vide) sans qu'il faille reconstituer toute la
        // chaîne boutique/produit/wallet.
        order = await Order.create({
            userId: new mongoose.Types.ObjectId().toString(),
            amount: 15000,
            paymentType: 'Jeko',
            isPaid: true,
            address: new mongoose.Types.ObjectId().toString(),
            items: [],
        });
    });

    // ─── createWarehouseScan ─────────────────────────────────────────────

    describe('createWarehouseScan', () => {
        it('refuse si orderId est manquant', async () => {
            const req = mockReq({ body: { type: 'reception' }, staffUser: staff });
            const res = mockRes();
            await createWarehouseScan(req, res);
            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.success, false);
        });

        it('refuse si type est manquant', async () => {
            const req = mockReq({ body: { orderId: order._id.toString() }, staffUser: staff });
            const res = mockRes();
            await createWarehouseScan(req, res);
            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.success, false);
        });

        it("refuse un scan retour_reception sans photo (règle métier du 23 août)", async () => {
            const req = mockReq({
                body: { orderId: order._id.toString(), type: 'retour_reception' },
                files: [],
                staffUser: staff,
            });
            const res = mockRes();
            await createWarehouseScan(req, res);
            assert.strictEqual(res.statusCode, 400);
            assert.match(res.body.message, /photo/i);

            const count = await WarehouseScan.countDocuments();
            assert.strictEqual(count, 0, "aucun scan ne doit être créé quand la photo obligatoire manque");
        });

        it('refuse si la commande est introuvable', async () => {
            const req = mockReq({
                body: { orderId: new mongoose.Types.ObjectId().toString(), type: 'reception' },
                staffUser: staff,
            });
            const res = mockRes();
            await createWarehouseScan(req, res);
            assert.strictEqual(res.statusCode, 404);
        });

        it('crée un scan simple (reception) sans photo requise, sans appeler Cloudinary', async () => {
            const req = mockReq({
                body: { orderId: order._id.toString(), type: 'reception', emplacement: 'A-12' },
                staffUser: staff,
            });
            const res = mockRes();
            await createWarehouseScan(req, res);

            assert.strictEqual(res.statusCode, 201);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.scan.type, 'reception');
            assert.strictEqual(res.body.scan.emplacement, 'A-12');

            const scanEnBase = await WarehouseScan.findById(res.body.scan._id);
            assert.ok(scanEnBase, 'le scan doit être persisté');
            assert.strictEqual(scanEnBase.scannePar.toString(), staff._id.toString());
        });

        it("crée un scan retour_reception avec photo et fait passer le ReturnCase à 'return_received'", async () => {
            mockCloudinarySuccess();
            try {
                const req = mockReq({
                    body: { orderId: order._id.toString(), type: 'retour_reception' },
                    files: [{ buffer: Buffer.from('fake-image-bytes') }],
                    staffUser: staff,
                });
                const res = mockRes();
                await createWarehouseScan(req, res);

                assert.strictEqual(res.statusCode, 201);
                assert.deepStrictEqual(res.body.scan.photos, ['https://mock.cloudinary.test/photo.jpg']);

                const returnCase = await ReturnCase.findOne({ orderId: order._id });
                assert.ok(returnCase, 'un ReturnCase doit être créé automatiquement');
                assert.strictEqual(returnCase.statut, 'return_received');
                assert.strictEqual(returnCase.scans.length, 1);
            } finally {
                restoreCloudinary();
            }
        });

        it("un second scan retour_inspection met à jour le ReturnCase existant (pas de doublon)", async () => {
            mockCloudinarySuccess();
            try {
                // 1er scan : réception
                await createWarehouseScan(mockReq({
                    body: { orderId: order._id.toString(), type: 'retour_reception' },
                    files: [{ buffer: Buffer.from('fake-image-bytes') }],
                    staffUser: staff,
                }), mockRes());

                // 2e scan : inspection
                const res2 = mockRes();
                await createWarehouseScan(mockReq({
                    body: { orderId: order._id.toString(), type: 'retour_inspection' },
                    files: [{ buffer: Buffer.from('fake-image-bytes-2') }],
                    staffUser: staff,
                }), res2);

                assert.strictEqual(res2.statusCode, 201);

                const cases = await ReturnCase.find({ orderId: order._id });
                assert.strictEqual(cases.length, 1, 'un seul ReturnCase par commande');
                assert.strictEqual(cases[0].statut, 'return_inspection');
                assert.strictEqual(cases[0].scans.length, 2);
            } finally {
                restoreCloudinary();
            }
        });

        it('journalise chaque scan (JournalAction)', async () => {
            await createWarehouseScan(mockReq({
                body: { orderId: order._id.toString(), type: 'preparation' },
                staffUser: staff,
            }), mockRes());

            const logs = await JournalAction.find({ action: 'warehouse.scan' });
            assert.strictEqual(logs.length, 1);
            assert.strictEqual(logs[0].acteurId.toString(), staff._id.toString());
        });
    });

    // ─── getWarehouseScans / listWarehouseScans ─────────────────────────

    describe('getWarehouseScans', () => {
        it("retourne les scans d'une commande, triés du plus récent au plus ancien", async () => {
            await WarehouseScan.create({ orderId: order._id, type: 'reception', scannePar: staff._id, scanneLe: new Date('2026-08-01') });
            await WarehouseScan.create({ orderId: order._id, type: 'preparation', scannePar: staff._id, scanneLe: new Date('2026-08-02') });

            const req = mockReq({ params: { orderId: order._id.toString() } });
            const res = mockRes();
            await getWarehouseScans(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.scans.length, 2);
            assert.strictEqual(res.body.scans[0].type, 'preparation'); // le plus récent en premier
        });
    });

    describe('listWarehouseScans', () => {
        beforeEach(async () => {
            await WarehouseScan.create({ orderId: order._id, type: 'reception', scannePar: staff._id, scanneLe: new Date('2026-08-01') });
            await WarehouseScan.create({ orderId: order._id, type: 'expedition', scannePar: staff._id, scanneLe: new Date('2026-08-05') });
            await WarehouseScan.create({ orderId: order._id, type: 'reception', scannePar: staff._id, scanneLe: new Date('2026-08-10') });
        });

        it('filtre par type', async () => {
            const req = mockReq({ query: { type: 'reception' } });
            const res = mockRes();
            await listWarehouseScans(req, res);
            assert.strictEqual(res.body.scans.length, 2);
            assert.ok(res.body.scans.every(s => s.type === 'reception'));
        });

        it('filtre par plage de dates et pagine', async () => {
            const req = mockReq({ query: { dateDebut: '2026-08-04', dateFin: '2026-08-11', page: 1, limit: 1 } });
            const res = mockRes();
            await listWarehouseScans(req, res);
            assert.strictEqual(res.body.pagination.total, 2); // expedition (05) + reception (10)
            assert.strictEqual(res.body.scans.length, 1); // limité à 1 par page
        });
    });

    // ─── listReturns / getReturnById ─────────────────────────────────────

    describe('listReturns', () => {
        it('filtre par statut et pagine', async () => {
            await ReturnCase.create({ orderId: order._id, statut: 'return_received' });

            const order2 = await Order.create({
                userId: new mongoose.Types.ObjectId().toString(),
                amount: 5000, paymentType: 'COD', isPaid: false,
                address: new mongoose.Types.ObjectId().toString(), items: [],
            });
            await ReturnCase.create({ orderId: order2._id, statut: 'resolved' });

            const req = mockReq({ query: { statut: 'return_received' } });
            const res = mockRes();
            await listReturns(req, res);

            assert.strictEqual(res.body.returns.length, 1);
            assert.strictEqual(res.body.returns[0].statut, 'return_received');
        });
    });

    describe('getReturnById', () => {
        it('renvoie 404 si le retour est introuvable', async () => {
            const req = mockReq({ params: { id: new mongoose.Types.ObjectId().toString() } });
            const res = mockRes();
            await getReturnById(req, res);
            assert.strictEqual(res.statusCode, 404);
        });

        it('renvoie le retour peuplé', async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'return_received' });
            const req = mockReq({ params: { id: returnCase._id.toString() } });
            const res = mockRes();
            await getReturnById(req, res);
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.return._id.toString(), returnCase._id.toString());
        });
    });

    // ─── inspectReturn ────────────────────────────────────────────────────

    describe('inspectReturn', () => {
        it('renvoie 404 si le retour est introuvable', async () => {
            const req = mockReq({ params: { id: new mongoose.Types.ObjectId().toString() }, staffUser: staff });
            const res = mockRes();
            await inspectReturn(req, res);
            assert.strictEqual(res.statusCode, 404);
        });

        it("refuse (409) si le retour n'est pas au statut return_received", async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'return_requested' });
            const req = mockReq({ params: { id: returnCase._id.toString() }, body: { etat: 'bon' }, staffUser: staff });
            const res = mockRes();
            await inspectReturn(req, res);
            assert.strictEqual(res.statusCode, 409);
        });

        it("fait passer un retour return_received -> return_inspection et crée le scan associé", async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'return_received' });
            const req = mockReq({
                params: { id: returnCase._id.toString() },
                body: { etat: 'endommagé', note: 'Coin abîmé' },
                staffUser: staff,
            });
            const res = mockRes();
            await inspectReturn(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.return.statut, 'return_inspection');

            // [RAMCI §10] Le scan n'est plus renvoyé à plat dans la réponse :
            // il est rattaché au dossier de retour, qui est la seule pièce
            // que les équipes rouvrent ensuite. On le retrouve par là.
            const scan = await WarehouseScan.findById(res.body.return.scans.at(-1));
            assert.strictEqual(scan.type, 'retour_inspection');

            const log = await JournalAction.findOne({ action: 'returns.inspect' });
            assert.ok(log, 'l\'inspection doit être journalisée');
        });
    });

    // ─── resolveReturn ────────────────────────────────────────────────────

    describe('resolveReturn', () => {
        it('renvoie 404 si le retour est introuvable', async () => {
            const req = mockReq({
                params: { id: new mongoose.Types.ObjectId().toString() },
                body: { resolution: 'reject_return' },
                staffUser: staff,
            });
            const res = mockRes();
            await resolveReturn(req, res);
            assert.strictEqual(res.statusCode, 404);
        });

        it('refuse (409) si le retour est déjà résolu', async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'resolved' });
            const req = mockReq({
                params: { id: returnCase._id.toString() },
                body: { resolution: 'reject_return' },
                staffUser: staff,
            });
            const res = mockRes();
            await resolveReturn(req, res);
            assert.strictEqual(res.statusCode, 409);
        });

        it('refuse (400) une résolution invalide', async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'return_inspection' });
            const req = mockReq({
                params: { id: returnCase._id.toString() },
                body: { resolution: 'valeur_inexistante' },
                staffUser: staff,
            });
            const res = mockRes();
            await resolveReturn(req, res);
            assert.strictEqual(res.statusCode, 400);
        });

        it("résout en reroute_to_seller : pas de Refund créé", async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'return_inspection' });
            const req = mockReq({
                params: { id: returnCase._id.toString() },
                body: { resolution: 'reroute_to_seller', responsabilite: 'commercant' },
                staffUser: staff,
            });
            const res = mockRes();
            await resolveReturn(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.refundId, null);
            assert.strictEqual(await Refund.countDocuments(), 0);

            const updated = await ReturnCase.findById(returnCase._id);
            assert.strictEqual(updated.statut, 'resolved');
            assert.strictEqual(updated.resolution, 'reroute_to_seller');
        });

        it('résout en refund_client : crée un Refund EN ATTENTE DE FINANCE et lie refundId au ReturnCase', async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'return_inspection' });
            const req = mockReq({
                params: { id: returnCase._id.toString() },
                body: {
                    resolution: 'refund_client',
                    responsabilite: 'commercant',
                    montantDecide: 15000,
                    motif: 'Article défectueux',
                },
                staffUser: staff,
            });
            const res = mockRes();
            await resolveReturn(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.ok(res.body.refundId, 'un refundId doit être renvoyé');

            const refund = await Refund.findById(res.body.refundId);
            assert.ok(refund, 'le Refund doit être persisté');
            assert.strictEqual(refund.montantApprouve, 15000);

            // [RAMCI §10] Opérations DÉCIDE, Finance EXÉCUTE.
            // Avant, ce même appel créait un remboursement déjà 'approved'
            // dont l'approbateur était son propre auteur : celui qui
            // constatait le retour signait aussi la sortie d'argent. Le §10
            // sépare les deux rôles — « Finance exécute le remboursement
            // autorisé ». Le dossier naît donc 'requested', sans
            // approbateur, et attend Finance.
            assert.strictEqual(refund.statut, 'requested');
            assert.strictEqual(refund.demandePar.toString(), staff._id.toString());
            assert.strictEqual(refund.approuvePar, null);
            assert.strictEqual(res.body.remboursementEnAttenteDeFinance, true);

            const updated = await ReturnCase.findById(returnCase._id);
            assert.strictEqual(updated.statut, 'resolved');
            assert.strictEqual(updated.refundId.toString(), refund._id.toString());

            const log = await JournalAction.findOne({ action: 'refund.requested' });
            assert.ok(log, 'la demande de remboursement doit être journalisée');
        });

        it("résout en partial_refund avec le montant approuvé par défaut égal au montant de la commande si non fourni", async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'return_inspection' });
            const req = mockReq({
                params: { id: returnCase._id.toString() },
                body: { resolution: 'partial_refund', motif: 'Retour partiel' },
                staffUser: staff,
            });
            const res = mockRes();
            await resolveReturn(req, res);

            const refund = await Refund.findById(res.body.refundId);
            assert.strictEqual(refund.montantApprouve, order.amount);
        });
    });

    // ─── rejectReturn ─────────────────────────────────────────────────────

    describe('rejectReturn', () => {
        it('renvoie 404 si le retour est introuvable', async () => {
            const req = mockReq({ params: { id: new mongoose.Types.ObjectId().toString() }, staffUser: staff });
            const res = mockRes();
            await rejectReturn(req, res);
            assert.strictEqual(res.statusCode, 404);
        });

        it('refuse (409) si le retour est déjà résolu', async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'resolved' });
            const req = mockReq({ params: { id: returnCase._id.toString() }, staffUser: staff });
            const res = mockRes();
            await rejectReturn(req, res);
            assert.strictEqual(res.statusCode, 409);
        });

        it('rejette un retour : statut resolved, responsabilité client, aucun Refund', async () => {
            const returnCase = await ReturnCase.create({ orderId: order._id, statut: 'return_received' });
            const req = mockReq({
                params: { id: returnCase._id.toString() },
                body: { motif: 'Hors délai légal' },
                staffUser: staff,
            });
            const res = mockRes();
            await rejectReturn(req, res);

            assert.strictEqual(res.statusCode, 200);
            const updated = await ReturnCase.findById(returnCase._id);
            assert.strictEqual(updated.statut, 'resolved');
            assert.strictEqual(updated.resolution, 'reject_return');
            assert.strictEqual(updated.responsabilite, 'client');
            assert.strictEqual(await Refund.countDocuments(), 0);

            const log = await JournalAction.findOne({ action: 'returns.reject' });
            assert.ok(log);
        });
    });
});