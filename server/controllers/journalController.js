import JournalAction from '../models/JournalAction.js';
import Boutique from '../models/Boutique.js';

// Lecture du journal des actions. Écriture : services/journalService.js.

// GET /api/journal — Admin
//
// Filtres optionnels : boutique, action, auteur. Paginé, car ce journal ne
// fait que grossir — le charger entièrement finirait par être le genre de
// requête qui met l'administration à genoux.
export const listJournal = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 30);

        const filtre = {};
        if (req.query.boutiqueId) filtre.boutiqueId = req.query.boutiqueId;
        if (req.query.action) filtre.action = req.query.action;
        if (req.query.acteurId) filtre.acteurId = req.query.acteurId;

        const [entrees, total] = await Promise.all([
            JournalAction.find(filtre)
                .populate('boutiqueId', 'nom')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            JournalAction.countDocuments(filtre),
        ]);

        return res.status(200).json({
            success: true,
            entrees,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Erreur listJournal:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/journal/boutiques — Admin
// Liste courte pour alimenter le filtre par boutique de l'écran Journal.
export const listBoutiquesJournal = async (req, res) => {
    try {
        const boutiques = await Boutique.find().select('nom').sort('nom').lean();
        return res.status(200).json({ success: true, boutiques });
    } catch (error) {
        console.error('Erreur listBoutiquesJournal:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
