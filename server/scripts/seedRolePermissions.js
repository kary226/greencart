import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

// Contournement DNS pour mongodb+srv://
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();

import RolePermission from '../models/RolePermission.js';

/**
 * Script de seed : crée les permissions de base pour chaque rôle.
 * À exécuter UNE SEULE FOIS après la création du modèle RolePermission.
 * 
 * Basé sur le tableau du cahier des charges §5.2.
 */
const permissionsByRole = {
    super_admin: ['admin.all'],
    finance_admin: [
        'wallet.view', 'wallet.adjust', 'wallet.transactions',
        'withdrawals.view', 'withdrawals.approve', 'withdrawals.reject',
        'refunds.view', 'refunds.approve', 'refunds.create',
        'rcoins.view', 'rcoins.adjust',
        'commission.view', 'finance.reconcile',
        'admin.dashboard',
    ],
    warehouse_admin: [
        'warehouse.scan', 'warehouse.inspect',
        'returns.view', 'returns.inspect', 'returns.decide',
        'orders.view',
        'admin.dashboard',
    ],
    logistics_admin: [
        'deliveries.view', 'deliveries.assign', 'deliveries.configure',
        'delivery_zones.view', 'delivery_zones.configure',
        'orders.ship', 'orders.mark_delivered',
        'admin.dashboard',
    ],
    catalog_admin: [
        'catalog.view', 'catalog.create', 'catalog.edit', 'catalog.delete',
        'catalog.banners', 'catalog.categories', 'catalog.coupons',
        'catalog.questions',
        'admin.dashboard',
    ],
    support_admin: [
        'clients.view', 'clients.edit', 'orders.view', 'orders.edit',
        'disputes.view', 'disputes.respond',
        'refunds.view',
        'admin.dashboard',
    ],
    read_only_auditor: [
        'audit.view', 'audit.export',
        'wallet.view', 'orders.view', 'catalog.view',
        'admin.dashboard',
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

        await RolePermission.deleteMany({});
        console.log('🧹 Anciennes permissions supprimées.');

        for (const [role, permissions] of Object.entries(permissionsByRole)) {
            await RolePermission.create({ role, permissions });
            console.log(`✅ ${role} : ${permissions.length} permissions`);
        }

        console.log('✅ Seed des permissions terminé avec succès.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur seed :', error);
        process.exit(1);
    }
};

run();