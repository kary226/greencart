import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

import RolePermission from '../models/RolePermission.js';

/**
 * Script de seed pour les permissions de remboursement (Phase 5).
 *
 * Ajoute les permissions :
 *   - refunds.view    → Voir les remboursements
 *   - refunds.create  → Créer une demande de remboursement
 *   - refunds.approve → Approuver/Rejeter/Marquer comme terminé
 *
 * Utilisation :
 *   node scripts/seedRefundPermissions.js
 */
const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connexion MongoDB OK');

        const updates = [
            { role: 'super_admin', add: ['refunds.view', 'refunds.create', 'refunds.approve'] },
            { role: 'finance_admin', add: ['refunds.view', 'refunds.create', 'refunds.approve'] },
            { role: 'support_admin', add: ['refunds.view', 'refunds.create'] },
            { role: 'catalog_admin', add: ['refunds.view'] },
            { role: 'read_only_auditor', add: ['refunds.view'] },
        ];

        for (const { role, add } of updates) {
            const entry = await RolePermission.findOne({ role });
            if (!entry) {
                console.log(`⚠️ Rôle ${role} non trouvé, ignore.`);
                continue;
            }

            const current = new Set(entry.permissions);
            let added = 0;
            for (const p of add) {
                if (!current.has(p)) {
                    current.add(p);
                    added++;
                }
            }

            if (added > 0) {
                entry.permissions = Array.from(current);
                await entry.save();
                console.log(`✅ ${role} : ${added} permission(s) ajoutée(s) (${add.join(', ')})`);
            } else {
                console.log(`ℹ️ ${role} : déjà à jour.`);
            }
        }

        console.log('✅ Seed des permissions de remboursement terminé.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur :', error);
        process.exit(1);
    }
};

run();