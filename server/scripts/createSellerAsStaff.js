import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

// Contournement DNS pour mongodb+srv://
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();

import StaffUser from '../models/StaffUser.js';

/**
 * Script de création d'un compte staff équivalent au compte 'seller' technique.
 * 
 * Le compte 'seller' est un compte technique unique défini par SELLER_EMAIL et SELLER_PASSWORD.
 * Il n'a pas de 2FA ni d'audit individuel. Pour le remplacer, on crée un compte StaffUser
 * avec le même email, le rôle 'super_admin' et la 2FA activée.
 * 
 * Ce script lit SELLER_EMAIL et SELLER_PASSWORD depuis le .env.
 * Si un compte existe déjà avec cet email, on ne fait rien.
 * 
 * À exécuter UNE SEULE FOIS après la migration des rôles.
 */
const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connexion MongoDB OK');

        const sellerEmail = process.env.SELLER_EMAIL?.trim().toLowerCase();
        if (!sellerEmail) {
            console.log('❌ SELLER_EMAIL non défini dans .env');
            process.exit(1);
        }

        const existing = await StaffUser.findOne({ email: sellerEmail });
        if (existing) {
            console.log(`ℹ️ Un compte staff existe déjà pour ${sellerEmail} (rôle: ${existing.role})`);
            console.log('✅ Aucune action nécessaire.');
            process.exit(0);
        }

        const sellerPassword = process.env.SELLER_PASSWORD;
        if (!sellerPassword) {
            console.log('❌ SELLER_PASSWORD non défini dans .env');
            process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(sellerPassword, 10);
        const totpSecret = authenticator.generateSecret();

        const staffUser = await StaffUser.create({
            email: sellerEmail,
            password: hashedPassword,
            nom: 'Seller Principal (super_admin)',
            role: 'super_admin',
            statut: 'actif',
            totpSecret,
        });

        const otpauthUrl = authenticator.keyuri(staffUser.email, 'GreenCart', totpSecret);

        console.log('─────────────────────────────────────────');
        console.log('✅ Compte super_admin créé avec succès :');
        console.log(`   Email : ${staffUser.email}`);
        console.log(`   Rôle  : ${staffUser.role}`);
        console.log('');
        console.log('📱 Scannez ce lien dans Google Authenticator / Authy pour activer la 2FA :');
        console.log(`   ${otpauthUrl}`);
        console.log('');
        console.log('   (Ce secret ne sera plus jamais affiché — notez-le ou scannez-le maintenant.)');
        console.log('   Le mot de passe est le même que SELLER_PASSWORD.');
        console.log('─────────────────────────────────────────');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur :', error);
        process.exit(1);
    }
};

run();