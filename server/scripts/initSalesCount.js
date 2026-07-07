// Script à lancer UNE SEULE FOIS pour initialiser le champ `salesCount`
// à 0 pour les produits qui n'en ont pas encore.
//
// Utilisation :
//   cd server
//   node scripts/initSalesCount.js

import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Product from '../models/Product.js';

// [FIX] Erreur "querySrv ETIMEOUT" : résolution DNS via Google
dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
    try {
        console.log('📊 Initialisation salesCount pour les produits sans champ...\n');
        
        console.log('🔌 Connexion à MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté.\n');

        const result = await Product.updateMany(
            { salesCount: { $exists: false } },
            { $set: { salesCount: 0 } }
        );

        console.log(`✅ ${result.modifiedCount} produit(s) initialisé(s) avec salesCount = 0`);
        console.log(`ℹ️  ${result.matchedCount} produit(s) vérifié(s)`);

        await mongoose.disconnect();
        console.log('\n🔌 Déconnecté. Terminé.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    }
};

run();