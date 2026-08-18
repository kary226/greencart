// Test de bout en bout du cycle de vie d'un commerçant, contre un serveur
// lancé EN LOCAL : invitation → boutique créée d'office → auto-réparation →
// suspension par l'admin → suppression du commerçant.
//
// Aucun téléphone requis : les codes 2FA sont générés avec otplib, la même
// librairie que le serveur.
//
// Ce script CRÉE des comptes de test temporaires (emails en @ramci.test) et
// les SUPPRIME à la fin, qu'il réussisse ou échoue. Il ne touche à aucune
// donnée réelle.
//
// Prérequis :
//   - Le serveur doit tourner dans un autre terminal (node server.js)
//   - Le .env doit contenir MONGODB_URI et JWT_SECRET
//
// Utilisation :
//   cd server
//   node scripts/testCycleCommercant.js               (par défaut http://localhost:4000)
//   node scripts/testCycleCommercant.js http://localhost:5000

import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import StaffUser from '../models/StaffUser.js';
import Invitation from '../models/Invitation.js';
import Boutique from '../models/Boutique.js';
import Wallet from '../models/Wallet.js';

const BASE_URL = process.argv[2] || 'http://localhost:4000';
const SUFFIX = Date.now();
const TEST_ADMIN_EMAIL = `test-admin-${SUFFIX}@ramci.test`;
const TEST_COMMERCANT_EMAIL = `test-commercant-${SUFFIX}@ramci.test`;
const TEST_PASSWORD = 'MotDePasseTest123';

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

// Mini client HTTP qui garde le cookie staffToken entre les appels.
const makeClient = () => {
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
            const match = setCookie.match(/staffToken=[^;]+/);
            if (match) cookie = match[0];
        }
        let data = {};
        try { data = await res.json(); } catch (_) { /* réponse non-JSON */ }
        return { status: res.status, data };
    };
};

const cleanup = async () => {
    const comptes = await StaffUser.find({
        email: { $in: [TEST_ADMIN_EMAIL, TEST_COMMERCANT_EMAIL] },
    }).select('_id');
    const ids = comptes.map((c) => c._id);

    await Boutique.deleteMany({ ownerId: { $in: ids } });
    await Wallet.deleteMany({ ownerId: { $in: ids } });
    await Invitation.deleteMany({ email: { $in: [TEST_ADMIN_EMAIL, TEST_COMMERCANT_EMAIL] } });
    await StaffUser.deleteMany({ _id: { $in: ids } });
};

