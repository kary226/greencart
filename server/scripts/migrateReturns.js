import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

import Order from '../models/Order.js';
import ReturnCase from '../models/ReturnCase.js';

/**
 * Migration des commandes existantes vers ReturnCase.
 *
 * Ce script crée une instance ReturnCase pour chaque commande
 * qui a déjà le statut 'Returned'.
 *
 * Utilisation :
 *   node scripts/migrateReturns.js
 *
 * ⚠️ Idempotent : une commande déjà migrée ne l'est pas deux fois.
 */
const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connexion MongoDB OK');

        // Trouver toutes les commandes retournées qui n'ont pas encore de ReturnCase
        const orders = await Order.find({
            status: 'Returned',
            _id: { $nin: await ReturnCase.distinct('orderId') },
        });

        if (orders.length === 0) {
            console.log('ℹ️ Aucune commande retournée à migrer.');
            process.exit(0);
        }

        console.log(`📦 ${orders.length} commande(s) retournée(s) à migrer...`);

        let created = 0;
        for (const order of orders) {
            // [FIX] order._id est un ObjectId, on le convertit en string pour slice()
            const orderIdStr = order._id.toString();

            const returnCase = await ReturnCase.create({
                orderId: order._id,
                boutiqueId: null,
                itemIds: order.items.map(i => i._id),
                statut: 'resolved',
                responsabilite: order.retourEtat === 'endommage' ? 'commercant' : 'non_determinee',
                montantDecide: order.amount || 0,
                resolution: 'refund_client',
                noteInterne: `Migration automatique depuis commande retournée le ${order.retourTraiteLe?.toISOString() || 'date inconnue'}`,
                traitePar: null,
                traiteLe: order.retourTraiteLe || new Date(),
            });

            // Si un remboursement a été fait, on le note
            if (order.refundCreditedAt) {
                returnCase.noteInterne += `\nRemboursement effectué le ${order.refundCreditedAt.toISOString()}`;
                await returnCase.save();
            }

            created++;
            console.log(`   ✅ Commande ${orderIdStr.slice(-6).toUpperCase()} migrée`);
        }

        console.log(`✅ ${created} commande(s) migrée(s) vers ReturnCase.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur :', error);
        process.exit(1);
    }
};

run();