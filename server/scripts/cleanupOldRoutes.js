import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

const run = async () => {
    console.log('🔍 Vérification des routes obsolètes...');

    const routesDir = path.join(__dirname, '../routes');
    const files = fs.readdirSync(routesDir);

    const obsoleteFiles = [
        'productRoute.js',
        'orderRoute.js',
        'bannerRoute.js',
        'categoryRoute.js',
        'couponRoute.js',
        'deliveryRoute.js',
        'locationRoute.js',
        'userRoute.js',
        'settingRoute.js',
        'questionnaireRoute.js',
        'boutiqueRoute.js',
        'metricsRoute.js',
        'sellerRoute.js',
        'staffRoute.js',
    ];

    const obsoleteFound = obsoleteFiles.filter(f => files.includes(f));

    if (obsoleteFound.length === 0) {
        console.log('✅ Aucune route obsolète trouvée.');
        process.exit(0);
    }

    console.log(`⚠️ Routes obsolètes trouvées (${obsoleteFound.length}) :`);
    obsoleteFound.forEach(f => console.log(`   - ${f}`));
    console.log('');
    console.log('📝 Ces routes sont maintenant redondantes car leurs endpoints');
    console.log('   sont exposés via /api/admin/... avec permissions granulaires.');
    console.log('');
    console.log('💡 Vous pouvez les supprimer manuellement une fois que vous avez');
    console.log('   vérifié que toutes les fonctionnalités fonctionnent avec le nouveau routeur.');
    console.log('');
    console.log('   Pour les supprimer :');
    console.log('   rm routes/productRoute.js routes/orderRoute.js ...');
    console.log('');
    console.log('   Puis supprimez les imports correspondants dans server.js.');

    process.exit(0);
};

run();