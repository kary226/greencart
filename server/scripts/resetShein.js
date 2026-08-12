// Script à lancer manuellement pour SUPPRIMER TOUT ce qui concerne le module
// ColisShein — colis clients, messages du chat (+ captures/images) — aussi
// bien dans MongoDB que dans Cloudinary.
//
// Ne touche PAS aux Produits, Commandes, Bannières, Catégories ni aux autres
// modules du site (ce script est dédié uniquement à ColisShein).
//
// ⚠️  DESTRUCTEUR ET IRRÉVERSIBLE. Aucune sauvegarde n'est faite par ce
// script. Si tu as un doute, fais un dump Mongo avant (mongodump) ou lance
// d'abord en mode --dry-run.
//
// Utilisation :
//   cd server
//   node scripts/resetShein.js --dry-run
//       → affiche seulement les compteurs (Mongo + Cloudinary), ne supprime rien.
//
//   node scripts/resetShein.js
//       → demande une confirmation manuelle (retaper une phrase exacte)
//         avant de supprimer.
//
//   node scripts/resetShein.js --yes
//       → supprime sans demander de confirmation (utile en script/CI,
//         mais à manier avec précaution).
//
// Ce qui est supprimé :
//   MongoDB   → ColisShein (tout), MessageColis (tout)
//   Cloudinary→ dossier "shein-carts/" (captures de paniers Shein, resource_type: image)
//               dossier "shein-chat/"  (images échangées dans le chat, resource_type: image)
//
// Ce qui est PRÉSERVÉ :
//   Tout le reste (Product, Order, Banner, Category, User, Wallet, etc.)

import 'dotenv/config';
import dns from 'dns';
import readline from 'readline';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import ColisShein from '../models/ColisShein.js';
import MessageColis from '../models/MessageColis.js';

// [FIX] Erreur "querySrv ETIMEOUT" : résolution DNS via Google
dns.setServers(['8.8.8.8', '8.8.4.4']);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipConfirm = args.includes('--yes');

const PHRASE_CONFIRMATION = 'SUPPRIMER SHEIN';

// Dossiers Cloudinary concernés par le module ColisShein
const CLOUDINARY_TARGETS = [
    { label: 'Captures paniers Shein', prefix: 'shein-carts/', resource_type: 'image' },
    { label: 'Images du chat Shein', prefix: 'shein-chat/', resource_type: 'image' },
];

const connectCloudinary = () => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
};

// Compte (approximativement, jusqu'à 500) le nombre de ressources sous un préfixe.
const compterRessources = async (prefix, resource_type) => {
    try {
        const res = await cloudinary.api.resources({
            type: 'upload',
            resource_type,
            prefix,
            max_results: 500,
        });
        const count = res.resources.length;
        return res.next_cursor ? `${count}+ (plus de 500)` : `${count}`;
    } catch (error) {
        return `? (erreur: ${error.message})`;
    }
};

const supprimerRessources = async (prefix, resource_type) => {
    try {
        const result = await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type });
        const deleted = Object.keys(result.deleted || {}).length;
        return deleted;
    } catch (error) {
        console.error(`   ❌ Erreur suppression Cloudinary (${prefix}) :`, error.message);
        return 0;
    }
};

const supprimerDossierVide = async (prefix) => {
    const folder = prefix.replace(/\/$/, '');
    try {
        await cloudinary.api.delete_folder(folder);
    } catch (_) {
        // Non bloquant : le dossier peut ne pas être vide ou déjà absent.
    }
};

const demanderConfirmation = () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(
            `\n⚠️  Pour confirmer, retape exactement : ${PHRASE_CONFIRMATION}\n> `,
            (reponse) => {
                rl.close();
                resolve(reponse.trim() === PHRASE_CONFIRMATION);
            }
        );
    });
};

const run = async () => {
    try {
        console.log(dryRun
            ? '🔍 Mode --dry-run : rien ne sera supprimé.\n'
            : '🗑️  Suppression du module ColisShein (Mongo + Cloudinary).\n');

        console.log('🔌 Connexion à MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté à MongoDB.\n');

        connectCloudinary();

        const nbColis = await ColisShein.countDocuments();
        const nbMessages = await MessageColis.countDocuments();
        const nbColisAvecCaptures = await ColisShein.countDocuments({ 'captures.0': { $exists: true } });

        console.log('📊 État actuel de la base MongoDB :');
        console.log(`   - Colis Shein (ColisShein)           : ${nbColis}`);
        console.log(`   - Messages du chat (MessageColis)    : ${nbMessages}`);
        console.log(`   - Colis avec captures d'écran        : ${nbColisAvecCaptures}\n`);

        console.log('☁️  État actuel sur Cloudinary (estimation, max 500 affichés) :');
        for (const target of CLOUDINARY_TARGETS) {
            const count = await compterRessources(target.prefix, target.resource_type);
            console.log(`   - ${target.label.padEnd(24)} (${target.prefix.padEnd(14)}) : ${count}`);
        }
        console.log('');

        if (dryRun) {
            await mongoose.disconnect();
            console.log('🔌 Déconnecté. Dry-run terminé, aucune suppression effectuée.');
            process.exit(0);
        }

        if (nbColis === 0 && nbMessages === 0) {
            console.log('ℹ️  Rien à supprimer, ColisShein/MessageColis sont déjà vides.');
            await mongoose.disconnect();
            process.exit(0);
        }

        if (!skipConfirm) {
            const confirme = await demanderConfirmation();
            if (!confirme) {
                console.log('\n❌ Confirmation invalide ou annulée. Aucune suppression effectuée.');
                await mongoose.disconnect();
                process.exit(0);
            }
        }

        console.log('\n🗑️  Suppression en cours (MongoDB)...');

        const resMessages = await MessageColis.deleteMany({});
        console.log(`   ✅ ${resMessages.deletedCount} message(s) de chat supprimé(s)`);

        const resColis = await ColisShein.deleteMany({});
        console.log(`   ✅ ${resColis.deletedCount} colis Shein supprimé(s)`);

        console.log('\n☁️  Suppression en cours (Cloudinary)...');
        for (const target of CLOUDINARY_TARGETS) {
            const deleted = await supprimerRessources(target.prefix, target.resource_type);
            console.log(`   ✅ ${target.label} : ${deleted} ressource(s) supprimée(s) (${target.prefix})`);
            await supprimerDossierVide(target.prefix);
        }

        await mongoose.disconnect();
        console.log('\n🔌 Déconnecté. Terminé.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    }
};

run();