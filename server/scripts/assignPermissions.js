import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

import StaffUser from '../models/StaffUser.js';
import RolePermission from '../models/RolePermission.js';

const permissionsByRole = {
    super_admin: ['admin.all'],
    finance_admin: [
        'wallet.view', 'wallet.adjust', 'wallet.transactions',
        'withdrawals.view', 'withdrawals.approve', 'withdrawals.reject',
        'refunds.view', 'refunds.approve',
        'rcoins.view', 'rcoins.adjust',
        'commission.view',
    ],
    warehouse_admin: [
        'warehouse.scan', 'warehouse.inspect',
        'returns.view', 'returns.inspect', 'returns.decide',
        'orders.view',
    ],
    logistics_admin: [
        'deliveries.view', 'deliveries.assign',
        'delivery_zones.view', 'delivery_zones.configure',
        'orders.ship', 'orders.mark_delivered',
    ],
    catalog_admin: [
        'catalog.view', 'catalog.create', 'catalog.edit', 'catalog.delete',
        'catalog.banners', 'catalog.categories', 'catalog.coupons',
        'catalog.questions',
    ],
    support_admin: [
        'clients.view', 'orders.view', 'orders.edit',
        'disputes.view', 'disputes.respond',
        'refunds.view',
    ],
    read_only_auditor: [
        'audit.view', 'audit.export',
        'wallet.view', 'orders.view', 'catalog.view',
    ],
    admin: ['admin.all'],
    commercant: [
        'shop.view', 'shop.edit',
        'products.create', 'products.edit', 'products.delete',
        'orders.view_own', 'orders.confirm',
        'withdrawals.request',
        'wallet.view_own',
    ],
    livreur: [
        'deliveries.view_own', 'deliveries.update_status',
    ],
    assistant_shein: [
        'shein.view', 'shein.update',
    ],
};

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connexion MongoDB OK');

        // Supprimer les anciennes permissions
        await RolePermission.deleteMany({});
        console.log('🧹 Anciennes permissions supprimées.');

        // Créer les permissions pour chaque rôle
        for (const [role, permissions] of Object.entries(permissionsByRole)) {
            await RolePermission.create({ role, permissions });
            console.log(`✅ ${role} : ${permissions.length} permissions`);
        }

        console.log('✅ Seed des permissions terminé.');

        // Mettre à jour les comptes staff existants
        const staffUsers = await StaffUser.find({});
        let updated = 0;

        for (const user of staffUsers) {
            // Si le rôle existe déjà dans la table des permissions, on ne fait rien
            // Sinon, on garde le rôle actuel
            console.log(`ℹ️ Compte : ${user.email} (rôle: ${user.role})`);
            updated++;
        }

        console.log(`✅ ${updated} comptes staff vérifiés.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur :', error);
        process.exit(1);
    }
};

run();