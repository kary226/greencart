// Récupération d'un accès 2FA perdu (téléphone changé, application
// d'authentification effacée, QR code jamais sauvegardé).
//
// Le secret TOTP n'est PAS perdu quand l'application l'est : pour un compte
// staff il vit en base (StaffUser.totpSecret), pour le compte vendeur
// historique il vit dans SELLER_TOTP_SECRET (.env). Ce script le relit et
// réaffiche de quoi le réinstaller — il ne « casse » rien au passage.
//
// ⚠️  Ce script AFFICHE des secrets 2FA en clair dans le terminal. À lancer
//    sur votre machine uniquement, jamais dans un log partagé, une capture
//    d'écran ou un ticket. Videz l'historique du terminal ensuite.
//
// Utilisation :
//   cd server
//   node scripts/recuperer2FA.js                      → liste les comptes staff
//   node scripts/recuperer2FA.js seller               → compte vendeur (.env)
//   node scripts/recuperer2FA.js admin@ramci.ci       → réaffiche le secret existant
//   node scripts/recuperer2FA.js admin@ramci.ci --reset → génère un NOUVEAU secret
//   node scripts/recuperer2FA.js seller --reset        → propose un nouveau secret vendeur
//
// --reset invalide l'ancien secret : à n'utiliser que si le secret existant
// a fuité, ou s'il est introuvable (compte sans totpSecret).

import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { authenticator } from 'otplib';
import StaffUser from '../models/StaffUser.js';

// Même contournement DNS que les autres scripts du projet, pour les URI
// mongodb+srv:// qui échouent parfois à résoudre leur SRV en local.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const SERVICE = 'GreenCart';

// Tout ce dont une application d'authentification a besoin, présenté des
// deux façons : le lien otpauth:// (à convertir en QR code) et la clé à
// saisir à la main, qui marche partout sans QR.
const afficherInstallation = (label, secret) => {
    const otpauthUrl = authenticator.keyuri(label, SERVICE, secret);

    console.log('\n─────────────────────────────────────────────────────────');
    console.log(`  Compte : ${label}`);
    console.log('─────────────────────────────────────────────────────────');
    console.log('\n  Clé de configuration (saisie manuelle) :\n');
    console.log(`      ${secret}\n`);
    console.log('  Lien otpauth (à transformer en QR code si besoin) :\n');
    console.log(`      ${otpauthUrl}\n`);
    console.log('  Dans Google Authenticator / Authy :');
    console.log('      Ajouter un compte → « Saisir une clé de configuration »');
    console.log(`      Nom du compte : ${label}`);
    console.log('      Clé : celle ci-dessus');
    console.log('      Type : basé sur le temps (Time-based)\n');
    console.log(`  Code valable à cet instant : ${authenticator.generate(secret)}`);
    console.log('  (il change toutes les 30 s — vérifiez que votre application affiche le même)\n');
};

