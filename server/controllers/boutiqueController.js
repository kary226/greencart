import Boutique from '../models/Boutique.js';
import Product from '../models/Product.js';
import StaffUser from '../models/StaffUser.js';

// ------------------------------------------------------------------ //
// GET /api/boutiques/moi — Récupérer sa propre boutique
// ------------------------------------------------------------------ //
export const getMaBoutique = async (req, res) => {
    try {
        const boutique = await Boutique.findOne({ ownerId: req.staffUser._id });
        if (!boutique) {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }
        return res.status(200).json({ success: true, boutique });
    } catch (error) {
        console.error('Erreur getMaBoutique:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// PATCH /api/boutiques/moi — Modifier sa boutique
// ------------------------------------------------------------------ //
export const updateMaBoutique = async (req, res) => {
    try {
        const { nom, description, logo } = req.body;

        const boutique = await Boutique.findOne({ ownerId: req.staffUser._id });
        if (!boutique) {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }

        if (nom) boutique.nom = nom;
        if (description !== undefined) boutique.description = description;
        if (logo) boutique.logo = logo;

        await boutique.save();

        return res.status(200).json({
            success: true,
            message: 'Boutique mise à jour',
            boutique
        });
    } catch (error) {
        console.error('Erreur updateMaBoutique:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/boutiques/:id — Voir une boutique publique (lecture)
// ------------------------------------------------------------------ //
export const getBoutiqueById = async (req, res) => {
    try {
        const { id } = req.params;
        const boutique = await Boutique.findById(id).populate('ownerId', 'nom email');
        if (!boutique) {
            return res.status(404).json({ success: false, message: 'Boutique non trouvée' });
        }

        // Récupérer les produits de la boutique
        const produits = await Product.find({
            boutiqueId: id,
            inStock: true
        }).select('name price offerPrice image categories salesCount');

        return res.status(200).json({
            success: true,
            boutique,
            produits
        });
    } catch (error) {
        console.error('Erreur getBoutiqueById:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/boutiques — Admin : lister toutes les boutiques
// ------------------------------------------------------------------ //
export const listAllBoutiques = async (req, res) => {
    try {
        const boutiques = await Boutique.find()
            .populate('ownerId', 'nom email')
            .sort('-createdAt');

        return res.status(200).json({ success: true, boutiques });
    } catch (error) {
        console.error('Erreur listAllBoutiques:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// POST /api/boutiques — Admin : créer une boutique pour un commerçant
// ------------------------------------------------------------------ //
export const createBoutiqueForCommercial = async (req, res) => {
    try {
        const { ownerId, nom, description, logo } = req.body;

        const commercial = await StaffUser.findOne({ _id: ownerId, role: 'commercant' });
        if (!commercial) {
            return res.status(404).json({ success: false, message: 'Commerçant non trouvé' });
        }

        const existing = await Boutique.findOne({ ownerId });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Ce commerçant a déjà une boutique' });
        }

        const boutique = await Boutique.create({
            nom: nom || `Boutique de ${commercial.nom}`,
            description: description || '',
            logo: logo || null,
            ownerId,
            statut: 'active',
        });

        // Mettre à jour le StaffUser
        commercial.boutiqueId = boutique._id;
        await commercial.save();

        return res.status(201).json({
            success: true,
            message: 'Boutique créée',
            boutique
        });
    } catch (error) {
        console.error('Erreur createBoutiqueForCommercial:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};