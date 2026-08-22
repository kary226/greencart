import WarehouseScan from '../models/WarehouseScan.js';
import Order from '../models/Order.js';
import ReturnCase from '../models/ReturnCase.js';
import { journaliser } from '../services/journalService.js';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Crée un scan d'entrepôt (réception, préparation, expédition, retour).
 * POST /api/admin/warehouse/scan
 */
export const createWarehouseScan = async (req, res) => {
    try {
        const { orderId, itemId, boutiqueId, type, emplacement, note, metadata } = req.body;
        const photos = req.files || [];

        if (!orderId || !type) {
            return res.status(400).json({
                success: false,
                message: 'orderId et type sont requis',
            });
        }

        // Vérifier que la commande existe
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande non trouvée' });
        }

        // Upload des photos sur Cloudinary
        let photoUrls = [];
        if (photos.length > 0) {
            photoUrls = await Promise.all(
                photos.map(async (file) => {
                    const result = await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            { resource_type: 'image', folder: 'warehouse/scans' },
                            (error, result) => (error ? reject(error) : resolve(result))
                        );
                        uploadStream.end(file.buffer);
                    });
                    return result.secure_url;
                })
            );
        }

        // Créer le scan
        const scan = await WarehouseScan.create({
            orderId,
            itemId: itemId || null,
            boutiqueId: boutiqueId || null,
            type,
            scannePar: req.staffUser._id,
            emplacement: emplacement || null,
            photos: photoUrls,
            note: note || '',
            metadata: metadata || {},
        });

        // Journaliser l'action
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'warehouse.scan',
            cible: { id: orderId, libelle: `Commande ${orderId.slice(-6).toUpperCase()}` },
            note: `${type}${itemId ? ` - article ${itemId}` : ''}${emplacement ? ` - emplacement ${emplacement}` : ''}`,
        });

        // Si c'est un scan de retour (retour_reception), mettre à jour le ReturnCase
        if (type === 'retour_reception' || type === 'retour_inspection') {
            await updateReturnCaseFromScan(scan, order);
        }

        return res.status(201).json({
            success: true,
            message: 'Scan enregistré',
            scan,
        });
    } catch (error) {
        console.error('Erreur createWarehouseScan:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Récupère tous les scans d'une commande.
 * GET /api/admin/warehouse/scans/:orderId
 */
export const getWarehouseScans = async (req, res) => {
    try {
        const { orderId } = req.params;
        const scans = await WarehouseScan.find({ orderId })
            .sort({ scanneLe: -1 })
            .populate('scannePar', 'nom email');

        return res.status(200).json({
            success: true,
            scans,
        });
    } catch (error) {
        console.error('Erreur getWarehouseScans:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Récupère tous les scans (filtrés par type, date, etc.)
 * GET /api/admin/warehouse/scans
 */
export const listWarehouseScans = async (req, res) => {
    try {
        const { type, dateDebut, dateFin, page = 1, limit = 50 } = req.query;

        const filter = {};
        if (type) filter.type = type;
        if (dateDebut || dateFin) {
            filter.scanneLe = {};
            if (dateDebut) filter.scanneLe.$gte = new Date(dateDebut);
            if (dateFin) filter.scanneLe.$lte = new Date(dateFin);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const scans = await WarehouseScan.find(filter)
            .sort({ scanneLe: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('scannePar', 'nom email')
            .populate('orderId', '_id amount status');

        const total = await WarehouseScan.countDocuments(filter);

        return res.status(200).json({
            success: true,
            scans,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Erreur listWarehouseScans:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Fonction interne ────────────────────────────────────────────────────

/**
 * Met à jour le ReturnCase associé à une commande après un scan de retour.
 */
const updateReturnCaseFromScan = async (scan, order) => {
    let returnCase = await ReturnCase.findOne({ orderId: order._id });

    if (!returnCase) {
        returnCase = await ReturnCase.create({
            orderId: order._id,
            statut: 'return_received',
            scans: [scan._id],
        });
        return;
    }

    // Ajouter le scan à la liste des scans
    if (!returnCase.scans.includes(scan._id)) {
        returnCase.scans.push(scan._id);
    }

    // Mettre à jour le statut en fonction du type de scan
    if (scan.type === 'retour_reception') {
        returnCase.statut = 'return_received';
    } else if (scan.type === 'retour_inspection') {
        returnCase.statut = 'return_inspection';
    }

    await returnCase.save();
};