const run = async () => {
    const [, , cible, ...options] = process.argv;
    const reset = options.includes('--reset');

    // ---- Compte vendeur historique : secret dans le .env ----
    if (cible === 'seller') {
        // --reset : on ne touche PAS au .env à votre place. Un secret vendeur
        // vit à deux endroits (le .env local et les variables Vercel) et le
        // script n'en voit qu'un : le remplacer tout seul créerait un site en
        // ligne dont le code 2FA ne correspond plus à rien. On propose donc la
        // valeur, vous la collez aux deux endroits.
        if (reset) {
            const nouveauSecret = authenticator.generateSecret();
            console.log("♻️  Nouveau secret vendeur généré. Il ne sera actif qu'une fois");
            console.log('    collé dans SELLER_TOTP_SECRET, puis le serveur redémarré.\n');
            console.log('    À remplacer à DEUX endroits :');
            console.log('      1. server/.env                              (serveur local)');
            console.log('      2. Vercel → Settings → Environment Variables (site en ligne)');
            console.log('\n    SELLER_TOTP_SECRET=' + nouveauSecret);
            afficherInstallation(process.env.SELLER_EMAIL || 'seller', nouveauSecret);
            console.log("  ⚠️  Le code ci-dessus ne fonctionnera qu'APRÈS la mise à jour des");
            console.log("     variables et le redémarrage. L'ancien secret reste valable");
            console.log("     tant que vous ne l'avez pas remplacé.\n");
            process.exit(0);
        }

        const secret = process.env.SELLER_TOTP_SECRET;
        if (!secret) {
            console.log('❌ SELLER_TOTP_SECRET est absent du .env — impossible de récupérer ce secret.');
            console.log('   Il faut en générer un nouveau, le mettre dans le .env ET dans les');
            console.log('   variables d\'environnement de production, puis le rescanner :');
            console.log(`\n   Nouveau secret proposé : ${authenticator.generateSecret()}\n`);
            process.exit(1);
        }
        afficherInstallation(process.env.SELLER_EMAIL || 'seller', secret);
        console.log('  ℹ️  Ce secret vient du .env LOCAL. Si le site en production a été');
        console.log('     déployé avec une autre valeur de SELLER_TOTP_SECRET, c\'est celle');
        console.log('     de Vercel qui fait foi pour se connecter au site en ligne.\n');
        process.exit(0);
    }

    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté.\n');

    // ---- Sans argument : lister les comptes staff ----
    if (!cible) {
        const comptes = await StaffUser.find().select('email nom role statut totpSecret').sort('role').lean();

        if (comptes.length === 0) {
            console.log('Aucun compte staff en base. Créez le premier admin :');
            console.log('   node scripts/createFirstAdmin.js <email> "<mot de passe>" "<nom>"\n');
        } else {
            console.log(`${comptes.length} compte(s) staff :\n`);
            for (const c of comptes) {
                const secret2FA = c.totpSecret ? '2FA configurée' : '⚠️  aucun secret 2FA';
                console.log(`   ${c.email}`);
                console.log(`      ${c.nom} · ${c.role} · ${c.statut} · ${secret2FA}`);
            }
            console.log('\nPour réinstaller la 2FA d\'un compte :');
            console.log('   node scripts/recuperer2FA.js <email>\n');
        }

        console.log('Pour le compte vendeur historique (secret dans le .env) :');
        console.log('   node scripts/recuperer2FA.js seller\n');

        await mongoose.disconnect();
        process.exit(0);
    }

    // ---- Un compte staff précis ----
    const email = cible.trim().toLowerCase();
    const staffUser = await StaffUser.findOne({ email });

    if (!staffUser) {
        console.log(`❌ Aucun compte staff avec l'email « ${email} ».`);
        console.log('   Lancez le script sans argument pour voir la liste des comptes.\n');
        await mongoose.disconnect();
        process.exit(1);
    }

    if (staffUser.statut !== 'actif') {
        console.log(`⚠️  Ce compte est « ${staffUser.statut} » : la 2FA sera réinstallée, mais`);
        console.log('   la connexion restera refusée tant qu\'il n\'est pas repassé « actif ».\n');
    }

    let secret = staffUser.totpSecret;

    if (reset || !secret) {
        if (!secret) {
            console.log('ℹ️  Ce compte n\'avait aucun secret 2FA enregistré — génération d\'un nouveau.');
        } else {
            console.log('♻️  --reset : l\'ancien secret est remplacé, il ne fonctionnera plus.');
        }
        secret = authenticator.generateSecret();
        staffUser.totpSecret = secret;
        await staffUser.save();
        console.log('✅ Nouveau secret enregistré en base.');
    } else {
        console.log('ℹ️  Secret existant réaffiché — vos anciens appareils continuent de marcher.');
        console.log('   (utilisez --reset seulement si vous voulez invalider l\'ancien)');
    }

    afficherInstallation(staffUser.email, secret);

    await mongoose.disconnect();
    process.exit(0);
};

run().catch(async (error) => {
    console.error('❌ Erreur :', error.message);
    try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
    process.exit(1);
});
