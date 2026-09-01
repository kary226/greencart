import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

// Contournement DNS pour mongodb+srv://
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();

import RolePermission from '../models/RolePermission.js';
import StaffUser from '../models/StaffUser.js';
import { tablePermissions, ROLES, libelleDuRole } from '../configs/roles.js';

/**
 * SEED DES PERMISSIONS  —  Guide RAMCI §3, §16, §17
 * =================================================
 *
 * La table des permissions n'est plus recopiée ici : elle vient de
 * configs/roles.js, source unique. Ce script ne fait que la projeter en base.
 * Avant, ce fichier ET assignPermissions.js ET seedWarehouseRoles.js
 * portaient chacun leur propre version de la vérité — et divergeaient.
 *
 * DEUX DIFFÉRENCES IMPORTANTES avec la version précédente :
 *
 *   1. Plus de `deleteMany({})`. Effacer toutes les permissions avant de les
 *      réécrire laissait une fenêtre — courte, mais réelle — où TOUS les
 *      comptes staff se retrouvaient sans aucun droit. Sur une base en
 *      production, c'est une coupure de service. On fait désormais un upsert
 *      rôle par rôle.
 *
 *   2. Mode « aperçu » par défaut. Le script affiche ce qu'il changerait et
 *      ne touche à rien sans `--appliquer`. Le §17 insiste : « ne pas tout
 *      modifier d'un coup, chaque phase doit être testée avant la suivante ».
 *
 * Usage :
 *   node scripts/seedRolePermissions.js              # aperçu, aucune écriture
 *   node scripts/seedRolePermissions.js --appliquer  # écrit en base
 */

const APPLIQUER = process.argv.includes('--appliquer');

const memeContenu = (a = [], b = []) =>
    a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

const run = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI absent — rien à faire.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`Connexion MongoDB OK — mode ${APPLIQUER ? 'ÉCRITURE' : 'APERÇU (aucune écriture)'}\n`);

        const cible = tablePermissions();
        const existantes = await RolePermission.find({}).lean();
        const parRole = new Map(existantes.map((r) => [r.role, r.permissions || []]));

        let crees = 0;
        let modifies = 0;
        let inchanges = 0;

        for (const [role, permissions] of Object.entries(cible)) {
            const actuelles = parRole.get(role);

            if (!actuelles) {
                console.log(`+ ${role.padEnd(20)} ${libelleDuRole(role).padEnd(18)} ${permissions.length} permissions (nouveau)`);
                if (APPLIQUER) await RolePermission.create({ role, permissions });
                crees += 1;
                continue;
            }

            if (memeContenu(actuelles, permissions)) {
                inchanges += 1;
                continue;
            }

            const ajoutees = permissions.filter((p) => !actuelles.includes(p));
            const retirees = actuelles.filter((p) => !permissions.includes(p));
            console.log(`~ ${role.padEnd(20)} ${libelleDuRole(role).padEnd(18)} +${ajoutees.length} / -${retirees.length}`);
            if (ajoutees.length) console.log(`    ajoutées : ${ajoutees.join(', ')}`);
            if (retirees.length) console.log(`    retirées : ${retirees.join(', ')}`);

            if (APPLIQUER) {
                await RolePermission.updateOne({ role }, { $set: { permissions } });
            }
            modifies += 1;
        }

        // Rôles présents en base mais absents du code : signalés, JAMAIS
        // supprimés automatiquement. Des comptes les portent peut-être.
        const orphelins = existantes.filter((r) => !(r.role in cible));
        for (const orphelin of orphelins) {
            const comptes = await StaffUser.countDocuments({ role: orphelin.role });
            console.log(`! ${orphelin.role.padEnd(20)} inconnu du code — ${comptes} compte(s) concerné(s). À traiter à la main.`);
        }

        console.log(`\n${crees} créé(s), ${modifies} modifié(s), ${inchanges} inchangé(s).`);

        // Comptes portant un rôle déprécié (§17.2, migration progressive).
        const deprecies = Object.entries(ROLES).filter(([, r]) => r.deprecie);
        for (const [role, def] of deprecies) {
            const comptes = await StaffUser.countDocuments({ role });
            if (comptes > 0) {
                console.log(`  → ${comptes} compte(s) « ${role} » à migrer vers « ${def.deprecie} » (scripts/migrerRolesRamci.js)`);
            }
        }

        if (!APPLIQUER) {
            console.log('\nAperçu uniquement. Relancez avec --appliquer pour écrire en base.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Erreur seed :', error);
        process.exit(1);
    }
};

run();
