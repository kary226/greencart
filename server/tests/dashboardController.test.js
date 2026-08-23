import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Modèles
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import DemandeRetrait from '../models/DemandeRetrait.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import CustomerCreditTransaction from '../models/CustomerCreditTransaction.js';
import StaffUser from '../models/StaffUser.js';

// Contrôleur testé — extrait le 23 août 2026 depuis adminRoutes.js
// (fonction anonyme inline sous '/dashboard/stats') vers
// dashboardController.js, aux côtés de getAdvancedKPIs / getFinanceKPIs.
import { getDashboardStats } from '../controllers/dashboardController.js';

// Bruit attendu (aucune erreur n'est censée survenir dans ces tests, mais
// on neutralise console.error par cohérence avec les autres fichiers).
console.error = () => {};

// ─── Mock Express minimaliste (même patron que warehouseReturns.test.js /
// reconciliationController.test.js) ─────────────────────────────────────
const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; res.statusCode = res.statusCode || 200; return res; };
    return res;
};

const creerUtilisateur = async (overrides = {}) => {
    return User.create({
        name: 'Client Test',
        email: `client-${Date.now()}-${Math.random()}@test.ci`,
        creditBalance: 0,
        ...overrides,
    });
};

const creerCommande = async (overrides = {}) => {
    return Order.create({
        userId: new mongoose.Types.ObjectId().toString(),
        amount: 10000,
        paymentType: 'COD',
        isPaid: true,
        address: new mongoose.Types.ObjectId().toString(),
        items: [],
        status: 'Order Placed',
        ...overrides,
    });
};

const creerProduit = async (overrides = {}) => {
    return Product.create({
        name: 'Produit Test',
        description: 'desc',
        price: 1000,
        offerPrice: 900,
        image: ['x.jpg'],
        categories: ['general'],
        stock: 10,
        ...overrides,
    });
};

