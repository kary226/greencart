// Diagnostic en lecture seule — ne modifie rien.
// Affiche la valeur brute de `description` telle que stockée en base,
// en contournant le casting du schéma Mongoose (accès driver natif).

import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté.\n');

    const raw = await mongoose.connection.db
        .collection('products')
        .find({})
        .limit(5)
        .toArray();

    raw.forEach(p => {
        console.log('─────────────────────────────');
        console.log('Nom:', p.name);
        console.log('Type de description:', Array.isArray(p.description) ? 'Array' : typeof p.description);
        console.log('Longueur:', p.description?.length);
        console.log('Aperçu:', JSON.stringify(p.description).slice(0, 200));
    });

    await mongoose.disconnect();
    process.exit(0);
};

run().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});