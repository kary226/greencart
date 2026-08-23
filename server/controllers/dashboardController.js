import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import JournalAction from '../models/JournalAction.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import User from '../models/User.js';
import DemandeRetrait from '../models/DemandeRetrait.js';
import { getReconciliationStats } from '../services/reconciliationService.js';
import { withCache } from '../configs/redisCache.js';

/**
 * KPIs avancés pour le tableau de bord.
 * GET /api/admin/dashboard/kpis
 *
 * Couverture d'audit : ratio des actions sensibles journalisées.
 * Délai moyen d'approbation : temps entre création et décision.
 * Reste-à-migrer seller : nombre de routes encore protégées par authSeller.
 * CA par mois : agrégé des commandes payées.
 * Taux de rétention : utilisateurs de plus de 30 jours.
 * RCOINS en circulation : somme des creditBalance.
 * Solde wallet total : somme des soldes disponibles.
 */
export const getAdvancedKPIs = async (req, res) => {
    try {
        const cacheKey = 'dashboard:kpis';
        const data = await withCache(cacheKey, 60, async () => {
            const totalActions = await JournalAction.countDocuments();
            const actionsSensibles = [
                'wallet.ajustement',
                'retrait.approbation',
                'retrait.rejet',
                'staff.statut',
                'staff.role',
                'staff.suppression',
                'staff.invitation',
                'boutique.statut',
                'boutique.autorisations',
            ];
            const actionsJournalisees = await JournalAction.countDocuments({
                action: { $in: actionsSensibles },
            });
            const couvertureAudit = totalActions > 0
                ? Math.round((actionsJournalisees / totalActions) * 100)
                : 0;
            const approvalsResolues = await ApprovalRequest.find({
                statut: { $in: ['approuvee', 'rejetee'] },
                decideLe: { $ne: null },
            }).select('createdAt decideLe');
            let delaiMoyen = 0;
            if (approvalsResolues.length > 0) {
                const totalDuree = approvalsResolues.reduce((sum, a) => {
                    const diff = new Date(a.decideLe) - new Date(a.createdAt);
                    return sum + diff;
                }, 0);
                delaiMoyen = Math.round(totalDuree / approvalsResolues.length / 1000 / 60);
            }
            const routesSeller = [
                'productRoute',
                'orderRoute',
                'bannerRoute',
                'categoryRoute',
                'couponRoute',
                'deliveryRoute',
                'locationRoute',
                'userRoute',
                'settingRoute',
                'boutiqueRoute',
                'metricsRoute',
                'sellerRoute',
                'staffRoute',
            ];
            const resteAMigrer = routesSeller.length;
            const caParMois = await Order.aggregate([
                { $match: { isPaid: true, status: { $ne: 'Cancelled' } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                        },
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $limit: 12 },
            ]);
            const users = await User.find({}).select('createdAt');
            const totalUsers = users.length;
            const oldUsers = users.filter(u => {
                const age = Date.now() - new Date(u.createdAt).getTime();
                return age > 30 * 24 * 60 * 60 * 1000;
            });
            const retentionRate = totalUsers > 0
                ? Math.round((oldUsers.length / totalUsers) * 100)
                : 0;
            const rcoinsTotal = await User.aggregate([
                { $group: { _id: null, total: { $sum: '$creditBalance' } } },
            ]);
            const walletTotal = await Wallet.aggregate([
                { $group: { _id: null, total: { $sum: '$solde' } } },
            ]);
            return {
                couvertureAudit,
                delaiMoyen: delaiMoyen > 0 ? `${delaiMoyen} min` : 'N/A',
                resteAMigrer,
                caParMois: caParMois.map(m => ({
                    mois: `${m._id.month}/${m._id.year}`,
                    total: m.total,
                    count: m.count,
                })),
                retentionRate,
                rcoinsEnCirculation: rcoinsTotal[0]?.total || 0,
                soldeWalletTotal: walletTotal[0]?.total || 0,
            };
        });
        return res.status(200).json({
            success: true,
            kpis: data,
        });
    } catch (error) {
        console.error('Erreur getAdvancedKPIs:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * KPIs Finance simplifiés.
 * GET /api/admin/dashboard/finance
 */
export const getFinanceKPIs = async (req, res) => {
    try {
        const cacheKey = 'dashboard:finance';
        const data = await withCache(cacheKey, 120, async () => {
            const orders = await Order.find({ isPaid: true, status: { $ne: 'Cancelled' } });
            const totalCA = orders.reduce((sum, o) => sum + o.amount, 0);
            const deliveries = orders.filter(o => o.status === 'Delivered');
            const totalLivraisons = deliveries.length;
            const retraits = await DemandeRetrait.find({ statut: 'payee' });
            const totalRetraits = retraits.reduce((sum, r) => sum + r.montant, 0);
            const enAttente = await DemandeRetrait.countDocuments({ statut: 'en_attente' });
            return {
                totalCA,
                totalLivraisons,
                totalRetraits,
                enAttenteRetraits: enAttente,
                nbCommandes: orders.length,
                panierMoyen: orders.length > 0 ? Math.round(totalCA / orders.length) : 0,
            };
        });
        return res.status(200).json({
            success: true,
            finance: data,
        });
    } catch (error) {
        console.error('Erreur getFinanceKPIs:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};