// server/scripts/migrateSalesCount.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

dotenv.config();

const migrateSalesCount = async () => {
    try {
        console.log('📊 Début de la migration salesCount...');
        
        // ✅ 1. Connexion à MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté à MongoDB');
        
        // ✅ 2. Récupérer TOUTES les commandes
        const orders = await Order.find({});
        console.log(`📦 ${orders.length} commandes trouvées`);
        
        // ✅ 3. Calculer les ventes par produit
        const salesMap = new Map();
        
        for (const order of orders) {
            if (order.items && order.items.length > 0) {
                for (const item of order.items) {
                    const productId = item.product?.toString();
                    if (productId) {
                        const quantity = item.quantity || 1;
                        salesMap.set(
                            productId,
                            (salesMap.get(productId) || 0) + quantity
                        );
                    }
                }
            }
        }
        
        console.log(`📊 ${salesMap.size} produits ont des ventes`);
        
        // ✅ 4. Mettre à jour chaque produit
        let updatedCount = 0;
        for (const [productId, salesCount] of salesMap) {
            const result = await Product.findByIdAndUpdate(
                productId,
                { salesCount: salesCount },
                { new: true }
            );
            
            if (result) {
                updatedCount++;
                console.log(`  ✅ ${result.name} → ${salesCount} ventes`);
            }
        }
        
        // ✅ 5. Vérifier les produits sans ventes
        const productsWithoutSales = await Product.find({
            salesCount: { $exists: false }
        });
        
        if (productsWithoutSales.length > 0) {
            console.log(`📦 ${productsWithoutSales.length} produits sans champ salesCount`);
            
            for (const product of productsWithoutSales) {
                product.salesCount = 0;
                await product.save();
                console.log(`  ✅ ${product.name} → 0 ventes (initialisé)`);
            }
        }
        
        console.log(`🎉 Migration terminée ! ${updatedCount} produits mis à jour.`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        process.exit(1);
    }
};

migrateSalesCount();