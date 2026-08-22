// Test de bout en bout du flux « colis retourné » pour un commerçant,
// contre un serveur lancé EN LOCAL.
//
// Couvre les trois scénarios qui comptent :
//   A. Retour en BON ÉTAT   -> argent repris + stock réintégré
//   B. Retour ENDOMMAGÉ     -> argent repris, stock INCHANGÉ
//   C. État non précisé     -> le serveur refuse (400), rien ne bouge
// Et un test d'idempotence : rejouer le même retour ne double ni
// l'argent ni le stock.
//
// Aucune donnée réelle touchée : tout ce que ce script crée (commerçant,
// boutique, portefeuille, produits, client, commandes) est marqué par un
// suffixe unique et supprimé à la fin, qu'il réussisse ou échoue.
//
// Prérequis :
//   - Le serveur doit tourner dans un autre terminal (node server.js)
//   - Le .env doit contenir MONGODB_URI, JWT_SECRET, SELLER_EMAIL, SELLER_PASSWORD
//
// Utilisation :
//   cd server
//   node scripts/testRetourColis.js               (par défaut http://localhost:4000)
//   node scripts/testRetourColis.js http://localhost:5000

import 'dotenv/config';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Boutique from '../models/Boutique.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import StaffUser from '../models/StaffUser.js';
import User from '../models/User.js';
import Address from '../models/Address.js';
import { crediterVenteEnAttente } from '../services/walletService.js';



const BASE_URL = process.argv[2] || 'http://localhost:4000';
const SUFFIX = Date.now();
const MARQUEUR = `retour-test-${SUFFIX}`;

let passed = 0;
let failed = 0;

