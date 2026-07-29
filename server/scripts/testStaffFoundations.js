// Test de bout en bout des fondations du système multi-comptes (Phase 1),
// contre un serveur lancé EN LOCAL. Aucun téléphone requis : les codes 2FA
// sont générés directement avec otplib (la même librairie que le serveur),
// donc parfaitement valides sans scanner de QR code.
//
// Ce script CRÉE des comptes de test temporaires (emails en @ramci.test)
// et les SUPPRIME à la fin, qu'il réussisse ou échoue. Il ne touche à
// aucune donnée réelle.
//
// Prérequis :
//   - Le serveur doit tourner dans un autre terminal (node server.js)
//   - Le .env doit contenir MONGODB_URI et JWT_SECRET
//
// Utilisation :
//   cd server
//   node scripts/testStaffFoundations.js               (par défaut http://localhost:4000)
//   node scripts/testStaffFoundations.js http://localhost:5000   (si autre port)

import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import StaffUser from '../models/StaffUser.js';
import Invitation from '../models/Invitation.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

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

// Mini client HTTP qui garde le cookie staffToken entre les appels, pour
// simuler une session par rôle (un client = une "personne" connectée).
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
    await StaffUser.deleteMany({ email: { $in: [TEST_ADMIN_EMAIL, TEST_COMMERCANT_EMAIL] } });
    await Invitation.deleteMany({ email: { $in: [TEST_ADMIN_EMAIL, TEST_COMMERCANT_EMAIL] } });
};

const run = async () => {
    console.log('🔌 Connexion à MongoDB (pour lire le token d\'invitation et nettoyer ensuite)...');
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

    r = await adminClient('/api/staff/is-auth');
    check('is-auth confirme le rôle admin', r.data.success && r.data.staffUser?.role === 'admin');

    r = await adminClient('/api/staff/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_COMMERCANT_EMAIL, role: 'commercant' }),
    });
    check("Création d'une invitation commerçant", r.data.success === true, JSON.stringify(r.data));

    const invitation = await Invitation.findOne({ email: TEST_COMMERCANT_EMAIL, utilisee: false });
    check('Invitation retrouvée en base avec un token', !!invitation?.token);

    const commercantClient = makeClient();
    r = await commercantClient(`/api/staff/activation/${invitation.token}`, {
        method: 'POST',
        body: JSON.stringify({ nom: 'Commerçant Test', password: TEST_PASSWORD }),
    });
    check('Activation du compte commerçant via le lien', r.data.success === true, JSON.stringify(r.data));
    const commercantSecret = r.data?.totpSetup?.secret;
    check('Un secret 2FA est renvoyé une seule fois à l\'activation', !!commercantSecret);

    r = await commercantClient('/api/staff/is-auth');
    check('Le compte est déjà connecté juste après activation', r.data.success && r.data.staffUser?.role === 'commercant');

    const commercantClient2 = makeClient();
    r = await commercantClient2('/api/staff/login', {
        method: 'POST',
        body: JSON.stringify({
            email: TEST_COMMERCANT_EMAIL,
            password: TEST_PASSWORD,
            totpCode: authenticator.generate(commercantSecret || ''),
        }),
    });
    check('Reconnexion normale du commerçant avec son code 2FA', r.data.success === true, JSON.stringify(r.data));

    r = await commercantClient2('/api/staff/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: `autre-${SUFFIX}@ramci.test`, role: 'livreur' }),
    });
    check("Le commerçant ne peut PAS créer d'invitation (réservé admin)", r.data.success === false);

    r = await adminClient('/api/staff/comptes');
    const emails = (r.data.comptes || []).map(c => c.email);
    check("La liste admin contient les 2 comptes de test",
        emails.includes(TEST_ADMIN_EMAIL) && emails.includes(TEST_COMMERCANT_EMAIL));

    const commercantEnBase = await StaffUser.findOne({ email: TEST_COMMERCANT_EMAIL });
    r = await adminClient(`/api/staff/comptes/${commercantEnBase._id}/statut`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: 'suspendu' }),
    });
    check('Suspension du compte commerçant par l\'admin', r.data.success === true, JSON.stringify(r.data));

    const commercantClient3 = makeClient();
    r = await commercantClient3('/api/staff/login', {
        method: 'POST',
        body: JSON.stringify({
            email: TEST_COMMERCANT_EMAIL,
            password: TEST_PASSWORD,
            totpCode: authenticator.generate(commercantSecret || ''),
        }),
    });
    check('Un compte suspendu ne peut plus se connecter', r.data.success === false);

    r = await adminClient(`/api/staff/comptes/${admin._id}/statut`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: 'suspendu' }),
    });
    check('Un admin ne peut pas se suspendre lui-même', r.data.success === false);

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