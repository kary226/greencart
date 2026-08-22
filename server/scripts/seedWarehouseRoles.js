import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

import StaffUser from '../models/StaffUser.js';
import RolePermission from '../models/RolePermission.js';

/**
 * Script de seed pour le rôle warehouse_admin (Phase 4).
 *
 * Que fait ce script ?
 *   1. Vérifie que le rôle 'warehouse_admin' existe dans RolePermission.
 *   2. Liste tous les comptes staff avec le rôle 'warehouse_admin'.
 *   3. Optionnellement, vous pouvez décommenter la partie pour
 *      promouvoir un compte existant vers warehouse_admin.
 *
 * Utilisation :
 *   node scripts/seedWarehouseRoles.js
 *
 * Options (décommenter dans le code) :
 *   - Créer un nouveau compte warehouse_admin
 *   - Promouvoir un compte existant vers warehouse_admin
 */
const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connexion MongoDB OK');

        // ─── 1. Vérifier que le rôle existe ──────────────────────────

        const warehousePerm = await RolePermission.findOne({ role: 'warehouse_admin' });
        if (!warehousePerm) {
            console.log('❌ Le rôle warehouse_admin n\'existe pas.');
            console.log('💡 Exécutez d\'abord : node scripts/assignPermissions.js');
            process.exit(1);
        }
        console.log(`✅ Rôle warehouse_admin trouvé (${warehousePerm.permissions.length} permissions)`);

        // ─── 2. Lister les comptes warehouse_admin existants ──────────

        const warehouseAdmins = await StaffUser.find({ role: 'warehouse_admin' });

        if (warehouseAdmins.length === 0) {
            console.log('ℹ️ Aucun compte warehouse_admin trouvé.');
            console.log('');
            console.log('💡 Options pour en créer un :');
            console.log('   1. Invitation : /staff/admin/comptes → "Inviter un nouveau membre" → rôle "warehouse_admin"');
            console.log('   2. Promotion : mettez à jour un compte existant via /api/staff/comptes/:id/role');
            console.log('   3. Script : décommentez la section "Créer un compte" ci-dessous');
        } else {
            console.log(`✅ ${warehouseAdmins.length} compte(s) warehouse_admin trouvé(s) :`);
            warehouseAdmins.forEach(u => {
                console.log(`   - ${u.email} (${u.nom})`);
            });
            console.log('✅ Tous les comptes warehouse_admin ont les permissions nécessaires.');
        }

        // ─── 3. Optionnel : créer un compte warehouse_admin ───────────

        /*
        // DÉCOMMENTEZ POUR CRÉER UN COMPTE warehouse_admin
        const bcrypt = await import('bcryptjs').then(m => m.default);
        const { authenticator } = await import('otplib');

        const newWarehouseAdmin = await StaffUser.create({
            email: 'warehouse@ramci.ci',
            password: await bcrypt.hash('MotDePasseSecurise123', 10),
            nom: 'Responsable Entrepôt',
            role: 'warehouse_admin',
            statut: 'actif',
            totpSecret: authenticator.generateSecret(),
        });

        const otpauthUrl = authenticator.keyuri(
            newWarehouseAdmin.email,
            'GreenCart',
            newWarehouseAdmin.totpSecret
        );

        console.log('');
        console.log('✅ Compte warehouse_admin créé :');
        console.log(`   Email : ${newWarehouseAdmin.email}`);
        console.log(`   Mot de passe : MotDePasseSecurise123 (à changer)`);
        console.log(`   QR code 2FA : ${otpauthUrl}`);
        */

        // ─── 4. Optionnel : promouvoir un compte existant ────────────

        /*
        // DÉCOMMENTEZ POUR PROMOUVOIR UN COMPTE EXISTANT
        const user = await StaffUser.findOne({ email: 'votre-email@exemple.com' });
        if (user) {
            user.role = 'warehouse_admin';
            await user.save();
            console.log(`✅ ${user.email} promu en warehouse_admin`);
        } else {
            console.log('❌ Utilisateur non trouvé');
        }
        */

        console.log('');
        console.log('✅ Script terminé.');

        // ─── 5. Afficher un résumé des rôles ──────────────────────────

        const roleCounts = await StaffUser.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        console.log('');
        console.log('📊 Répartition des rôles :');
        roleCounts.forEach(r => {
            console.log(`   - ${r._id}: ${r.count} compte(s)`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur :', error);
        process.exit(1);
    }
};

run();