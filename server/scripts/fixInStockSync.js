// Script à lancer UNE SEULE FOIS pour corriger les produits dont `inStock`
// est désynchronisé du stock réel (bug corrigé dans geniuspayController.js :
// le webhook de paiement mobile money décrémentait `stock` sans jamais
// recalculer `inStock`).
//
// Ce script ne fait que RECALCULER `inStock` à partir du stock réel, il ne
// touche à aucune autre donnée (prix, images, nom, etc.).
//
// Utilisation :
//   cd server
//   node scripts/fixInStockSync.js
//
// Peut être relancé sans risque plusieurs fois (idempotent) : les produits
// déjà corrects ne sont pas modifiés.

import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Product from '../models/Product.js';

// [FIX] Erreur "querySrv ETIMEOUT" : le DNS par défaut de Windows (souvent
// celui de la box/FAI) échoue parfois à résoudre l'enregistrement SRV requis
// par les URI "mongodb+srv://" de MongoDB Atlas. On force ici la résolution
// via le DNS public de Google, ce qui contourne le problème dans la grande
// majorité des cas. Ça n'affecte que ce script, pas le reste de l'app.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté.\n');

    const products = await Product.find({});
    console.log(`📦 ${products.length} produits trouvés. Vérification en cours...\n`);

    let fixedCount = 0;
    const fixedList = [];

    for (const product of products) {
        const hasVariants = product.variants && product.variants.length > 0;

        // Recalcul de la vraie valeur attendue pour inStock, à partir du
        // stock réel — exactement la même logique que dans
        // productController.js / orderController.js.
        const correctInStock = hasVariants
            ? product.variants.some(v => (v.stock || 0) > 0)
            : (product.stock || 0) > 0;

        if (product.inStock !== correctInStock) {
            const before = product.inStock;
            product.inStock = correctInStock;
            await product.save();

            fixedCount++;
            fixedList.push({
                id: product._id.toString(),
                name: product.name,
                stock: hasVariants
                    ? product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
                    : product.stock,
                inStockAvant: before,
                inStockApres: correctInStock,
            });
        }
    }

    console.log('─────────────────────────────────────────');
    if (fixedCount === 0) {
        console.log('✅ Aucun produit désynchronisé trouvé. Rien à corriger.');
    } else {
        console.log(`🛠️  ${fixedCount} produit(s) corrigé(s) :\n`);
        fixedList.forEach(p => {
            console.log(`- ${p.name} (stock réel: ${p.stock}) : inStock ${p.inStockAvant} → ${p.inStockApres}`);
        });
    }
    console.log('─────────────────────────────────────────');

    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté. Terminé.');
    process.exit(0);
};

run().catch((error) => {
    console.error('❌ Erreur pendant la correction :', error);
    process.exit(1);
});