import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

import StaffUser from '../models/StaffUser.js';
import RolePermission from '../models/RolePermission.js';
import { ROLES, libelleDuRole, permissionsDuRole } from '../configs/roles.js';

/**
 * MIGRATION DES RÔLES  —  Guide RAMCI §17
 * =======================================
 * « Ne pas tout modifier d'un coup. Chaque phase doit être testée avant la
 * suivante. » Ce script suit cette consigne à la lettre :
 *
 *   - il n'écrit RIEN sans `--appliquer` ;
 *   - il migre UN rôle à la fois, pas tout le monde ;
 *   - il refuse de toucher aux comptes portant des permissions sur mesure,
 *     qu'une migration de rôle écraserait silencieusement.
 *
 * Ce qu'il fait : bascule les comptes d'un rôle déprécié vers son
 * remplaçant (§3) —
 *   warehouse_admin  → operations_admin
 *   logistics_admin  → operations_admin
 *   admin            → super_admin
 *
 * ATTENTION sur `admin` → `super_admin` : les deux ont `admin.all`, donc
 * aucun droit ne change. Ce n'est qu'un renommage, mais il touche le compte
 * le plus puissant du système — d'où sa présence en dernier, et son
 * exclusion de `--tout`.
 *
 * Usage :
 *   node scripts/migrerRolesRamci.js                                  # état des lieux
 *   node scripts/migrerRolesRamci.js --role warehouse_admin           # aperçu d'un rôle
 *   node scripts/migrerRolesRamci.js --role warehouse_admin --appliquer
 */

const args = process.argv.slice(2);
const APPLIQUER = args.includes('--appliquer');
const roleIndex = args.indexOf('--role');
const ROLE_CIBLE = roleIndex >= 0 ? args[roleIndex + 1] : null;

/** Rôles dépréciés et leur remplaçant, lus depuis la source unique. */
const MIGRATIONS = Object.entries(ROLES)
    .filter(([, def]) => def.deprecie)
    .map(([depuis, def]) => ({ depuis, vers: def.deprecie }));

const etatDesLieux = async () => {
    console.log('État des lieux des comptes staff\n');

    const parRole = await StaffUser.aggregate([
        { $group: { _id: '$role', total: { $sum: 1 }, actifs: { $sum: { $cond: [{ $eq: ['$statut', 'actif'] }, 1, 0] } } } },
        { $sort: { total: -1 } },
    ]);

    for (const ligne of parRole) {
        const def = ROLES[ligne._id];
        const marque = def?.deprecie ? `  → à migrer vers « ${def.deprecie} »` : '';
        const connu = def ? '' : '  (INCONNU du code)';
        console.log(`  ${String(ligne._id).padEnd(20)} ${String(ligne.total).padStart(3)} compte(s), ${ligne.actifs} actif(s)${marque}${connu}`);
    }

    console.log('\nMigrations disponibles :');
    for (const { depuis, vers } of MIGRATIONS) {
        const n = await StaffUser.countDocuments({ role: depuis });
        console.log(`  --role ${depuis.padEnd(18)} → ${vers.padEnd(18)} (${n} compte(s))`);
    }
};

const migrer = async (depuis) => {
    const migration = MIGRATIONS.find((m) => m.depuis === depuis);
    if (!migration) {
        console.error(`« ${depuis} » n'est pas un rôle déprécié. Rôles migrables : ${MIGRATIONS.map((m) => m.depuis).join(', ')}`);
        process.exit(1);
    }

    const { vers } = migration;

    // Le rôle cible doit exister en base, sinon les comptes migrés
    // retomberaient sur les permissions du code — correct, mais pas ce qu'on
    // veut découvrir en production.
    const cibleEnBase = await RolePermission.findOne({ role: vers });
    if (!cibleEnBase) {
        console.warn(`Le rôle « ${vers} » n'est pas encore en base.`);
        console.warn(`Lancez d'abord : node scripts/seedRolePermissions.js --appliquer\n`);
        if (APPLIQUER) process.exit(1);
    }

    const comptes = await StaffUser.find({ role: depuis }).select('nom email statut permissions').lean();
    if (!comptes.length) {
        console.log(`Aucun compte « ${depuis} » à migrer.`);
        return;
    }

    console.log(`${depuis} → ${vers}  (${libelleDuRole(depuis)} → ${libelleDuRole(vers)})`);
    console.log(`Le rôle cible porte ${permissionsDuRole(vers).length} permissions.\n`);

    const migrables = [];
    for (const compte of comptes) {
        // Un compte à permissions sur mesure ignore les permissions de son
        // rôle (voir loadPermissions) : changer son rôle ne changerait rien
        // à ses droits, mais rendrait son écran incohérent avec eux.
        if (compte.permissions?.length) {
            console.log(`  ! ${compte.email.padEnd(32)} permissions sur mesure (${compte.permissions.length}) — ignoré`);
            continue;
        }
        console.log(`  → ${compte.email.padEnd(32)} ${compte.statut}`);
        migrables.push(compte._id);
    }

    if (!APPLIQUER) {
        console.log(`\nAperçu : ${migrables.length} compte(s) seraient migrés. Relancez avec --appliquer.`);
        return;
    }

    const resultat = await StaffUser.updateMany(
        { _id: { $in: migrables } },
        { $set: { role: vers } }
    );
    console.log(`\n${resultat.modifiedCount} compte(s) migré(s) vers « ${vers} ».`);
};

const run = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI absent — rien à faire.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`Connexion MongoDB OK — mode ${APPLIQUER ? 'ÉCRITURE' : 'APERÇU (aucune écriture)'}\n`);

        if (ROLE_CIBLE) await migrer(ROLE_CIBLE);
        else await etatDesLieux();

        process.exit(0);
    } catch (error) {
        console.error('Erreur migration :', error);
        process.exit(1);
    }
};

run();
