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
    const { dateDebut = null, dateFin = null, autoResoudre = false } = options;
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
        if (autoResoudre && !estEcart) {
            log.resolu = true;
            log.noteResolution = 'Auto-résolu : aucun écart';
        }
        if (existingLog) {
            await ReconciliationLog.updateOne(
                { _id: existingLog._id },
                { $set: { ...log, updatedAt: new Date() } }
            );
            logs.push({ ...log, _id: existingLog._id });
        } else {
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
    const logAvant = await ReconciliationLog.findById(logId);
    if (!logAvant) {
        throw new Error('Log de rapprochement introuvable');
    }
    // [CORRECTIF — même race condition que refundController.approveRefund(),
    // voir Phase 2.1] Sans verrou atomique, un findById() + save() séparés
    // laissaient une fenêtre où deux résolutions concurrentes du même écart
    // (double-clic, deux agents finance agissant en même temps) passaient
    // toutes deux la vérification `resolu === false` avant qu'aucune
    // n'écrive : les deux réussissaient (200/200) et produisaient deux
    // entrées de journal (JournalAction) pour un seul événement — un défaut
    // d'intégrité de l'audit trail, confirmé par
    // tests/reconciliationController.test.js.
    //
    // findOneAndUpdate({_id, resolu: false}, ...) verrouille côté MongoDB :
    // seule la première requête peut matcher le filtre ; la seconde reçoit
    // `null` et ne journalise donc jamais une deuxième fois.
    const log = await ReconciliationLog.findOneAndUpdate(
        { _id: logId, resolu: false },
        {
            $set: {
                resolu: true,
                resoluPar: staffUser._id,
                resoluLe: new Date(),
                noteResolution: note || 'Résolution manuelle',
            },
        },
        { new: true }
    );
    if (!log) {
        throw new Error('Cet écart est déjà résolu');
    }
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