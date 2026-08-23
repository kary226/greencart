import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

import Refund from '../models/Refund.js';
import WalletTransaction from '../models/WalletTransaction.js';
import CustomerCreditTransaction from '../models/CustomerCreditTransaction.js';
import Order from '../models/Order.js';

/**
 * Migration des remboursements existants vers Refund.
 *
 * Ce script parcourt :
 *   1. Les WalletTransaction de type 'ajustement' avec description contenant
 *      'RCOINS', 'remboursement', 'litige' ou 'exceptionnel'
 *   2. Les CustomerCreditTransaction de type 'credit' avec description contenant
 *      'remboursement', 'litige' ou 'exceptionnel'
 *
 * Pour chaque écriture, il crée un document Refund avec le statut 'completed'.
 *
 * Idempotent : une écriture déjà migrée ne l'est pas deux fois.
 *
 * Utilisation :
 *   node scripts/migrateRefunds.js
 *
 * Note : utilise crypto.randomUUID() (Node.js 14+), pas besoin du package uuid.
 */
const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connexion MongoDB OK');

        // 1. Migrer depuis WalletTransaction (ajustements RCOINS)
        const walletTxns = await WalletTransaction.find({
            type: 'ajustement',
            $or: [
                { description: { $regex: /RCOINS/i } },
                { description: { $regex: /remboursement/i } },
                { description: { $regex: /litige/i } },
                { description: { $regex: /exceptionnel/i } },
            ],
            orderId: { $ne: null },
        }).lean();

        console.log(`📦 ${walletTxns.length} transaction(s) wallet à analyser...`);

        let created = 0;
        let skipped = 0;

        for (const tx of walletTxns) {
            // Vérifier si déjà migré
            const existing = await Refund.findOne({
                'refundId': { $regex: `wallet_${tx._id}` },
            });
            if (existing) {
                skipped++;
                continue;
            }

            const order = await Order.findById(tx.orderId);
            if (!order) {
                skipped++;
                continue;
            }

            // Utiliser crypto.randomUUID() à la place du package uuid
            const refundId = `wallet_${tx._id}_${crypto.randomUUID().slice(0, 8)}`;

            const refund = await Refund.create({
                orderId: order._id,
                itemIds: [],
                montantApprouve: Math.abs(tx.montant),
                methode: 'rcoins',
                statut: 'completed',
                refundId: refundId,
                demandePar: tx.creePar || null,
                approuvePar: tx.creePar || null,
                motif: tx.description || 'Remboursement (migration)',
                approuveLe: tx.createdAt || new Date(),
                completeLe: tx.createdAt || new Date(),
                noteInterne: `Migré depuis WalletTransaction ${tx._id}`,
            });

            created++;
            console.log(`   ✅ Commande ${order._id.slice(-6).toUpperCase()} - ${Math.abs(tx.montant)} FCFA`);
        }

        // 2. Migrer depuis CustomerCreditTransaction (crédits exceptionnels)
        const creditTxns = await CustomerCreditTransaction.find({
            type: 'credit',
            $or: [
                { description: { $regex: /remboursement/i } },
                { description: { $regex: /litige/i } },
                { description: { $regex: /exceptionnel/i } },
            ],
            orderId: { $ne: null },
        }).lean();

        console.log(`📦 ${creditTxns.length} transaction(s) credit à analyser...`);

        for (const tx of creditTxns) {
            // Vérifier si déjà migré
            const existing = await Refund.findOne({
                'refundId': { $regex: `credit_${tx._id}` },
            });
            if (existing) {
                skipped++;
                continue;
            }

            const order = await Order.findById(tx.orderId);
            if (!order) {
                skipped++;
                continue;
            }

            const refundId = `credit_${tx._id}_${crypto.randomUUID().slice(0, 8)}`;

            const refund = await Refund.create({
                orderId: order._id,
                itemIds: [],
                montantApprouve: tx.amount,
                methode: 'rcoins',
                statut: 'completed',
                refundId: refundId,
                demandePar: null,
                approuvePar: null,
                motif: tx.description || 'Remboursement (migration)',
                approuveLe: tx.createdAt || new Date(),
                completeLe: tx.createdAt || new Date(),
                noteInterne: `Migré depuis CustomerCreditTransaction ${tx._id}`,
            });

            created++;
            console.log(`   ✅ Commande ${order._id.slice(-6).toUpperCase()} - ${tx.amount} FCFA (credit)`);
        }

        console.log(`✅ Migration terminée : ${created} remboursement(s) créés, ${skipped} ignoré(s).`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur :', error);
        process.exit(1);
    }
};

run();