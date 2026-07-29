// Script à lancer UNE SEULE FOIS pour créer le tout premier compte admin
// StaffUser. Nécessaire car le système d'invitation exige qu'un admin
// existe déjà pour en inviter un autre — celui-ci doit donc être créé
// directement en base, sans passer par une invitation.
//
// Utilisation :
//   cd server
//   node scripts/createFirstAdmin.js admin@ramci.ci "MotDePasseSolide123" "Nom Complet"
//
// À la fin, le script affiche un lien otpauth:// à scanner dans une
// application d'authentification (Google Authenticator, Authy, etc.)
// pour activer la double authentification (2FA), obligatoire dès la
// première connexion.

import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import StaffUser from '../models/StaffUser.js';

// Même contournement DNS que les autres scripts du projet (cf.
// fixInStockSync.js) pour les URI mongodb+srv:// qui échouent parfois à
// résoudre leur enregistrement SRV avec certains DNS locaux.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
    const [, , emailArg, passwordArg, nomArg] = process.argv;

    if (!emailArg || !passwordArg || !nomArg) {
        console.log('Usage : node scripts/createFirstAdmin.js <email> <mot_de_passe> "<nom complet>"');
        process.exit(1);
    }

    const email = emailArg.trim().toLowerCase();
    const nom = nomArg.trim();

    if (passwordArg.length < 8) {
        console.log('❌ Le mot de passe doit contenir au moins 8 caractères.');
        process.exit(1);
    }

    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté.\n');

    const existant = await StaffUser.findOne({ email });
    if (existant) {
        console.log(`❌ Un compte staff existe déjà avec l'email ${email} (rôle : ${existant.role}).`);
        await mongoose.disconnect();
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(passwordArg, 10);
    const totpSecret = authenticator.generateSecret();

    const admin = await StaffUser.create({
        email,
        password: hashedPassword,
        nom,
        role: 'admin',
        statut: 'actif',
        totpSecret,
    });

    const otpauthUrl = authenticator.keyuri(admin.email, 'GreenCart', totpSecret);

    console.log('─────────────────────────────────────────');
    console.log('✅ Compte admin créé avec succès :');
    console.log(`   Email : ${admin.email}`);
    console.log(`   Nom   : ${admin.nom}`);
    console.log('');
    console.log('📱 Scannez ce lien dans Google Authenticator / Authy pour activer la 2FA :');
    console.log(`   ${otpauthUrl}`);
    console.log('');
    console.log('   (Ce secret ne sera plus jamais affiché — notez-le ou scannez-le maintenant.)');
    console.log('─────────────────────────────────────────');

    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté. Terminé.');
    process.exit(0);
};

run().catch((error) => {
    console.error("❌ Erreur pendant la création de l'admin :", error);
    process.exit(1);
});