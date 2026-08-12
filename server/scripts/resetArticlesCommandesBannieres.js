// Script à lancer manuellement pour SUPPRIMER TOUS les articles (produits),
// TOUTES les commandes clients et TOUTES les bannières du site — aussi bien
// dans MongoDB que dans Cloudinary.
//
// ✅ Les CATÉGORIES sont explicitement préservées (ni MongoDB, ni Cloudinary,
//    dossier "categories" jamais touché).
//
// ⚠️  DESTRUCTEUR ET IRRÉVERSIBLE. Aucune sauvegarde n'est faite par ce
// script. Si tu as un doute, fais un dump Mongo avant (mongodump) ou lance
// d'abord en mode --dry-run.
//
// Utilisation :
//   cd server
//   node scripts/resetArticlesCommandesBannieres.js --dry-run
//       → affiche seulement les compteurs (Mongo + Cloudinary), ne supprime rien.
//
//   node scripts/resetArticlesCommandesBannieres.js
//       → demande une confirmation manuelle (retaper une phrase exacte)
//         avant de supprimer.
//
//   node scripts/resetArticlesCommandesBannieres.js --yes
//       → supprime sans demander de confirmation (utile en script/CI,
//         mais à manier avec précaution).
//
//   Ajoute --with-refs pour aussi nettoyer les documents liés qui
//   deviendraient orphelins sinon :
//     - Review             (pointe vers productId)
//     - WalletTransaction  (pointe vers orderId)
//     - User.wishlist / User.cartItems (pointent vers des produits)
//   Sans ce flag, ces collections/champs ne sont PAS touchés — ils
//   contiendront juste des références vers des documents qui n'existent plus.
//
// Ce qui est supprimé :
//   MongoDB   → Order (tout), Product (tout), Banner (tout)
//   Cloudinary→ dossier "products/images/" (resource_type: image)
//               dossier "products/videos/" (resource_type: video)
//               dossier "banners/"         (resource_type: image)
//
// Ce qui est PRÉSERVÉ :
//   MongoDB   → Category (rien n'est touché)
//   Cloudinary→ dossier "categories/" (jamais touché)

import 'dotenv/config';
import dns from 'dns';
import readline from 'readline';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Banner from '../models/Banner.js';
import Review from '../models/Review.js';
import WalletTransaction from '../models/WalletTransaction.js';
import User from '../models/User.js';

// [FIX] Erreur "querySrv ETIMEOUT" : résolution DNS via Google
dns.setServers(['8.8.8.8', '8.8.4.4']);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipConfirm = args.includes('--yes');
const withRefs = args.includes('--with-refs');

const PHRASE_CONFIRMATION = 'SUPPRIMER TOUT';

// Dossiers Cloudinary concernés (jamais "categories/")
const CLOUDINARY_TARGETS = [
    { label: 'Images produits', prefix: 'products/images/', resource_type: 'image' },
    { label: 'Vidéos produits', prefix: 'products/videos/', resource_type: 'video' },
    { label: 'Bannières', prefix: 'banners/', resource_type: 'image' },
];

const connectCloudinary = () => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
};

// Compte (approximativement, jusqu'à 500) le nombre de ressources sous un préfixe.
// L'Admin API ne renvoie pas de total exact sans paginer entièrement ; 500 est
// suffisant pour donner une idée fiable en dry-run sans multiplier les appels.
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

// Supprime toutes les ressources sous un préfixe (par lots gérés en interne
// par le SDK Cloudinary via delete_resources_by_prefix).
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

