import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

import StaffUser from '../models/StaffUser.js';
import RolePermission from '../models/RolePermission.js';

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connexion MongoDB OK');

        const sellerEmail = process.env.SELLER_EMAIL?.trim().toLowerCase();
        if (!sellerEmail) {
            console.log('❌ SELLER_EMAIL non défini dans .env');
            process.exit(1);
        }

        // Vérifier si le compte existe déjà
        const existing = await StaffUser.findOne({ email: sellerEmail });
        if (existing) {
            console.log(`ℹ️ Un compte staff existe déjà pour ${sellerEmail} (rôle: ${existing.role})`);
            if (existing.role === 'super_admin') {
                console.log('✅ Déjà super_admin, aucune action nécessaire.');
                process.exit(0);
            }
            // Mettre à jour le rôle vers super_admin
            existing.role = 'super_admin';
            await existing.save();
            console.log(`✅ ${sellerEmail} mis à jour vers super_admin`);
            process.exit(0);
        }

        const sellerPassword = process.env.SELLER_PASSWORD;
        if (!sellerPassword) {
            console.log('❌ SELLER_PASSWORD non défini dans .env');
            process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(sellerPassword, 10);
        const totpSecret = authenticator.generateSecret();

        // Créer le compte staff
        const staffUser = await StaffUser.create({
            email: sellerEmail,
            password: hashedPassword,
            nom: 'Super Admin (seller migré)',
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
        console.log('   Le mot de passe est le même que SELLER_PASSWORD.');
        console.log('─────────────────────────────────────────');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur :', error);
        process.exit(1);
    }
};

run();