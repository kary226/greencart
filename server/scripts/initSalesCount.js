// server/scripts/initSalesCount.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';

dotenv.config();

const initSalesCount = async () => {
    try {
        console.log('📊 Initialisation salesCount pour tous les produits...');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté à MongoDB');
        
        // ✅ Ajouter salesCount à tous les produits qui en sont dépourvus
        const result = await Product.updateMany(
            { salesCount: { $exists: false } },
            { $set: { salesCount: 0 } }
        );
        
        console.log(`✅ ${result.modifiedCount} produits initialisés avec salesCount = 0`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
};

initSalesCount();