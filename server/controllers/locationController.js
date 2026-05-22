import City from "../models/City.js";
import Commune from "../models/Commune.js";

// ==================== VILLES ====================

// Récupérer toutes les villes (ordre alphabétique)
export const getCities = async (req, res) => {
    try {
        const cities = await City.find({ isActive: true }).sort({ name: 1 });
        res.json({ success: true, cities });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Récupérer toutes les villes (admin)
export const getAllCities = async (req, res) => {
    try {
        const cities = await City.find().sort({ name: 1 });
        res.json({ success: true, cities });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Ajouter une ville
export const addCity = async (req, res) => {
    try {
        const { name } = req.body;
        
        const existing = await City.findOne({ name });
        if (existing) {
            return res.json({ success: false, message: "Cette ville existe déjà" });
        }
        
        const city = await City.create({ name });
        res.json({ success: true, message: "Ville ajoutée", city });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Modifier une ville
export const updateCity = async (req, res) => {
    try {
        const { id, name, isActive } = req.body;
        await City.findByIdAndUpdate(id, { name, isActive });
        res.json({ success: true, message: "Ville modifiée" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Supprimer une ville
export const deleteCity = async (req, res) => {
    try {
        const { id } = req.body;
        // Supprimer aussi les communes liées
        await Commune.deleteMany({ cityId: id });
        await City.findByIdAndDelete(id);
        res.json({ success: true, message: "Ville supprimée" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ==================== COMMUNES ====================

// Récupérer les communes par ville (ordre alphabétique)
export const getCommunesByCity = async (req, res) => {
    try {
        const { cityId } = req.params;
        const communes = await Commune.find({ cityId, isActive: true }).sort({ name: 1 });
        res.json({ success: true, communes });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Récupérer toutes les communes (admin)
export const getAllCommunes = async (req, res) => {
    try {
        const communes = await Commune.find().populate('cityId', 'name').sort({ name: 1 });
        res.json({ success: true, communes });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Ajouter une commune
export const addCommune = async (req, res) => {
    try {
        const { name, cityId } = req.body;
        
        const existing = await Commune.findOne({ name, cityId });
        if (existing) {
            return res.json({ success: false, message: "Cette commune existe déjà dans cette ville" });
        }
        
        const commune = await Commune.create({ name, cityId });
        res.json({ success: true, message: "Commune ajoutée", commune });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Modifier une commune
export const updateCommune = async (req, res) => {
    try {
        const { id, name, cityId, isActive } = req.body;
        await Commune.findByIdAndUpdate(id, { name, cityId, isActive });
        res.json({ success: true, message: "Commune modifiée" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Supprimer une commune
export const deleteCommune = async (req, res) => {
    try {
        const { id } = req.body;
        await Commune.findByIdAndDelete(id);
        res.json({ success: true, message: "Commune supprimée" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};