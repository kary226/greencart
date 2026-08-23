import Order from '../models/Order.js';
import WalletTransaction from '../models/WalletTransaction.js';
import ReconciliationLog from '../models/ReconciliationLog.js';
import { journaliser } from './journalService.js';

/**
 * Service de rapprochement Jèko / Wallet.
 *
 * Deux sources :
 *   1. Jèko : transactions réelles (webhook reçu, stocké dans Order.jeko_reference)
 *   2. Wallet : transactions internes (WalletTransaction)
 *
 * Le rapprochement consiste à vérifier que pour chaque paiement Jèko,
 * il existe une transaction wallet correspondante.
 */
export const reconcilierJeko = async (options = {}) => {
    const {
        dateDebut = null,
        dateFin = null,
        autoResoudre = false,
    } = options;

    const filterJeko = {};
    const filterWallet = {};

    if (dateDebut) {
        const d = new Date(dateDebut);
        filterJeko.createdAt = { $gte: d };
        filterWallet.createdAt = { $gte: d };
    }
    if (dateFin) {
        const d = new Date(dateFin);
        filterJeko.createdAt = { $lte: d };
        filterWallet.createdAt = { $lte: d };
    }

    // 1. Récupérer toutes les commandes payées par Jèko
    const orders = await Order.find({
        paymentType: 'Jeko',
        isPaid: true,
        jeko_reference: { $ne: null },
        ...filterJeko,
    }).lean();

    console.log(`🔍 Rapprochement Jèko: ${orders.length} commandes trouvées`);

    // 2. Récupérer les transactions wallet correspondantes
    const walletTxns = await WalletTransaction.find({
        type: { $in: ['vente', 'ajustement'] },
        orderId: { $ne: null },
        ...filterWallet,
    }).lean();

    const walletByOrder = new Map();
    for (const txn of walletTxns) {
        if (txn.orderId) {
            const key = txn.orderId.toString();
            if (!walletByOrder.has(key)) {
                walletByOrder.set(key, []);
            }
            walletByOrder.get(key).push(txn);
        }
    }

    // 3. Comparer chaque commande avec les transactions wallet
    const results = [];
    const logs = [];

    for (const order of orders) {
        const walletEntries = walletByOrder.get(order._id.toString()) || [];
        const totalWallet = walletEntries.reduce((sum, t) => sum + t.montant, 0);

        // Vérifier s'il y a déjà un log pour cette commande
        const existingLog = await ReconciliationLog.findOne({
            orderId: order._id,
            resolu: false,
        });

        const ecart = Math.abs(order.amount - totalWallet);
        const estEcart = ecart > 0;

        const log = {
            jekoReference: order.jeko_reference,
            jekoAmount: order.amount,
            jekoStatus: order.isPaid ? 'successful' : 'pending',
            orderId: order._id,
            internalAmount: totalWallet,
            internalStatus: order.isPaid ? 'paid' : 'pending',
            montantEcart: ecart,
            typeEcart: estEcart ? 'montant' : 'aucun',
            resolu: false,
            runDate: new Date(),
        };

        // Si autoResoudre est true et qu'il n'y a pas d'écart, marquer comme résolu
        if (autoResoudre && !estEcart) {
            log.resolu = true;
            log.noteResolution = 'Auto-résolu : aucun écart';
        }

        if (existingLog) {
            // Mettre à jour le log existant
            await ReconciliationLog.updateOne(
                { _id: existingLog._id },
                { $set: { ...log, updatedAt: new Date() } }
            );
            logs.push({ ...log, _id: existingLog._id });
        } else {
            // Créer un nouveau log
            const created = await ReconciliationLog.create(log);
            logs.push(created);
        }

        results.push({
            orderId: order._id,
            jekoAmount: order.amount,
            walletAmount: totalWallet,
            ecart,
            ok: !estEcart,
        });
    }

    // 4. Détecter les transactions wallet sans commande Jèko (doublons ?)
    const walletWithoutOrder = [];
    for (const [orderId, txns] of walletByOrder) {
        const orderExists = orders.some(o => o._id.toString() === orderId);
        if (!orderExists) {
            walletWithoutOrder.push({ orderId, txns });
        }
    }

    // 5. Journaliser le rapprochement
    await journaliser({
        acteur: {
            id: null,
            nom: 'Système',
            role: 'systeme',
        },
        action: 'reconciliation.run',
        cible: {
            id: null,
            libelle: `Rapprochement Jèko ${dateDebut || 'début'} → ${dateFin || 'fin'}`,
        },
        note: `${orders.length} commandes analysées, ${logs.filter(l => l.typeEcart !== 'aucun').length} écarts détectés`,
    });

    return {
        totalOrders: orders.length,
        totalEcards: logs.filter(l => l.typeEcart !== 'aucun').length,
        logs,
        walletWithoutOrder,
        results,
        summary: {
            orders: orders.length,
            ok: results.filter(r => r.ok).length,
            ecarts: results.filter(r => !r.ok).length,
            walletWithoutOrder: walletWithoutOrder.length,
        },
    };
};

/**
 * Récupère la file des écarts (non résolus).
 */
export const getReconciliationEcards = async () => {
    const logs = await ReconciliationLog.find({
        resolu: false,
        typeEcart: { $ne: 'aucun' },
    })
        .sort({ createdAt: -1 })
        .populate('orderId', 'amount status userId')
        .populate('resoluPar', 'nom email');

    return logs;
};

/**
 * Résout un écart manuellement.
 */
export const resoudreEcart = async (logId, staffUser, note) => {
    const log = await ReconciliationLog.findById(logId);
    if (!log) {
        throw new Error('Log de rapprochement introuvable');
    }

    if (log.resolu) {
        throw new Error('Cet écart est déjà résolu');
    }

    log.resolu = true;
    log.resoluPar = staffUser._id;
    log.resoluLe = new Date();
    log.noteResolution = note || 'Résolution manuelle';

    await log.save();

    await journaliser({
        acteur: {
            id: staffUser._id,
            nom: staffUser.nom,
            role: staffUser.role,
        },
        action: 'reconciliation.resolve',
        cible: {
            id: log._id,
            libelle: `Écart ${log.jekoReference}`,
        },
        note: note || 'Résolution manuelle',
    });

    return log;
};

/**
 * Statistiques de rapprochement pour le dashboard.
 */
export const getReconciliationStats = async () => {
    const total = await ReconciliationLog.countDocuments();
    const ecarts = await ReconciliationLog.countDocuments({
        resolu: false,
        typeEcart: { $ne: 'aucun' },
    });
    const resolvus = await ReconciliationLog.countDocuments({ resolu: true });
    const derniers = await ReconciliationLog.find({ resolu: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('orderId', 'amount status');

    return {
        total,
        ecarts,
        resolvus,
        derniers,
        tauxResolution: total > 0 ? Math.round((resolvus / total) * 100) : 0,
    };
};