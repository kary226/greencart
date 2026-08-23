import {
    reconcilierJeko,
    getReconciliationEcards,
    resoudreEcart,
    getReconciliationStats,
} from '../services/reconciliationService.js';

/**
 * Lance un rapprochement Jèko.
 * POST /api/admin/reconciliation/run
 */
export const runReconciliation = async (req, res) => {
    try {
        const { dateDebut, dateFin, autoResoudre } = req.body;

        const result = await reconcilierJeko({
            dateDebut,
            dateFin,
            autoResoudre: autoResoudre || false,
        });

        return res.status(200).json({
            success: true,
            message: 'Rapprochement terminé',
            ...result,
        });
    } catch (error) {
        console.error('Erreur runReconciliation:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Récupère la file des écarts.
 * GET /api/admin/reconciliation/ecarts
 */
export const listEcards = async (req, res) => {
    try {
        const ecarts = await getReconciliationEcards();
        return res.status(200).json({
            success: true,
            ecarts,
        });
    } catch (error) {
        console.error('Erreur listEcards:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Résout un écart.
 * POST /api/admin/reconciliation/ecarts/:id/resoudre
 */
export const resolveEcart = async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        const log = await resoudreEcart(id, req.staffUser, note);

        return res.status(200).json({
            success: true,
            message: 'Écart résolu',
            log,
        });
    } catch (error) {
        console.error('Erreur resolveEcart:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Statistiques de rapprochement.
 * GET /api/admin/reconciliation/stats
 */
export const getReconciliationStatsController = async (req, res) => {
    try {
        const stats = await getReconciliationStats();
        return res.status(200).json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error('Erreur getReconciliationStats:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};