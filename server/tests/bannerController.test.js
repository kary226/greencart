import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import Banner from '../models/Banner.js';

// Contrôleur testé — routes admin migrées le 23 août 2026 de authSeller
// vers authStaff + requirePermission('catalog.banners') (voir
// routes/bannerRoute.js). Seul appelant vivant : pages/admin/Banners.jsx,
// sous SuperAdminLayout (staffToken).
//
// Les cas testés utilisent tous imageUrl (pas de fichier uploadé) pour ne
// pas dépendre de Cloudinary, qui n'est pas mocké ici.
import { getBanners, getAllBanners, addBanner, updateBanner, deleteBanner } from '../controllers/bannerController.js';

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

describe('bannerController (Phase 3, migration authSeller → RBAC)', () => {
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
        await Banner.deleteMany({});
    });

    describe('addBanner', () => {
        it('crée une bannière via imageUrl (sans upload)', async () => {
            const res = mockRes();
            await addBanner(mockReq({ body: { title: 'Promo', link: '/promo', position: 'top', imageUrl: 'https://x.test/img.jpg' } }), res);

            assert.strictEqual(res.body.success, true);
            const enBase = await Banner.findOne({ title: 'Promo' });
            assert.strictEqual(enBase.image, 'https://x.test/img.jpg');
            assert.strictEqual(enBase.active, true);
        });

        it("refuse la création sans image (ni upload ni URL)", async () => {
            const res = mockRes();
            await addBanner(mockReq({ body: { title: 'Sans image' } }), res);

            assert.strictEqual(res.body.success, false);
            const count = await Banner.countDocuments();
            assert.strictEqual(count, 0);
        });

        it("position par défaut à 'top' si non fournie", async () => {
            const res = mockRes();
            await addBanner(mockReq({ body: { imageUrl: 'https://x.test/img.jpg' } }), res);

            const enBase = await Banner.findOne();
            assert.strictEqual(enBase.position, 'top');
        });
    });

    describe('updateBanner', () => {
        it('modifie titre et lien sans toucher à Cloudinary si aucune image fournie', async () => {
            const banner = await Banner.create({ image: 'https://x.test/old.jpg', title: 'Ancien' });

            const res = mockRes();
            await updateBanner(mockReq({ body: { id: banner._id.toString(), title: 'Nouveau', link: '/nouveau' } }), res);

            assert.strictEqual(res.body.success, true);
            const enBase = await Banner.findById(banner._id);
            assert.strictEqual(enBase.title, 'Nouveau');
            assert.strictEqual(enBase.image, 'https://x.test/old.jpg', "l'image ne doit pas changer sans nouvelle source");
        });

        it('remplace l\'image via une nouvelle imageUrl', async () => {
            const banner = await Banner.create({ image: 'https://x.test/old.jpg' });

            const res = mockRes();
            await updateBanner(mockReq({ body: { id: banner._id.toString(), imageUrl: 'https://x.test/new.jpg' } }), res);

            const enBase = await Banner.findById(banner._id);
            assert.strictEqual(enBase.image, 'https://x.test/new.jpg');
            assert.strictEqual(enBase.publicId, null);
        });
    });

    describe('deleteBanner', () => {
        it('supprime une bannière existante', async () => {
            const banner = await Banner.create({ image: 'https://x.test/a.jpg' });

            const res = mockRes();
            await deleteBanner(mockReq({ body: { id: banner._id.toString() } }), res);

            assert.strictEqual(res.body.success, true);
            const enBase = await Banner.findById(banner._id);
            assert.strictEqual(enBase, null);
        });
    });

    describe('getAllBanners / getBanners', () => {
        it('getAllBanners renvoie aussi les bannières inactives (vue admin)', async () => {
            await Banner.create({ image: 'https://x.test/a.jpg', active: false });
            await Banner.create({ image: 'https://x.test/b.jpg', active: true });

            const res = mockRes();
            await getAllBanners(mockReq(), res);

            assert.strictEqual(res.body.banners.length, 2);
        });

        it('getBanners (public) ne renvoie que les bannières actives', async () => {
            await Banner.create({ image: 'https://x.test/a.jpg', active: false });
            await Banner.create({ image: 'https://x.test/b.jpg', active: true });

            const res = mockRes();
            await getBanners(mockReq(), res);

            assert.strictEqual(res.body.banners.length, 1);
        });
    });
});