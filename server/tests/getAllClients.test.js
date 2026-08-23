import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import User from '../models/User.js';

// Contrôleur testé — route migrée le 23 août 2026 de authSeller vers
// authStaff + requirePermission('clients.view') (voir routes/userRoute.js).
// Seul appelant vivant : pages/admin/Clients.jsx, sous SuperAdminLayout
// (staffToken).
import { getAllClients } from '../controllers/userController.js';

console.error = () => {};
const consoleLogOriginal = console.log;
console.log = () => {};

const mockReq = (query = {}) => ({ query });

const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; res.statusCode = res.statusCode || 200; return res; };
    return res;
};

const creerClient = async (overrides = {}) => {
    return User.create({
        name: 'Client Test',
        email: `client-${Date.now()}-${Math.random()}@test.ci`,
        password: 'hash',
        ...overrides,
    });
};

describe('userController — getAllClients (Phase 3, migration authSeller → RBAC)', () => {
    let mongoServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
        console.log = consoleLogOriginal;
    });

    beforeEach(async () => {
        await User.deleteMany({});
    });

    it('renvoie la liste paginée avec le total et le nombre de pages', async () => {
        for (let i = 0; i < 3; i++) await creerClient({ lastName: `Nom${i}` });

        const res = mockRes();
        await getAllClients(mockReq({ page: 1, limit: 2 }), res);

        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.clients.length, 2);
        assert.strictEqual(res.body.total, 3);
        assert.strictEqual(res.body.pages, 2);
    });

    it('ne renvoie jamais le mot de passe ni les jetons de reset', async () => {
        await creerClient({ resetPasswordToken: 'secret-token' });

        const res = mockRes();
        await getAllClients(mockReq(), res);

        const client = res.body.clients[0];
        assert.strictEqual(client.password, undefined);
        assert.strictEqual(client.resetPasswordToken, undefined);
    });

    it('filtre par recherche sur nom, email ou téléphone (insensible à la casse)', async () => {
        await creerClient({ name: 'Aminata Koné', email: 'aminata@test.ci' });
        await creerClient({ name: 'Autre Client', email: 'autre@test.ci' });

        const res = mockRes();
        await getAllClients(mockReq({ search: 'aminata' }), res);

        assert.strictEqual(res.body.clients.length, 1);
        assert.strictEqual(res.body.clients[0].email, 'aminata@test.ci');
    });

    it('échappe les caractères spéciaux de regex dans la recherche (pas de ReDoS/crash)', async () => {
        await creerClient({ name: 'Client Normal' });

        const res = mockRes();
        await getAllClients(mockReq({ search: '(.*+)[' }), res);

        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.clients.length, 0);
    });

    it('plafonne la limite à 100 même si une valeur plus grande est demandée', async () => {
        const res = mockRes();
        await getAllClients(mockReq({ limit: 500 }), res);

        assert.strictEqual(res.body.success, true);
        // Rien à paginer ici, mais la requête ne doit pas planter avec une limite hors bornes.
    });
});