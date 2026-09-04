// Diagnostic en lecture seule — ne modifie rien.
//
// Vérifie, pour chaque compte staff de rôle "livreur", que le chemin réel
// (loadPermissions -> acteurDepuisStaff -> peutTransitionner) autorise bien
// la transition 'Collecting' (utilisée par reserverCollecte,
// reserverCollecteLivreur, collecterArticle, collecterArticleLivreur).
//
// Volontairement, ce script n'inspecte PAS juste StaffUser.permissions en
// base : il rejoue les mêmes fonctions que la requête HTTP réelle
// (server/middlewares/permission.js, authActeur.js,
// services/orderWorkflowService.js), pour détecter un problème de code
// (comme celui corrigé dans acteurDepuisStaff) et pas seulement un
// problème de données.
//
// Usage : node scripts/verifierPermissionsLivreurs.js

import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '8.8.4.4']);

import StaffUser from '../models/StaffUser.js';
import { loadPermissions } from '../middlewares/permission.js';
import { acteurDepuisStaff } from '../middlewares/authActeur.js';
import { peutTransitionner, DROITS_TRANSITION } from '../services/orderWorkflowService.js';

const CIBLE = 'Collecting';

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté.\n');
    console.log(`Permissions requises pour « ${CIBLE} » : ${DROITS_TRANSITION[CIBLE].join(' OU ')}\n`);

    const livreurs = await StaffUser.find({ role: 'livreur' }).select('-password -totpSecret');

    if (livreurs.length === 0) {
        console.log('Aucun compte de rôle "livreur" trouvé.');
        await mongoose.disconnect();
        return;
    }

    let echecs = 0;

    for (const staffUser of livreurs) {
        // Étape 1 : les mêmes permissions effectives que authStaff calculerait
        // pour une vraie requête de ce compte (custom -> RolePermission -> code).
        staffUser.permissions = await loadPermissions(staffUser);

        // Étape 2 : le même acteur normalisé que acteurDepuisRequete() produirait.
        const acteur = acteurDepuisStaff(staffUser);

        // Étape 3 : la même décision que transitionner()/transitionnerAtomique()
        // prendraient réellement pour ce compte.
        const autorise = peutTransitionner(acteur, CIBLE);

        const statut = autorise ? '✅' : '❌';
        if (!autorise) echecs++;

        console.log(
            `${statut} ${staffUser.nom} <${staffUser.email}> — statut: ${staffUser.statut} — ` +
            `permissions effectives: [${staffUser.permissions.join(', ') || 'aucune'}]`
        );
    }

    console.log(`\n${livreurs.length - echecs}/${livreurs.length} comptes livreur passent la vérification.`);

    if (echecs > 0) {
        console.log(
            `\n⚠️  ${echecs} compte(s) échoueraient sur reserverCollecte/collecterArticle. ` +
            `Corrige en donnant au rôle "livreur" la permission "deliveries.update_status" ` +
            `dans RolePermission (ou en ajoutant une permission sur mesure au compte).`
        );
    } else {
        console.log('\nTous les comptes livreur passent — le correctif de acteurDepuisStaff() suffit.');
    }

    await mongoose.disconnect();
};

run().catch((err) => {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
});