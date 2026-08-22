import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Modèles
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Boutique from '../models/Boutique.js';
import Product from '../models/Product.js';
import StaffUser from '../models/StaffUser.js';

// Fonctions à tester (depuis walletService)
import {
    crediterVenteEnAttente,
    libererFonds,
    traiterRetourColis,
    annulerVenteEnAttente,
    ajusterPortefeuille,
    repartirParBoutique,
} from '../services/walletService.js';

// Désactiver les logs
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
console.error = () => {};
console.log = () => {};

describe('walletService - Intégration', () => {
    let mongoServer;
    let commercant, boutique, produit, order;

    const creerOrder = (items, status = 'Order Placed') => ({
        _id: new mongoose.Types.ObjectId(),
        items,
        status,
        confirmationsBoutiques: [],
    });

    const creerProduit = (boutiqueId, stock = 10) => ({
        _id: new mongoose.Types.ObjectId(),
        name: 'Produit test',
        description: 'Description du produit de test',
        price: 10000,
        offerPrice: 9000,
        stock,
        inStock: true,
        boutiqueId,
        variants: [],
        categories: [],
        image: [],
    });

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        await mongoose.connect(uri);
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
    });

    beforeEach(async () => {
        await StaffUser.deleteMany({});
        await Boutique.deleteMany({});
        await Product.deleteMany({});
        await Wallet.deleteMany({});
        await WalletTransaction.deleteMany({});

        commercant = await StaffUser.create({
            email: 'commercant@test.com',
            nom: 'Commercant Test',
            role: 'commercant',
            statut: 'actif',
            password: 'hashed',
            totpSecret: 'secret',
        });

        boutique = await Boutique.create({
            nom: 'Boutique Test',
            ownerId: commercant._id,
            statut: 'active',
            peutCreerProduits: true,
        });

        produit = await creerProduit(boutique._id);
        await Product.create(produit);

        order = creerOrder([
            {
                product: produit._id,
                boutiqueId: boutique._id,
                quantity: 2,
                priceAtOrder: 9000,
                availabilityStatus: 'available',
            },
        ]);
    });

    describe('1. crediterVenteEnAttente', () => {
        it('doit créditer le solde en attente du commerçant', async () => {
            const result = await crediterVenteEnAttente(order);
            assert.strictEqual(result.creditees, 1);
            assert.ok(result.montantTotal > 0);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            assert.ok(wallet.soldeEnAttente > 0);
            assert.strictEqual(wallet.solde, 0);
        });

        it('doit être idempotent (ne pas créditer deux fois)', async () => {
            await crediterVenteEnAttente(order);
            const result2 = await crediterVenteEnAttente(order);
            assert.strictEqual(result2.creditees, 0);
            assert.strictEqual(result2.montantTotal, 0);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            const transactions = await WalletTransaction.find({ walletId: wallet._id });
            assert.strictEqual(transactions.length, 1);
        });
    });

    describe('2. libererFonds', () => {
        beforeEach(async () => {
            await crediterVenteEnAttente(order);
        });

        it('doit libérer les fonds si la commande est "Shipped"', async () => {
            order.status = 'Shipped';
            const result = await libererFonds(order);
            assert.strictEqual(result.liberees, 1);
            assert.ok(result.montantTotal > 0);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            assert.strictEqual(wallet.soldeEnAttente, 0);
            assert.ok(wallet.solde > 0);
        });

        it('ne doit PAS libérer si la commande n\'est pas "Shipped"', async () => {
            order.status = 'Confirmed';
            const result = await libererFonds(order);
            assert.strictEqual(result.liberees, 0);
            assert.strictEqual(result.blocked, true);
            assert.ok(result.reason.includes('Shipped'));

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            assert.strictEqual(wallet.solde, 0);
            assert.ok(wallet.soldeEnAttente > 0);
        });

        it('doit être idempotent (ne pas libérer deux fois)', async () => {
            order.status = 'Shipped';
            await libererFonds(order);
            const result2 = await libererFonds(order);
            assert.strictEqual(result2.liberees, 0);
            assert.strictEqual(result2.montantTotal, 0);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            const transactions = await WalletTransaction.find({
                walletId: wallet._id,
                type: 'liberation',
            });
            assert.strictEqual(transactions.length, 2);
        });
    });

    describe('3. traiterRetourColis', () => {
        beforeEach(async () => {
            await crediterVenteEnAttente(order);
        });

        it('doit reprendre les fonds en attente (cas 1)', async () => {
            const result = await traiterRetourColis(order);
            assert.strictEqual(result.boutiques, 1);
            assert.ok(result.montantRepris > 0);
            assert.strictEqual(result.articlesRestockes, 1);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            assert.strictEqual(wallet.soldeEnAttente, 0);
            assert.strictEqual(wallet.solde, 0);
        });

        it('doit reprendre les fonds disponibles (cas 2)', async () => {
            order.status = 'Shipped';
            await libererFonds(order);

            const result = await traiterRetourColis(order);
            assert.strictEqual(result.boutiques, 1);
            assert.ok(result.montantRepris > 0);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            assert.ok(Math.abs(wallet.solde) < 100);
            assert.strictEqual(wallet.soldeEnAttente, 0);
        });

        it('doit rendre le solde négatif si les fonds ont déjà été retirés (cas 3)', async () => {
            order.status = 'Shipped';
            await libererFonds(order);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            const montantRetrait = wallet.solde;

            await WalletTransaction.create({
                walletId: wallet._id,
                type: 'retrait',
                compte: 'disponible',
                montant: -montantRetrait,
                description: 'Retrait test',
            });
            await wallet.recalculerSoldes();
            assert.strictEqual(wallet.solde, 0);

            const result = await traiterRetourColis(order);
            assert.strictEqual(result.boutiques, 1);

            await wallet.recalculerSoldes();
            assert.ok(wallet.solde < 0);
        });

        it('ne doit PAS restocker si etat = "endommage"', async () => {
            const result = await traiterRetourColis(order, { etat: 'endommage' });
            assert.strictEqual(result.boutiques, 1);
            assert.ok(result.montantRepris > 0);
            assert.strictEqual(result.articlesRestockes, 0);
        });

        it('doit être idempotent', async () => {
            await traiterRetourColis(order);
            const result2 = await traiterRetourColis(order);
            assert.strictEqual(result2.boutiques, 0);
            assert.strictEqual(result2.montantRepris, 0);
        });
    });

    describe('4. annulerVenteEnAttente', () => {
        beforeEach(async () => {
            await crediterVenteEnAttente(order);
        });

        it('doit annuler le crédit en attente', async () => {
            const result = await annulerVenteEnAttente(order);
            assert.strictEqual(result.annulees, 1);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            assert.strictEqual(wallet.soldeEnAttente, 0);
            assert.strictEqual(wallet.solde, 0);
        });

        it('ne doit PAS annuler si les fonds sont déjà libérés', async () => {
            order.status = 'Shipped';
            await libererFonds(order);

            const result = await annulerVenteEnAttente(order);
            assert.strictEqual(result.annulees, 0);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            assert.ok(wallet.solde > 0);
        });

        it('doit être idempotent', async () => {
            await annulerVenteEnAttente(order);
            const result2 = await annulerVenteEnAttente(order);
            assert.strictEqual(result2.annulees, 0);

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            const transactions = await WalletTransaction.find({ walletId: wallet._id });
            assert.strictEqual(transactions.length, 2);
        });
    });

    describe('5. ajusterPortefeuille', () => {
        it('doit créer une transaction d\'ajustement sur le solde disponible', async () => {
            const transaction = await ajusterPortefeuille({
                boutiqueId: boutique._id,
                montant: -5000,
                description: 'Test ajustement',
                acteur: {
                    id: new mongoose.Types.ObjectId(),
                    nom: 'Admin Test',
                    role: 'admin',
                },
                idempotencyKey: 'test-key-123',
                motif: 'Correction manuelle pour test',
            });

            assert.ok(transaction !== null);
            assert.strictEqual(transaction.type, 'ajustement');
            assert.strictEqual(transaction.montant, -5000);
            assert.ok(transaction.creePar !== null);
            assert.strictEqual(transaction.idempotencyKey, 'test-key-123');

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            assert.strictEqual(wallet.solde, -5000);
        });

        it('doit être idempotent (même clé retourne la même transaction)', async () => {
            const t1 = await ajusterPortefeuille({
                boutiqueId: boutique._id,
                montant: 10000,
                description: 'Test idempotence',
                acteur: {
                    id: new mongoose.Types.ObjectId(),
                    nom: 'Admin Test',
                    role: 'admin',
                },
                idempotencyKey: 'unique-key-456',
                motif: 'Test idempotence',
            });

            const t2 = await ajusterPortefeuille({
                boutiqueId: boutique._id,
                montant: 10000,
                description: 'Test idempotence (dupliqué)',
                acteur: {
                    id: new mongoose.Types.ObjectId(),
                    nom: 'Admin Test',
                    role: 'admin',
                },
                idempotencyKey: 'unique-key-456',
                motif: 'Test idempotence',
            });

            assert.strictEqual(t1._id.toString(), t2._id.toString());

            const wallet = await Wallet.findOne({ ownerId: commercant._id });
            await wallet.recalculerSoldes();
            assert.strictEqual(wallet.solde, 10000);

            const transactions = await WalletTransaction.find({ walletId: wallet._id });
            assert.strictEqual(transactions.length, 1);
        });

        it('doit refuser un montant nul', async () => {
            const result = await ajusterPortefeuille({
                boutiqueId: boutique._id,
                montant: 0,
                description: 'Zéro',
                acteur: null,
                idempotencyKey: 'test-zero',
            });
            assert.strictEqual(result, null);
        });

        it('doit journaliser automatiquement si acteur fourni', async () => {
            const transaction = await ajusterPortefeuille({
                boutiqueId: boutique._id,
                montant: 1000,
                description: 'Ajustement avec acteur',
                acteur: {
                    id: commercant._id,
                    nom: 'Commercant Test',
                    role: 'commercant',
                },
                idempotencyKey: 'acteur-test',
                motif: 'Test avec acteur',
            });

            assert.strictEqual(transaction.creePar.toString(), commercant._id.toString());

            const JournalAction = (await import('../models/JournalAction.js')).default;
            const journalEntry = await JournalAction.findOne({
                action: 'wallet.ajustement',
                acteurId: commercant._id,
            });
            assert.ok(journalEntry !== null);
            assert.ok(journalEntry.note.includes('Test avec acteur'));
        });
    });

    describe('6. repartirParBoutique (fonction pure)', () => {
        it('doit répartir les montants par boutique', () => {
            const items = [
                { product: 'p1', boutiqueId: 'b1', quantity: 2, priceAtOrder: 1000 },
                { product: 'p2', boutiqueId: 'b1', quantity: 1, priceAtOrder: 500 },
                { product: 'p3', boutiqueId: 'b2', quantity: 3, priceAtOrder: 200 },
            ];
            const result = repartirParBoutique(items, new Map());
            assert.strictEqual(result.get('b1').montant, 2500);
            assert.strictEqual(result.get('b1').nombreArticles, 2);
            assert.strictEqual(result.get('b2').montant, 600);
            assert.strictEqual(result.get('b2').nombreArticles, 1);
        });

        it('doit ignorer les articles sans boutique', () => {
            const items = [
                { product: 'p1', boutiqueId: null, quantity: 1, priceAtOrder: 1000 },
                { product: 'p2', boutiqueId: 'b1', quantity: 1, priceAtOrder: 500 },
            ];
            const result = repartirParBoutique(items, new Map());
            assert.strictEqual(result.size, 1);
            assert.strictEqual(result.get('b1').montant, 500);
        });

        it('doit ignorer les lignes "unavailable"', () => {
            const items = [
                { product: 'p1', boutiqueId: 'b1', quantity: 1, priceAtOrder: 1000, availabilityStatus: 'unavailable' },
                { product: 'p2', boutiqueId: 'b1', quantity: 1, priceAtOrder: 500, availabilityStatus: 'available' },
            ];
            const result = repartirParBoutique(items, new Map());
            assert.strictEqual(result.get('b1').montant, 500);
        });
    });
});