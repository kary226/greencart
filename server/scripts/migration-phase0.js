import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';

// Même contournement DNS que createFirstAdmin.js pour les URI mongodb+srv://
dns.setServers(['8.8.8.8', '8.8.4.4']);

import WalletTransaction from '../models/WalletTransaction.js';

const run = async () => {
    try {
        console.log('🔌 Connexion à MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté.\n');

        // Ajouter les champs manquants aux transactions existantes
        const result = await WalletTransaction.updateMany(
            { creePar: { $exists: false } },
            { $set: { creePar: null, idempotencyKey: null, motif: null } }
        );
        console.log(`✅ Champs creePar, idempotencyKey, motif ajoutés (${result.modifiedCount} documents modifiés).`);

        // Créer l'index unique partiel sur idempotencyKey (si pas déjà présent)
        await WalletTransaction.collection.createIndex(
            { walletId: 1, idempotencyKey: 1 },
            {
                unique: true,
                partialFilterExpression: { idempotencyKey: { $type: 'string' } },
                name: 'uniq_walletId_idempotencyKey',
            }
        );
        console.log('✅ Index d\'idempotence créé.');

        console.log('✅ Migration Phase 0 terminée avec succès.');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur migration:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

run();