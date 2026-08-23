import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import Setting from '../models/Setting.js';

// Contrôleur testé — route migrée le 23 août 2026 de authSeller vers
// authStaff + requireAnyPermission(['admin.configure', 'shein.update'])
// (voir routes/settingRoute.js). Deux appelants vivants, tous deux sous
// staffToken : pages/admin/Settings.jsx et pages/seller/ColisSheinManager.jsx
// (montée sous /admin/colis-shein).
import { getSetting, updateSetting, getAllSettings } from '../controllers/settingController.js';

console.error = () => {};

const mockReq = (overrides = {}) => ({ params: {}, body: {}, ...overrides });

const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; res.statusCode = res.statusCode || 200; return res; };
    return res;
};

describe('settingController (Phase 3, migration authSeller → RBAC)', () => {
    let mongoServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await Setting.deleteMany({});
    });

    describe('updateSetting', () => {
        it("crée un nouveau paramètre s'il n'existe pas encore (upsert)", async () => {
            const res = mockRes();
            await updateSetting(mockReq({ body: { key: 'shein.sheinExchangeRates', value: { usd: 620 } } }), res);

            assert.strictEqual(res.body.success, true);
            const enBase = await Setting.findOne({ key: 'shein.sheinExchangeRates' });
            assert.deepStrictEqual(enBase.value, { usd: 620 });
        });

        it('met à jour un paramètre existant sans créer de doublon', async () => {
            await Setting.create({ key: 'colisSheinActif', value: true });

            const res = mockRes();
            await updateSetting(mockReq({ body: { key: 'colisSheinActif', value: false } }), res);

            assert.strictEqual(res.body.success, true);
            const tous = await Setting.find({ key: 'colisSheinActif' });
            assert.strictEqual(tous.length, 1);
            assert.strictEqual(tous[0].value, false);
        });

        it('refuse une mise à jour sans clé', async () => {
            const res = mockRes();
            await updateSetting(mockReq({ body: { value: 'x' } }), res);

            assert.strictEqual(res.body.success, false);
            assert.match(res.body.message, /clé/i);
        });
    });

    describe('getSetting', () => {
        it('renvoie la valeur pour une clé existante', async () => {
            await Setting.create({ key: 'return-policy', value: '30 jours' });

            const res = mockRes();
            await getSetting(mockReq({ params: { key: 'return-policy' } }), res);

            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.data, '30 jours');
        });

        it("renvoie success: false pour une clé inexistante (pas d'erreur 500)", async () => {
            const res = mockRes();
            await getSetting(mockReq({ params: { key: 'inexistant' } }), res);

            assert.strictEqual(res.body.success, false);
        });
    });

    describe('getAllSettings', () => {
        it('renvoie tous les paramètres enregistrés', async () => {
            await Setting.create({ key: 'a', value: 1 });
            await Setting.create({ key: 'b', value: 2 });

            const res = mockRes();
            await getAllSettings(mockReq(), res);

            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.data.length, 2);
        });
    });
});