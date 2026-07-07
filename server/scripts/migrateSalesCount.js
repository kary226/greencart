// Script à lancer UNE SEULE FOIS pour initialiser le champ `salesCount`
// de tous les produits à partir des commandes existantes.
//
// Utilisation :
//   cd server
//   node scripts/migrateSalesCount.js
//
// Peut être relancé sans risque (idempotent) : les produits déjà mis à jour
// ne sont pas modifiés.

import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

// [FIX] Erreur "querySrv ETIMEOUT" : le DNS par défaut échoue parfois
// à résoudre l'enregistrement SRV requis par les URI "mongodb+srv://".
// On force la résolution via le DNS public de Google.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
    try {
        console.log('📊 Début de la migration salesCount...\n');
        
        console.log('🔌 Connexion à MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté.\n');

        // ✅ 1. Récupérer TOUTES les commandes
        const orders = await Order.find({});
        console.log(`📦 ${orders.length} commandes trouvées.\n`);

        if (orders.length === 0) {
            console.log('⚠️ Aucune commande trouvée. Rien à migrer.');
            await mongoose.disconnect();
            process.exit(0);
        }

        // ✅ 2. Calculer les ventes par produit
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

        console.log(`📊 ${salesMap.size} produits ont des ventes.\n`);

        // ✅ 3. Mettre à jour chaque produit
        let updatedCount = 0;
        const updatedList = [];

        for (const [productId, salesCount] of salesMap) {
            const product = await Product.findById(productId);
            
            if (product) {
                const before = product.salesCount || 0;
                
                if (product.salesCount !== salesCount) {
                    product.salesCount = salesCount;
                    await product.save();
                    
                    updatedCount++;
                    updatedList.push({
                        name: product.name || productId,
                        salesAvant: before,
                        salesApres: salesCount
                    });
                }
            }
        }

        // ✅ 4. Initialiser les produits sans ventes (salesCount = 0)
        const productsWithoutSales = await Product.find({
            salesCount: { $exists: false }
        });

        if (productsWithoutSales.length > 0) {
            console.log(`📦 ${productsWithoutSales.length} produits sans champ salesCount. Initialisation...`);
            
            for (const product of productsWithoutSales) {
                product.salesCount = 0;
                await product.save();
            }
            console.log(`✅ ${productsWithoutSales.length} produits initialisés à 0.\n`);
        }

        // ✅ 5. Afficher le résumé
        console.log('─────────────────────────────────────────');
        if (updatedCount === 0) {
            console.log('✅ Aucun produit à mettre à jour. Les ventes sont déjà à jour.');
        } else {
            console.log(`🛠️  ${updatedCount} produit(s) mis à jour :\n`);
            updatedList.forEach(p => {
                console.log(`- ${p.name} : ventes ${p.salesAvant} → ${p.salesApres}`);
            });
        }
        console.log('─────────────────────────────────────────');

        await mongoose.disconnect();
        console.log('\n🔌 Déconnecté. Terminé.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur pendant la migration :', error.message);
        if (error.stack) {
            console.error('📚 Stack:', error.stack);
        }
        process.exit(1);
    }
};

run();