describe('dashboardController — Tableau de bord (Phase 2.1, dernier module)', () => {
    let mongoServer;
    let staff;

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
            Product.deleteMany({}),
            User.deleteMany({}),
            Wallet.deleteMany({}),
            DemandeRetrait.deleteMany({}),
            ApprovalRequest.deleteMany({}),
            CustomerCreditTransaction.deleteMany({}),
            StaffUser.deleteMany({}),
        ]);

        staff = await StaffUser.create({
            email: `staff-${Date.now()}-${Math.random()}@test.ci`,
            password: 'hash',
            nom: 'Agent Dashboard',
            role: 'admin',
            statut: 'actif',
        });
    });

    describe('getDashboardStats', () => {
        it('renvoie stats.orders correctement ventilées par statut', async () => {
            await creerCommande({ status: 'Order Placed' });
            await creerCommande({ status: 'Checking Availability' });
            await creerCommande({ status: 'Confirmed' });
            await creerCommande({ status: 'Delivered' });
            await creerCommande({ status: 'Returned' });
            await creerCommande({ status: 'Cancelled' });
            await creerCommande({ status: 'Disputed' });
            // Exclue du total : pending_payment n'est jamais compté.
            await creerCommande({ status: 'pending_payment', isPaid: false });

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.stats.orders.total, 7, 'pending_payment doit être exclu du total');
            assert.strictEqual(res.body.stats.orders.pending, 3, 'Order Placed + Checking Availability + Confirmed');
            assert.strictEqual(res.body.stats.orders.delivered, 1);
            assert.strictEqual(res.body.stats.orders.returned, 1);
            assert.strictEqual(res.body.stats.orders.cancelled, 1);
            assert.strictEqual(res.body.stats.orders.disputed, 1);
        });

        it('compte pending comme Order Placed + Checking Availability + Confirmed', async () => {
            await creerCommande({ status: 'Order Placed' });
            await creerCommande({ status: 'Checking Availability' });
            await creerCommande({ status: 'Confirmed' });
            await creerCommande({ status: 'Delivered' });

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.body.stats.orders.pending, 3);
            assert.strictEqual(res.body.stats.orders.delivered, 1);
        });

        it('comptabilise les commandes du jour dans orders.today', async () => {
            await creerCommande({ status: 'Order Placed' }); // createdAt = maintenant par défaut
            const hier = new Date();
            hier.setDate(hier.getDate() - 1);
            const commandeHier = await creerCommande({ status: 'Order Placed' });
            await Order.updateOne(
                { _id: commandeHier._id },
                { createdAt: hier },
                { overwriteImmutable: true }
            );

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.body.stats.orders.total, 2);
            assert.strictEqual(res.body.stats.orders.today, 1, 'seule la commande créée aujourd\'hui doit être comptée');
        });

        it('calcule deliveries.pending (Ready for Shipment + Shipped) et deliveries.inProgress (Out for Delivery)', async () => {
            await creerCommande({ status: 'Ready for Shipment' });
            await creerCommande({ status: 'Shipped' });
            await creerCommande({ status: 'Out for Delivery' });

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.body.stats.deliveries.pending, 2);
            assert.strictEqual(res.body.stats.deliveries.inProgress, 1);
        });

        it('ignore les produits archivés et distingue rupture / stock bas (produit simple)', async () => {
            await creerProduit({ stock: 0 }); // rupture
            await creerProduit({ stock: 3 }); // stock bas (<=5)
            await creerProduit({ stock: 50 }); // stock normal
            await creerProduit({ stock: 0, isArchived: true }); // archivé, doit être ignoré

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.body.stats.products.total, 3, 'le produit archivé ne doit pas être compté');
            assert.strictEqual(res.body.stats.products.outOfStock, 1);
            assert.strictEqual(res.body.stats.products.lowStock, 1);
        });

        it('applique la même règle de stock aux produits à variantes', async () => {
            await creerProduit({
                stock: 0,
                variants: [
                    { color: 'rouge', stock: 0 },
                    { color: 'bleu', stock: 0 },
                ],
            }); // toutes les variantes à 0 -> rupture
            await creerProduit({
                stock: 0,
                variants: [
                    { color: 'rouge', stock: 2 },
                    { color: 'bleu', stock: 20 },
                ],
            }); // au moins une variante en stock bas (2) -> lowStock

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.body.stats.products.outOfStock, 1);
            assert.strictEqual(res.body.stats.products.lowStock, 1);
        });

        it('compte les nouveaux utilisateurs du jour dans users.newToday', async () => {
            await creerUtilisateur(); // aujourd'hui
            const ancien = await creerUtilisateur();
            const ilYA60Jours = new Date();
            ilYA60Jours.setDate(ilYA60Jours.getDate() - 60);
            await User.updateOne(
                { _id: ancien._id },
                { createdAt: ilYA60Jours },
                { overwriteImmutable: true }
            );

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.body.stats.users.total, 2);
            assert.strictEqual(res.body.stats.users.newToday, 1);
        });

        it('agrège finance : totalBalance/pendingBalance (wallets), revenue (commandes livrées), pendingWithdrawals, totalWithdrawals', async () => {
            await Wallet.create({ ownerId: staff._id, solde: 5000, soldeEnAttente: 2000 });
            const autreStaff = await StaffUser.create({
                email: `staff2-${Date.now()}@test.ci`, password: 'hash', nom: 'Agent 2', role: 'admin', statut: 'actif',
            });
            await Wallet.create({ ownerId: autreStaff._id, solde: 1000, soldeEnAttente: 500 });

            await creerCommande({ status: 'Delivered', amount: 7000 });
            await creerCommande({ status: 'Delivered', amount: 3000 });
            await creerCommande({ status: 'Order Placed', amount: 9999 }); // non livrée, exclue du revenue

            await DemandeRetrait.create({
                commercialId: staff._id, montant: 4000, operateur: 'orange_money',
                numero: '0700000000', cleIdempotence: 'RETRAIT-1', statut: 'en_attente',
            });
            await DemandeRetrait.create({
                commercialId: staff._id, montant: 6000, operateur: 'orange_money',
                numero: '0700000001', cleIdempotence: 'RETRAIT-2', statut: 'payee',
            });

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.body.stats.finance.totalBalance, 6000);
            assert.strictEqual(res.body.stats.finance.pendingBalance, 2500);
            assert.strictEqual(res.body.stats.finance.revenue, 10000, 'seules les commandes Delivered comptent dans revenue');
            assert.strictEqual(res.body.stats.finance.pendingWithdrawals, 1);
            assert.strictEqual(res.body.stats.finance.totalWithdrawals, 6000, 'seules les demandes payee comptent dans totalWithdrawals');
        });

        it('agrège rcoins.totalBalance (creditBalance utilisateurs) et rcoins.transactions', async () => {
            await creerUtilisateur({ creditBalance: 1500 });
            const client2 = await creerUtilisateur({ creditBalance: 500 });
            const commande = await creerCommande({ status: 'Delivered' });

            await CustomerCreditTransaction.create({
                userId: client2._id, orderId: commande._id, itemId: new mongoose.Types.ObjectId(),
                type: 'credit', amount: 500, description: 'remboursement article',
            });

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.body.stats.rcoins.totalBalance, 2000);
            assert.strictEqual(res.body.stats.rcoins.transactions, 1);
        });

        it('compte approvals.pending (ApprovalRequest en_attente uniquement)', async () => {
            await ApprovalRequest.create({
                type: 'withdrawal', payload: {}, montant: 10000, demandePar: staff._id, statut: 'en_attente',
            });
            await ApprovalRequest.create({
                type: 'wallet_adjust', payload: {}, montant: 5000, demandePar: staff._id, statut: 'approuvee',
            });

            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.body.stats.approvals.pending, 1);
        });

        it('renvoie une réponse à zéro sur une base vide, sans erreur', async () => {
            const res = mockRes();
            await getDashboardStats({}, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.stats.orders.total, 0);
            assert.strictEqual(res.body.stats.products.total, 0);
            assert.strictEqual(res.body.stats.users.total, 0);
            assert.strictEqual(res.body.stats.finance.totalBalance, 0);
            assert.strictEqual(res.body.stats.rcoins.totalBalance, 0);
            assert.strictEqual(res.body.stats.approvals.pending, 0);
        });
    });
});