const check = (label, condition, extra = '') => {
    if (condition) {
        console.log(`✅ ${label}`);
        passed++;
    } else {
        console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`);
        failed++;
    }
};

// Mini client HTTP qui garde un cookie nommé entre les appels (même
// principe que testCycleCommercant.js, généralisé au nom du cookie).
const makeClient = (cookieName) => {
    let cookie = '';
    return async (path, options = {}) => {
        const res = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(cookie ? { Cookie: cookie } : {}),
                ...(options.headers || {}),
            },
        });
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            const match = setCookie.match(new RegExp(`${cookieName}=[^;]+`));
            if (match) cookie = match[0];
        }
        let data = {};
        try { data = await res.json(); } catch (_) { /* réponse non-JSON */ }
        return { status: res.status, data };
    };
};

// Tout ce qui est créé est répertorié ici pour un nettoyage précis à la fin,
// que le script réussisse ou plante en cours de route.
const crees = { staffUsers: [], boutiques: [], produits: [], commandes: [], users: [], adresses: [] };

const cleanup = async () => {
    await Order.deleteMany({ _id: { $in: crees.commandes } });
    await WalletTransaction.deleteMany({ orderId: { $in: crees.commandes } });
    await Product.deleteMany({ _id: { $in: crees.produits } });
    await Wallet.deleteMany({ ownerId: { $in: crees.staffUsers } });
    await Boutique.deleteMany({ _id: { $in: crees.boutiques } });
    await StaffUser.deleteMany({ _id: { $in: crees.staffUsers } });
    await Address.deleteMany({ _id: { $in: crees.adresses } });
    await User.deleteMany({ _id: { $in: crees.users } });
};

/**
 * Crée une commande déjà CONFIRMÉE avec un seul article d'une boutique, et
 * crédite immédiatement le commerçant via le vrai service (comme le ferait
 * confirmerCommandeCommercant + validation admin) — pour partir directement
 * au stade « prête à être retournée » sans rejouer tout le circuit HTTP.
 */
const creerCommandeConfirmee = async ({ boutique, produit, adresse, userId, quantite }) => {
    const order = await Order.create({
        userId,
        items: [{
            product: produit._id.toString(),
            quantity: quantite,
            priceAtOrder: produit.offerPrice,
            name: produit.name,
            availabilityStatus: 'available',
            boutiqueId: boutique._id,
        }],
        amount: produit.offerPrice * quantite,
        address: adresse._id.toString(),
        status: 'Confirmed',
        confirmedAt: new Date(),
        paymentType: 'COD',
        isPaid: false,
        confirmationsBoutiques: [{
            boutiqueId: boutique._id,
            confirmePar: boutique.ownerId,
            confirmeParNom: 'Commerçant Test Retour',
            confirmeLe: new Date(),
        }],
        confirmeParAdminLe: new Date(),
    });
    crees.commandes.push(order._id);

    const { creditees } = await crediterVenteEnAttente(order);
    check(`[setup] Crédit en attente posé pour la commande #${order._id.toString().slice(-6)}`, creditees === 1);

    return order;
};

const run = async () => {
    if (!process.env.SELLER_EMAIL || !process.env.SELLER_PASSWORD) {
        console.log('❌ SELLER_EMAIL / SELLER_PASSWORD manquants dans .env — ce sont les identifiants du compte admin technique (espace /api/order/status).');
        process.exit(1);
    }

    console.log('🔌 Connexion à MongoDB (préparation des données de test)...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ Connecté. Serveur ciblé : ${BASE_URL}\n`);

    try {
        await fetch(`${BASE_URL}/`);
    } catch (e) {
        console.log(`❌ Impossible de joindre ${BASE_URL} — le serveur est-il bien lancé (node server.js) ?`);
        await mongoose.disconnect();
        process.exit(1);
    }

    try {
        // ---- Admin (compte technique) ----
        const adminClient = makeClient('sellerToken');
        let r = await adminClient('/api/seller/login', {
            method: 'POST',
            body: JSON.stringify({ email: process.env.SELLER_EMAIL, password: process.env.SELLER_PASSWORD }),
        });
        check('Connexion admin (compte technique)', r.data.success === true, JSON.stringify(r.data));

        // ---- Commerçant, boutique, portefeuille de test ----
        const staff = await StaffUser.create({
            email: `commercant-${MARQUEUR}@ramci.test`,
            password: 'motdepasse-non-utilise-dans-ce-test', // jamais utilisé pour se connecter ici
            nom: 'Commerçant Test Retour',
            role: 'commercant',
            statut: 'actif',
        });
        crees.staffUsers.push(staff._id);

        const boutique = await Boutique.create({ nom: 'Boutique Test Retour', ownerId: staff._id, statut: 'active' });
        crees.boutiques.push(boutique._id);
        await StaffUser.updateOne({ _id: staff._id }, { boutiqueId: boutique._id });

        const wallet = await Wallet.create({ ownerId: staff._id, solde: 0, soldeEnAttente: 0 });

        // ---- Client + adresse ----
        const user = await User.create({ name: 'Client Test Retour', email: `client-${MARQUEUR}@ramci.test` });
        crees.users.push(user._id);
        const adresse = await Address.create({
            userId: user._id.toString(), firstName: 'Client', lastName: 'Test',
            street: '1 rue du test', phone: '0000000000',
        });
        crees.adresses.push(adresse._id);

        // ═══════════════════════════════════════════════════════════
        // SCÉNARIO A — retour en BON ÉTAT : argent repris + stock réintégré
        // ═══════════════════════════════════════════════════════════
        console.log('\n── Scénario A : retour en bon état ──');
        const stockInitialA = 5;
        const produitA = await Product.create({
            name: `Article Test Retour A ${MARQUEUR}`, description: 'Produit de test', price: 10000, offerPrice: 10000,
            image: ['https://example.com/test.jpg'], categories: ['Test'], boutiqueId: boutique._id, stock: stockInitialA, inStock: true,
        });
        crees.produits.push(produitA._id);

        const orderA = await creerCommandeConfirmee({ boutique, produit: produitA, adresse, userId: user._id.toString(), quantite: 2 });

        r = await adminClient('/api/order/status', {
            method: 'POST',
            body: JSON.stringify({
                orderId: orderA._id.toString(), status: 'Returned',
                retourEtat: 'bon_etat', retourNote: "Client a changé d'avis, colis intact",
            }),
        });
        check('Retour bon état accepté par le serveur', r.data.success === true, JSON.stringify(r.data));

        const produitAApres = await Product.findById(produitA._id);
        check('Le stock est réintégré (+2)', produitAApres.stock === stockInitialA + 2, `stock=${produitAApres.stock}`);

        const orderAApres = await Order.findById(orderA._id);
        check("L'order garde retourEtat='bon_etat'", orderAApres.retourEtat === 'bon_etat');
        check('retourTraiteLe est posé', !!orderAApres.retourTraiteLe);

        const transactionRetourA = await WalletTransaction.findOne({ orderId: orderA._id, type: 'retour' });
        check('Une transaction "retour" a été créée', !!transactionRetourA);
        check("Le montant repris est négatif (argent retiré du portefeuille)",
            !!transactionRetourA && transactionRetourA.montant < 0);

        const walletApresA = await Wallet.findById(wallet._id);
        check('Le solde en attente du commerçant est revenu à 0 après reprise',
            walletApresA.soldeEnAttente === 0, `soldeEnAttente=${walletApresA.soldeEnAttente}`);

        // ---- Idempotence : rejouer le même retour ne double rien ----
        r = await adminClient('/api/order/status', {
            method: 'POST',
            body: JSON.stringify({ orderId: orderA._id.toString(), status: 'Returned', retourEtat: 'bon_etat' }),
        });
        const produitARejoue = await Product.findById(produitA._id);
        check('Rejouer le retour ne réintègre pas le stock une seconde fois',
            produitARejoue.stock === stockInitialA + 2, `stock=${produitARejoue.stock}`);
        const nbTransactionsRetourA = await WalletTransaction.countDocuments({ orderId: orderA._id, type: 'retour' });
        check('Rejouer le retour ne crée pas une deuxième transaction', nbTransactionsRetourA === 1);

        // ═══════════════════════════════════════════════════════════
        // SCÉNARIO B — retour ENDOMMAGÉ : argent repris, stock INCHANGÉ
        // ═══════════════════════════════════════════════════════════
        console.log('\n── Scénario B : retour endommagé ──');
        const stockInitialB = 3;
        const produitB = await Product.create({
            name: `Article Test Retour B ${MARQUEUR}`, description: 'Produit de test', price: 8000, offerPrice: 8000,
            image: ['https://example.com/test.jpg'], categories: ['Test'], boutiqueId: boutique._id, stock: stockInitialB, inStock: true,
        });
        crees.produits.push(produitB._id);

        const orderB = await creerCommandeConfirmee({ boutique, produit: produitB, adresse, userId: user._id.toString(), quantite: 1 });

        r = await adminClient('/api/order/status', {
            method: 'POST',
            body: JSON.stringify({
                orderId: orderB._id.toString(), status: 'Returned',
                retourEtat: 'endommage', retourNote: 'Carton écrasé pendant le transport',
            }),
        });
        check('Retour endommagé accepté par le serveur', r.data.success === true, JSON.stringify(r.data));

        const produitBApres = await Product.findById(produitB._id);
        check('Le stock reste INCHANGÉ (article endommagé)', produitBApres.stock === stockInitialB, `stock=${produitBApres.stock}`);

        const transactionRetourB = await WalletTransaction.findOne({ orderId: orderB._id, type: 'retour' });
        check("L'argent est quand même repris malgré l'article endommagé",
            !!transactionRetourB && transactionRetourB.montant < 0);

        // ═══════════════════════════════════════════════════════════
        // SCÉNARIO C — état non précisé : le serveur doit refuser
        // ═══════════════════════════════════════════════════════════
        console.log("\n── Scénario C : retour sans précision d'état ──");
        const produitC = await Product.create({
            name: `Article Test Retour C ${MARQUEUR}`, description: 'Produit de test', price: 5000, offerPrice: 5000,
            image: ['https://example.com/test.jpg'], categories: ['Test'], boutiqueId: boutique._id, stock: 1, inStock: true,
        });
        crees.produits.push(produitC._id);

        const orderC = await creerCommandeConfirmee({ boutique, produit: produitC, adresse, userId: user._id.toString(), quantite: 1 });

        r = await adminClient('/api/order/status', {
            method: 'POST',
            body: JSON.stringify({ orderId: orderC._id.toString(), status: 'Returned' }), // pas de retourEtat
        });
        check("Le serveur refuse un retour sans état précisé (400)",
            r.status === 400 && r.data.success === false, JSON.stringify(r.data));

        const orderCApres = await Order.findById(orderC._id);
        check("La commande n'a PAS basculé sur 'Returned' tant que l'état n'est pas précisé",
            orderCApres.status !== 'Returned', `status=${orderCApres.status}`);

        const produitCApres = await Product.findById(produitC._id);
        check('Le stock du scénario C est resté intact (aucun effet de bord)', produitCApres.stock === 1);

        console.log('\n─────────────────────────────────────────');
        console.log(`Résultat : ${passed} réussi(s), ${failed} échoué(s)`);
        console.log('─────────────────────────────────────────');
    } finally {
        await cleanup();
        await mongoose.disconnect();
    }

    process.exit(failed > 0 ? 1 : 0);
};

run().catch(async (error) => {
    console.error('❌ Erreur pendant le test :', error);
    try { await cleanup(); } catch (_) { /* ignore */ }
    try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
    process.exit(1);
});