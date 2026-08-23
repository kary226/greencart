import { describe, it } from 'node:test';
import assert from 'node:assert';

// Middleware testé — correctif du 23 août 2026 : 'admin.all' (accordé aux
// rôles legacy 'admin' ET 'super_admin' par seedRolePermissions.js /
// assignPermissions.js) faisait office de passe-droit total dans les
// intentions du seed, mais requirePermission/requireAnyPermission ne
// bypassaient que sur le rôle littéral 'super_admin'. Un compte de rôle
// 'admin' — legacy mais toujours en usage — se voyait donc refuser l'accès
// à toute route migrée vers requirePermission malgré 'admin.all'.
// Découvert en migrant routes/orderRoute.js (voir son commentaire).
import { requirePermission, requireAnyPermission } from '../middlewares/permission.js';

console.error = () => {};

const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    return res;
};

const mockReq = (staffUser) => ({ staffUser });

describe('permission.js — bypass admin.all (Phase 3)', () => {
    describe('requirePermission', () => {
        it("laisse passer un compte de rôle legacy 'admin' porteur de 'admin.all'", async () => {
            const req = mockReq({ role: 'admin', permissions: ['admin.all'] });
            const res = mockRes();
            let suivant = false;
            await requirePermission('orders.view')(req, res, () => { suivant = true; });
            assert.strictEqual(suivant, true);
        });

        it("laisse passer un compte 'super_admin' même si ses permissions ne listent pas explicitement la permission demandée", async () => {
            const req = mockReq({ role: 'super_admin', permissions: ['admin.all'] });
            const res = mockRes();
            let suivant = false;
            await requirePermission('orders.view')(req, res, () => { suivant = true; });
            assert.strictEqual(suivant, true);
        });

        it("refuse toujours un rôle granulaire sans la permission exacte ('admin.all' n'est jamais implicite)", async () => {
            const req = mockReq({ role: 'support_admin', permissions: ['clients.view'] });
            const res = mockRes();
            let suivant = false;
            await requirePermission('orders.edit')(req, res, () => { suivant = true; });
            assert.strictEqual(suivant, false);
            assert.strictEqual(res.statusCode, 403);
        });

        it('laisse passer un rôle granulaire qui a la permission exacte demandée', async () => {
            const req = mockReq({ role: 'support_admin', permissions: ['orders.view', 'orders.edit'] });
            const res = mockRes();
            let suivant = false;
            await requirePermission('orders.edit')(req, res, () => { suivant = true; });
            assert.strictEqual(suivant, true);
        });

        it('refuse une requête sans staffUser (non authentifié)', async () => {
            const req = mockReq(undefined);
            const res = mockRes();
            let suivant = false;
            await requirePermission('orders.view')(req, res, () => { suivant = true; });
            assert.strictEqual(suivant, false);
            assert.strictEqual(res.statusCode, 401);
        });
    });

    describe('requireAnyPermission', () => {
        it("laisse passer un compte de rôle legacy 'admin' porteur de 'admin.all'", async () => {
            const req = mockReq({ role: 'admin', permissions: ['admin.all'] });
            const res = mockRes();
            let suivant = false;
            await requireAnyPermission(['orders.view', 'clients.view'])(req, res, () => { suivant = true; });
            assert.strictEqual(suivant, true);
        });

        it("refuse un rôle granulaire sans aucune des permissions listées", async () => {
            const req = mockReq({ role: 'catalog_admin', permissions: ['catalog.view'] });
            const res = mockRes();
            let suivant = false;
            await requireAnyPermission(['orders.view', 'clients.view'])(req, res, () => { suivant = true; });
            assert.strictEqual(suivant, false);
            assert.strictEqual(res.statusCode, 403);
        });
    });
});