import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import StaffUser from '../models/StaffUser.js';
import RolePermission from '../models/RolePermission.js';

// Middleware testé — route migrée le 23 août 2026 de l'ancien couple
// (x-metrics-token | sellerToken+TYPE_VENDEUR) vers
// (x-metrics-token | authStaff+requirePermission('admin.dashboard'))
// (voir routes/metricsRoute.js). Dernier des 12 fichiers du périmètre
// Phase 3 à basculer.
import { authMetrics } from '../routes/metricsRoute.js';

console.error = () => {};

// ─── Mock Express minimaliste (même patron que les autres fichiers de
// tests Phase 3) ──────────────────────────────────────────────────────
const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; res.statusCode = res.statusCode || 200; return res; };
    return res;
};

const mockReq = (overrides = {}) => ({
    cookies: {},
    headers: {},
    get(name) {
        return this.headers[name.toLowerCase()];
    },
    ...overrides,
});

const creerStaff = async ({ role = 'catalog_admin', permissions } = {}) => {
    const hash = await bcrypt.hash('motdepasse', 4);
    return StaffUser.create({
        email: `staff-${Date.now()}-${Math.random()}@test.ci`,
        password: hash,
        nom: 'Staff Test',
        role,
        statut: 'actif',
        ...(permissions ? { permissions } : {}),
    });
};

const signerStaffToken = (staffUser) =>
    jwt.sign({ id: staffUser._id.toString(), typ: 'staff' }, process.env.JWT_SECRET);

describe('metricsRoute — authMetrics (Phase 3, migration authSeller → RBAC)', () => {
    let mongoServer;
    let ancienSecret;
    let ancienMetricsToken;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
        ancienSecret = process.env.JWT_SECRET;
        ancienMetricsToken = process.env.METRICS_TOKEN;
        process.env.JWT_SECRET = 'secret-de-test';
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
        process.env.JWT_SECRET = ancienSecret;
        process.env.METRICS_TOKEN = ancienMetricsToken;
    });

    beforeEach(async () => {
        await StaffUser.deleteMany({});
        await RolePermission.deleteMany({});
        delete process.env.METRICS_TOKEN;
    });

    describe('voie machine (x-metrics-token)', () => {
        it("laisse passer quand l'en-tête correspond à METRICS_TOKEN", async () => {
            process.env.METRICS_TOKEN = 'jeton-secret-ci';
            const res = mockRes();
            let suivant = false;
            await authMetrics(
                mockReq({ headers: { 'x-metrics-token': 'jeton-secret-ci' } }),
                res,
                () => { suivant = true; },
            );
            assert.strictEqual(suivant, true);
            assert.strictEqual(res.body, null);
        });

        it("refuse un en-tête qui ne correspond pas", async () => {
            process.env.METRICS_TOKEN = 'jeton-secret-ci';
            const res = mockRes();
            let suivant = false;
            await authMetrics(
                mockReq({ headers: { 'x-metrics-token': 'mauvais-jeton' } }),
                res,
                () => { suivant = true; },
            );
            assert.strictEqual(suivant, false);
            assert.strictEqual(res.statusCode, 401);
        });

        it("n'ouvre pas l'accès sur un en-tête vide quand METRICS_TOKEN est absent (garde-fou)", async () => {
            // METRICS_TOKEN volontairement non défini (beforeEach le supprime déjà)
            const res = mockRes();
            let suivant = false;
            await authMetrics(mockReq({ headers: { 'x-metrics-token': '' } }), res, () => { suivant = true; });
            assert.strictEqual(suivant, false);
            assert.strictEqual(res.statusCode, 401);
        });
    });

    describe('voie staff (admin.dashboard)', () => {
        it("laisse passer un staff avec la permission admin.dashboard (via son rôle)", async () => {
            await RolePermission.create({ role: 'catalog_admin', permissions: ['admin.dashboard'] });
            const staff = await creerStaff({ role: 'catalog_admin' });
            const token = signerStaffToken(staff);

            const res = mockRes();
            let suivant = false;
            await authMetrics(mockReq({ cookies: { staffToken: token } }), res, () => { suivant = true; });

            assert.strictEqual(suivant, true);
            assert.strictEqual(res.body, null);
        });

        it("laisse passer un super_admin même sans permission admin.dashboard explicite (bypass rôle)", async () => {
            const staff = await creerStaff({ role: 'super_admin' });
            const token = signerStaffToken(staff);

            const res = mockRes();
            let suivant = false;
            await authMetrics(mockReq({ cookies: { staffToken: token } }), res, () => { suivant = true; });

            assert.strictEqual(suivant, true);
        });

        it('refuse un staff authentifié mais sans la permission admin.dashboard', async () => {
            await RolePermission.create({ role: 'support_admin', permissions: ['clients.view'] });
            const staff = await creerStaff({ role: 'support_admin' });
            const token = signerStaffToken(staff);

            const res = mockRes();
            let suivant = false;
            await authMetrics(mockReq({ cookies: { staffToken: token } }), res, () => { suivant = true; });

            assert.strictEqual(suivant, false);
            assert.strictEqual(res.statusCode, 403);
        });

        it('refuse une requête sans aucun jeton (ni machine, ni staff)', async () => {
            const res = mockRes();
            let suivant = false;
            await authMetrics(mockReq(), res, () => { suivant = true; });

            assert.strictEqual(suivant, false);
            assert.strictEqual(res.statusCode, 401);
        });

        it("refuse l'ancien jeton technique 'seller' (typ: 'seller') — la voie sellerToken est retirée", async () => {
            const vieuxToken = jwt.sign({ id: 'peu-importe', typ: 'seller' }, process.env.JWT_SECRET);

            const res = mockRes();
            let suivant = false;
            await authMetrics(mockReq({ cookies: { staffToken: vieuxToken } }), res, () => { suivant = true; });

            assert.strictEqual(suivant, false);
            assert.strictEqual(res.statusCode, 401);
        });

        it('refuse un compte staff suspendu même avec la bonne permission', async () => {
            await RolePermission.create({ role: 'catalog_admin', permissions: ['admin.dashboard'] });
            const staff = await creerStaff({ role: 'catalog_admin' });
            staff.statut = 'suspendu';
            await staff.save();
            const token = signerStaffToken(staff);

            const res = mockRes();
            let suivant = false;
            await authMetrics(mockReq({ cookies: { staffToken: token } }), res, () => { suivant = true; });

            assert.strictEqual(suivant, false);
            assert.strictEqual(res.statusCode, 403);
        });
    });
});