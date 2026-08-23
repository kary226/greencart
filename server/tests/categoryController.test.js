import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import Category from '../models/Category.js';

// Contrôleur testé — routes admin migrées le 23 août 2026 de authSeller
// vers authStaff + requirePermission('catalog.categories') (voir
// routes/categoryRoute.js). Seul appelant vivant : pages/admin/Categories.jsx,
// sous SuperAdminLayout (staffToken).
//
// Les cas testés utilisent tous imageUrl (pas de fichier uploadé) pour ne
// pas dépendre de Cloudinary, qui n'est pas mocké ici.
import {
    getCategories,
    getAllCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
} from '../controllers/categoryController.js';

console.error = () => {};

const mockReq = (overrides = {}) => ({ query: {}, body: {}, file: null, ...overrides });

const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; res.statusCode = res.statusCode || 200; return res; };
    return res;
};

describe('categoryController (Phase 3, migration authSeller → RBAC)', () => {
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
        await Category.deleteMany({});
    });

    describe('addCategory', () => {
        it('crée une catégorie et normalise le slug (minuscules, espaces → tirets)', async () => {
            const res = mockRes();
            await addCategory(mockReq({ body: { name: 'Électroménager', slug: 'Petit Électro', imageUrl: 'https://x.test/a.jpg' } }), res);

            assert.strictEqual(res.body.success, true);
            const enBase = await Category.findOne({ name: 'Électroménager' });
            assert.strictEqual(enBase.slug, 'petit-électro');
        });

        it('refuse la création sans nom ni slug', async () => {
            const res = mockRes();
            await addCategory(mockReq({ body: { imageUrl: 'https://x.test/a.jpg' } }), res);

            assert.strictEqual(res.body.success, false);
            assert.strictEqual(await Category.countDocuments(), 0);
        });

        it('refuse un doublon sur le nom ou le slug', async () => {
            await Category.create({ name: 'Mode', slug: 'mode' });

            const res = mockRes();
            await addCategory(mockReq({ body: { name: 'Mode', slug: 'mode-2', imageUrl: 'https://x.test/a.jpg' } }), res);

            assert.strictEqual(res.body.success, false);
            assert.match(res.body.message, /existante/i);
        });
    });

    describe('updateCategory', () => {
        it('met à jour les champs sans toucher à Cloudinary si aucune image fournie', async () => {
            const cat = await Category.create({ name: 'Ancien', slug: 'ancien', image: 'https://x.test/old.jpg' });

            const res = mockRes();
            await updateCategory(mockReq({ body: { id: cat._id.toString(), name: 'Nouveau', slug: 'nouveau' } }), res);

            assert.strictEqual(res.body.success, true);
            const enBase = await Category.findById(cat._id);
            assert.strictEqual(enBase.name, 'Nouveau');
            assert.strictEqual(enBase.image, 'https://x.test/old.jpg');
        });
    });

    describe('deleteCategory', () => {
        it('supprime une catégorie existante', async () => {
            const cat = await Category.create({ name: 'À supprimer', slug: 'a-supprimer' });

            const res = mockRes();
            await deleteCategory(mockReq({ body: { id: cat._id.toString() } }), res);

            assert.strictEqual(res.body.success, true);
            assert.strictEqual(await Category.findById(cat._id), null);
        });
    });

    describe('toggleCategoryStatus', () => {
        it('bascule active de true à false puis inversement', async () => {
            const cat = await Category.create({ name: 'Bascule', slug: 'bascule', active: true });

            const res1 = mockRes();
            await toggleCategoryStatus(mockReq({ body: { id: cat._id.toString() } }), res1);
            assert.strictEqual(res1.body.active, false);

            const res2 = mockRes();
            await toggleCategoryStatus(mockReq({ body: { id: cat._id.toString() } }), res2);
            assert.strictEqual(res2.body.active, true);
        });

        it("renvoie success: false pour un id inexistant", async () => {
            const res = mockRes();
            await toggleCategoryStatus(mockReq({ body: { id: new mongoose.Types.ObjectId().toString() } }), res);

            assert.strictEqual(res.body.success, false);
        });
    });

    describe('getAllCategories / getCategories', () => {
        it('getAllCategories renvoie aussi les catégories inactives (vue admin)', async () => {
            await Category.create({ name: 'Active', slug: 'active', active: true });
            await Category.create({ name: 'Inactive', slug: 'inactive', active: false });

            const res = mockRes();
            await getAllCategories(mockReq(), res);

            assert.strictEqual(res.body.categories.length, 2);
        });

        it('getCategories (public) ne renvoie que les catégories actives', async () => {
            await Category.create({ name: 'Active', slug: 'active', active: true });
            await Category.create({ name: 'Inactive', slug: 'inactive', active: false });

            const res = mockRes();
            await getCategories(mockReq(), res);

            assert.strictEqual(res.body.categories.length, 1);
        });
    });
});