// Tente de supprimer le dossier vide restant (échoue silencieusement si non vide
// ou si Cloudinary ne le permet pas — sans conséquence).
const supprimerDossierVide = async (prefix) => {
    const folder = prefix.replace(/\/$/, '');
    try {
        await cloudinary.api.delete_folder(folder);
    } catch (_) {
        // Non bloquant : le dossier peut ne pas être vide (ex: sous-dossiers) ou déjà absent.
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
            : '🗑️  Suppression des articles, commandes et bannières (Mongo + Cloudinary).\n');

        console.log('🔌 Connexion à MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté à MongoDB.\n');

        connectCloudinary();

        const nbCommandes = await Order.countDocuments();
        const nbArticles = await Product.countDocuments();
        const nbBannieres = await Banner.countDocuments();
        const nbAvis = await Review.countDocuments();
        const nbTransactions = await WalletTransaction.countDocuments({ orderId: { $ne: null } });
        const nbWishlists = await User.countDocuments({ 'wishlist.0': { $exists: true } });
        const nbPaniers = await User.countDocuments({ cartItems: { $ne: {} } });

        console.log('📊 État actuel de la base MongoDB :');
        console.log(`   - Commandes (Order)                 : ${nbCommandes}`);
        console.log(`   - Articles (Product)                : ${nbArticles}`);
        console.log(`   - Bannières (Banner)                : ${nbBannieres}`);
        console.log(`   - Avis produits (Review)             : ${nbAvis}${withRefs ? '' : '  [conservés]'}`);
        console.log(`   - Transactions liées à une commande  : ${nbTransactions}${withRefs ? '' : '  [conservées]'}`);
        console.log(`   - Utilisateurs avec wishlist         : ${nbWishlists}${withRefs ? '' : '  [conservée]'}`);
        console.log(`   - Utilisateurs avec panier rempli    : ${nbPaniers}${withRefs ? '' : '  [conservé]'}`);
        console.log('   - Catégories (Category)              : PRÉSERVÉES, non comptées, non touchées\n');

        console.log('☁️  État actuel sur Cloudinary (estimation, max 500 affichés) :');
        for (const target of CLOUDINARY_TARGETS) {
            const count = await compterRessources(target.prefix, target.resource_type);
            console.log(`   - ${target.label.padEnd(20)} (${target.prefix.padEnd(18)}) : ${count}`);
        }
        console.log('   - Catégories (categories/)              : PRÉSERVÉES, jamais touchées\n');

        if (!withRefs && (nbAvis > 0 || nbTransactions > 0 || nbWishlists > 0 || nbPaniers > 0)) {
            console.log('ℹ️  --with-refs n\'est pas activé : ces éléments référenceront des');
            console.log('   commandes/articles supprimés une fois l\'opération terminée.\n');
        }

        if (dryRun) {
            await mongoose.disconnect();
            console.log('🔌 Déconnecté. Dry-run terminé, aucune suppression effectuée.');
            process.exit(0);
        }

        if (nbCommandes === 0 && nbArticles === 0 && nbBannieres === 0) {
            console.log('ℹ️  Rien à supprimer, Commandes/Articles/Bannières sont déjà vides.');
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

        const resOrders = await Order.deleteMany({});
        console.log(`   ✅ ${resOrders.deletedCount} commande(s) supprimée(s)`);

        const resProducts = await Product.deleteMany({});
        console.log(`   ✅ ${resProducts.deletedCount} article(s) supprimé(s)`);

        const resBanners = await Banner.deleteMany({});
        console.log(`   ✅ ${resBanners.deletedCount} bannière(s) supprimée(s)`);

        if (withRefs) {
            const resReviews = await Review.deleteMany({});
            console.log(`   ✅ ${resReviews.deletedCount} avis supprimé(s)`);

            const resTx = await WalletTransaction.deleteMany({ orderId: { $ne: null } });
            console.log(`   ✅ ${resTx.deletedCount} transaction(s) liée(s) à une commande supprimée(s)`);

            const resUsers = await User.updateMany(
                {},
                { $set: { wishlist: [], cartItems: {} } }
            );
            console.log(`   ✅ ${resUsers.modifiedCount} utilisateur(s) nettoyé(s) (wishlist + panier)`);
        }

        console.log('\n☁️  Suppression en cours (Cloudinary)...');
        for (const target of CLOUDINARY_TARGETS) {
            const deleted = await supprimerRessources(target.prefix, target.resource_type);
            console.log(`   ✅ ${target.label} : ${deleted} ressource(s) supprimée(s) (${target.prefix})`);
            await supprimerDossierVide(target.prefix);
        }
        console.log('   ℹ️  Dossier "categories/" non touché.');

        await mongoose.disconnect();
        console.log('\n🔌 Déconnecté. Terminé.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    }
};

run();