const run = async () => {
    console.log("🔌 Connexion à MongoDB (préparation des comptes de test et nettoyage)...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ Connecté. Serveur ciblé : ${BASE_URL}\n`);

    try {
        await fetch(`${BASE_URL}/`);
    } catch (e) {
        console.log(`❌ Impossible de joindre ${BASE_URL} — le serveur est-il bien lancé (node server.js) ?`);
        await mongoose.disconnect();
        process.exit(1);
    }

    await cleanup();

    // ---- Admin de test ----
    const adminSecret = authenticator.generateSecret();
    const admin = await StaffUser.create({
        email: TEST_ADMIN_EMAIL,
        password: await bcrypt.hash(TEST_PASSWORD, 10),
        nom: 'Admin Test',
        role: 'admin',
        statut: 'actif',
        totpSecret: adminSecret,
    });

    const adminClient = makeClient();
    let r = await adminClient('/api/staff/login', {
        method: 'POST',
        body: JSON.stringify({
            email: TEST_ADMIN_EMAIL,
            password: TEST_PASSWORD,
            totpCode: authenticator.generate(adminSecret),
        }),
    });
    check('Connexion admin (mot de passe + code 2FA)', r.data.success === true, JSON.stringify(r.data));

    // ---- Invitation ----
    // Le serveur ne stocke que l'empreinte du jeton (le lien en clair ne vit
    // que dans l'e-mail) : on fabrique donc l'invitation ici avec un jeton
    // connu, pour pouvoir jouer l'activation.
    const jetonClair = crypto.randomBytes(32).toString('hex');
    await Invitation.create({
        email: TEST_COMMERCANT_EMAIL,
        role: 'commercant',
        token: crypto.createHash('sha256').update(jetonClair).digest('hex'),
        expireA: new Date(Date.now() + 3600 * 1000),
        creePar: admin._id,
    });

    const commercantClient = makeClient();
    r = await commercantClient(`/api/staff/activation/${jetonClair}`, {
        method: 'POST',
        body: JSON.stringify({ nom: 'Commerçant Test', password: TEST_PASSWORD }),
    });
    check("Activation du compte commerçant", r.data.success === true, JSON.stringify(r.data));
    const commercantSecret = r.data?.totpSetup?.secret;

    const commercant = await StaffUser.findOne({ email: TEST_COMMERCANT_EMAIL });

    // ---- La boutique et le portefeuille sont créés d'office ----
    let boutique = await Boutique.findOne({ ownerId: commercant._id });
    check("Une boutique est créée automatiquement à l'activation", !!boutique);
    check('Le compte pointe bien vers sa boutique',
        commercant.boutiqueId?.toString() === boutique?._id?.toString());
    check('Un portefeuille est créé automatiquement',
        !!(await Wallet.findOne({ ownerId: commercant._id })));

    r = await commercantClient('/api/boutiques/moi');
    check('Le commerçant récupère sa boutique via /api/boutiques/moi', r.data.success === true, JSON.stringify(r.data));

    // ---- Auto-réparation : c'est le bug d'origine ----
    await Boutique.deleteOne({ _id: boutique._id });
    await StaffUser.updateOne({ _id: commercant._id }, { boutiqueId: null });

    r = await commercantClient('/api/boutiques/moi');
    check("Une boutique manquante est recréée à la volée (plus de blocage « Aucune boutique associée »)",
        r.data.success === true && !!r.data.boutique?._id, JSON.stringify(r.data));

    boutique = await Boutique.findOne({ ownerId: commercant._id });
    const commercantRecharge = await StaffUser.findById(commercant._id);
    check('Le boutiqueId du compte est réparé lui aussi',
        commercantRecharge.boutiqueId?.toString() === boutique?._id?.toString());

    // ---- Vue admin ----
    r = await adminClient('/api/boutiques');
    const trouvee = (r.data.boutiques || []).find((b) => b._id === boutique._id.toString());
    check("L'admin voit la boutique dans la liste", !!trouvee, JSON.stringify(r.data).slice(0, 200));
    check('La ligne porte le commerçant et ses compteurs',
        trouvee?.ownerId?.email === TEST_COMMERCANT_EMAIL
        && typeof trouvee?.nombreProduits === 'number'
        && typeof trouvee?.soldeWallet === 'number');

    // ---- Suspension ----
    r = await adminClient(`/api/boutiques/${boutique._id}/statut`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: 'suspendue', motif: 'Test automatisé' }),
    });
    check("L'admin suspend la boutique", r.data.success === true, JSON.stringify(r.data));

    r = await commercantClient('/api/product/staff/add', { method: 'POST', body: JSON.stringify({}) });
    check('Boutique suspendue : la publication d\'un article est refusée',
        r.status === 403 && r.data.boutiqueSuspendue === true, JSON.stringify(r.data));

    r = await commercantClient('/api/coupon/mes-coupons/add', { method: 'POST', body: JSON.stringify({}) });
    check('Boutique suspendue : la création d\'un code promo est refusée', r.status === 403);

    r = await fetch(`${BASE_URL}/api/boutiques/${boutique._id}`).then((res) => res.json());
    check('Boutique suspendue : la vitrine publique répond « introuvable »', r.success === false);

    r = await commercantClient('/api/boutiques/moi');
    check('Le commerçant garde l\'accès à sa fiche et voit le motif',
        r.data.success === true && r.data.boutique?.motifSuspension === 'Test automatisé', JSON.stringify(r.data));

    r = await adminClient(`/api/boutiques/${boutique._id}/statut`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: 'active' }),
    });
    check("L'admin réactive la boutique", r.data.success === true);

    r = await commercantClient('/api/product/staff/add', { method: 'POST', body: JSON.stringify({}) });
    check('Boutique réactivée : la publication n\'est plus bloquée par la suspension', r.status !== 403,
        JSON.stringify(r.data));

    // ---- Suppression : garde-fou sur l'argent dû ----
    await Wallet.updateOne({ ownerId: commercant._id }, { solde: 5000 });
    r = await adminClient(`/api/staff/comptes/${commercant._id}/suppression`);
    check("L'aperçu de suppression signale le portefeuille non soldé",
        r.data.success === true && r.data.bloquants?.length > 0, JSON.stringify(r.data));

    r = await adminClient(`/api/staff/comptes/${commercant._id}`, { method: 'DELETE' });
    check('Suppression refusée tant que le portefeuille n\'est pas soldé',
        r.status === 409 && r.data.success === false, JSON.stringify(r.data));

    await Wallet.updateOne({ ownerId: commercant._id }, { solde: 0 });

    // ---- Suppression effective ----
    r = await adminClient(`/api/staff/comptes/${commercant._id}`, { method: 'DELETE' });
    check('Suppression du commerçant une fois le portefeuille soldé', r.data.success === true, JSON.stringify(r.data));
    check('Le compte a disparu', !(await StaffUser.findById(commercant._id)));
    check('La boutique a disparu', !(await Boutique.findOne({ ownerId: commercant._id })));
    check('Le portefeuille a disparu', !(await Wallet.findOne({ ownerId: commercant._id })));

    // ---- Garde-fous admin ----
    r = await adminClient(`/api/staff/comptes/${admin._id}`, { method: 'DELETE' });
    check('Un admin ne peut pas se supprimer lui-même', r.data.success === false);

    await cleanup();

    console.log('\n─────────────────────────────────────────');
    console.log(`Résultat : ${passed} réussi(s), ${failed} échoué(s)`);
    console.log('─────────────────────────────────────────');

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
};

run().catch(async (error) => {
    console.error('❌ Erreur pendant le test :', error);
    try { await cleanup(); } catch (_) { /* ignore */ }
    try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
    process.exit(1);
});
