// Script à lancer une seule fois, après le correctif du bug d'éligibilité
// du 07/09 : confirmerCommandeAdmin() marquait une commande comme
// "confirmée" (confirmeParAdminLe) AVANT de vérifier si l'argent avait
// vraiment été libéré. Résultat : dès que le réglage "Libération des
// fonds" (Paramètres) était autre chose que "Shipped", libererFonds()
// refusait silencieusement — la commande disparaissait de "Fonds à
// libérer" (déjà "confirmée"), mais 0 FCFA n'avait jamais atteint le
// commerçant.
//
// Ce script retrouve ces commandes précises (confirmées, mais sans aucune
// transaction "liberation" en base pour elles) et relance libererFonds()
// dessus — qui, avec le code corrigé, va cette fois réellement créditer
// le commerçant.
//
// Utilisation :
//   cd server
//   node scripts/rattraperFondsBloques.js --dry-run
//       → liste les commandes concernées et ce qui serait libéré, ne
//         touche à rien.
//
//   node scripts/rattraperFondsBloques.js
//       → demande une confirmation manuelle avant de libérer pour de vrai.
//
//   node scripts/rattraperFondsBloques.js --yes
//       → libère sans demander de confirmation.

import 'dotenv/config';
import dns from 'dns';
import readline from 'readline';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '8.8.4.4']);

import Order from '../models/Order.js';
import WalletTransaction from '../models/WalletTransaction.js';
import { libererFonds } from '../services/walletService.js';

const dryRun = process.argv.includes('--dry-run');
const skipConfirm = process.argv.includes('--yes');

const demanderConfirmation = (phrase) => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Tape exactement "${phrase}" pour confirmer : `, (reponse) => {
        rl.close();
        resolve(reponse.trim() === phrase);
    });
});

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté.\n');

    // Candidates : déjà marquées "confirmées" par l'Admin, avec au moins
    // un article de boutique (sinon rien à libérer de toute façon), mais
    // sans la moindre trace d'une libération réelle en base.
    const candidates = await Order.find({
        confirmeParAdminLe: { $ne: null },
        'items.boutiqueId': { $ne: null },
    }).select('_id amount items confirmeParAdminLe status');

    const bloquees = [];
    for (const order of candidates) {
        const dejaLibere = await WalletTransaction.exists({ orderId: order._id, type: 'liberation' });
        if (!dejaLibere) bloquees.push(order);
    }

    if (bloquees.length === 0) {
        console.log('Aucune commande bloquée trouvée — rien à faire.');
        await mongoose.disconnect();
        return;
    }

    console.log(`${bloquees.length} commande(s) marquée(s) "confirmée" sans aucun fonds jamais libéré :\n`);
    for (const o of bloquees) {
        console.log(`  #${o._id.toString().slice(-8).toUpperCase()} — ${o.amount} FCFA — statut: ${o.status} — confirmée le ${o.confirmeParAdminLe.toLocaleString('fr-FR')}`);
    }

    if (dryRun) {
        console.log('\n(--dry-run : rien n\'a été libéré.)');
        await mongoose.disconnect();
        return;
    }

    if (!skipConfirm) {
        const ok = await demanderConfirmation('LIBERER LES FONDS');
        if (!ok) {
            console.log('Annulé.');
            await mongoose.disconnect();
            return;
        }
    }

    console.log('\nLibération en cours...\n');
    let totalLibere = 0;
    for (const order of bloquees) {
        const resultat = await libererFonds(order);
        if (resultat.blocked) {
            console.log(`  ⚠️  #${order._id.toString().slice(-8).toUpperCase()} — toujours bloquée : ${resultat.reason}`);
        } else {
            console.log(`  ✅ #${order._id.toString().slice(-8).toUpperCase()} — ${resultat.liberees} boutique(s), ${resultat.montantTotal} FCFA libérés`);
            totalLibere += resultat.montantTotal;
        }
    }

    console.log(`\nTotal libéré : ${totalLibere} FCFA.`);
    await mongoose.disconnect();
};

run().catch((err) => {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
});