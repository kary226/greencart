import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import Boutique from '../models/Boutique.js';
import StaffUser from '../models/StaffUser.js';

// Contrôleur testé — endpoint dont le routage a été migré de authSeller
// (cookie sellerToken) vers authStaff + requirePermission('catalog.view')
// le 23 août 2026 (voir routes/boutiqueRoute.js). Seul appelant réel :
// pages/seller/AddProduct.jsx, montée sous /admin/products/(add|edit) dans
// SuperAdminLayout — authentifiée exclusivement via staffToken.
import { listBoutiqueOptions } from '../controllers/boutiqueController.js';

console.error = () => {};

const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; res.statusCode = res.statusCode || 200; return res; };
    return res;
};

const creerCommercant = async (overrides = {}) => {
    return StaffUser.create({
        email: `commercant-${Date.now()}-${Math.random()}@test.ci`,
        password: 'hash',
        nom: 'Commerçant Test',
        role: 'commercant',
        statut: 'actif',
        ...overrides,
    });
};

const creerBoutique = async (overrides = {}) => {
    const owner = overrides.ownerId ? null : await creerCommercant();
    return Boutique.create({
        nom: 'Boutique Test',
        ownerId: owner?._id ?? overrides.ownerId,
        statut: 'active',
        ...overrides,
    });
};

describe('boutiqueController — listBoutiqueOptions (Phase 3, migration authSeller → RBAC)', () => {
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
        await Promise.all([
            Boutique.deleteMany({}),
            StaffUser.deleteMany({}),
        ]);
    });

    it("renvoie toutes les boutiques, actives et suspendues confondues, triées par nom", async () => {
        await creerBoutique({ nom: 'Zèbre Shop' });
        await creerBoutique({ nom: 'Alpha Store', statut: 'suspendue' });

        const res = mockRes();
        await listBoutiqueOptions({}, res);

        assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.boutiques.length, 2);
        // Tri alphabétique par nom (option de sélecteur, indépendant du statut)
        assert.strictEqual(res.body.boutiques[0].nom, 'Alpha Store');
        assert.strictEqual(res.body.boutiques[1].nom, 'Zèbre Shop');
    });

    it("ne renvoie que nom et statut, pas les autres champs (logo, description...)", async () => {
        await creerBoutique({ nom: 'Boutique Allégée', description: 'ne doit pas apparaître', logo: 'x.jpg' });

        const res = mockRes();
        await listBoutiqueOptions({}, res);

        const boutique = res.body.boutiques[0];
        assert.strictEqual(boutique.nom, 'Boutique Allégée');
        assert.strictEqual(boutique.description, undefined);
        assert.strictEqual(boutique.logo, undefined);
    });

    it("peuple le nom du propriétaire (ownerId → nom)", async () => {
        const owner = await creerCommercant({ nom: 'Kary Commerçant' });
        await creerBoutique({ nom: 'Boutique Kary', ownerId: owner._id });

        const res = mockRes();
        await listBoutiqueOptions({}, res);

        assert.strictEqual(res.body.boutiques[0].ownerId?.nom, 'Kary Commerçant');
    });

    it("renvoie une liste vide sans erreur quand aucune boutique n'existe", async () => {
        const res = mockRes();
        await listBoutiqueOptions({}, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.success, true);
        assert.deepStrictEqual(res.body.boutiques, []);
    });
});