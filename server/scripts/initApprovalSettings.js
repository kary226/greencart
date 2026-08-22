import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

// Contournement DNS
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

import Setting, { initSettings } from '../models/Setting.js';

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connexion MongoDB OK');

        await initSettings();
        console.log('✅ Seuils d\'approbation initialisés :');
        console.log('   - wallet_adjust_threshold : 50 000 FCFA');
        console.log('   - withdrawal_threshold : 100 000 FCFA');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur :', error);
        process.exit(1);
    }
};

run();