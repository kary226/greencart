// Script à lancer UNE SEULE FOIS pour corriger les descriptions produit
// stockées en tableau (bug du schéma : `description` était typé `Array`
// alors que tout le code — Quill, DOMPurify, l'API — traite ce champ comme
// une string HTML).
//
// Ce script ne fait que convertir `description` (tableau → string), il ne
// touche à aucune autre donnée (prix, images, stock, etc.).
//
// Utilisation :
//   cd server
//   node scripts/fixDescriptionType.js
//
// Peut être relancé sans risque plusieurs fois (idempotent) : les produits
// déjà en string ne sont pas modifiés.

import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Product from '../models/Product.js';

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
        if (Array.isArray(product.description)) {
            const before = product.description;
            product.description = product.description.join('\n');
            await product.save();

            fixedCount++;
            fixedList.push({
                id: product._id.toString(),
                name: product.name,
            });
        }
    }

    console.log('─────────────────────────────────────────');
    if (fixedCount === 0) {
        console.log('✅ Aucune description en tableau trouvée. Rien à corriger.');
    } else {
        console.log(`🛠️  ${fixedCount} produit(s) corrigé(s) :\n`);
        fixedList.forEach(p => {
            console.log(`- ${p.name} (${p.id})`);
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