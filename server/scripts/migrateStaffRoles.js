import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

// Contournement DNS pour mongodb+srv://
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();

import StaffUser from '../models/StaffUser.js';

/**
 * Script de migration des rôles existants.
 * 
 * Les comptes avec le rôle 'admin' deviennent 'super_admin'.
 * Les autres rôles (commercant, livreur, assistant_shein) restent inchangés.
 * 
 * À exécuter UNE SEULE FOIS après le seed des permissions.
 */
const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connexion MongoDB OK');

        const adminUsers = await StaffUser.find({ role: 'admin' });

        if (adminUsers.length === 0) {
            console.log('ℹ️ Aucun compte admin trouvé à migrer.');
            process.exit(0);
        }

        for (const user of adminUsers) {
            user.role = 'super_admin';
            await user.save();
            console.log(`✅ ${user.email} (${user.nom}) -> super_admin`);
        }

        console.log(`✅ Migration terminée : ${adminUsers.length} compte(s) migré(s).`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur migration :', error);
        process.exit(1);
    }
};

run();