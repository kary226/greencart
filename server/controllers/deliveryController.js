import DeliveryType from "../models/DeliveryType.js";
import DeliveryPrice from "../models/DeliveryPrice.js";
import City from "../models/City.js";
import Commune from "../models/Commune.js";

// ==================== TYPES DE LIVRAISON ====================

// Récupérer tous les types de livraison (admin)
export const getAllDeliveryTypes = async (req, res) => {
    try {
        const types = await DeliveryType.find().sort({ order: 1 });
        res.json({ success: true, types });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Récupérer les types actifs (client)
export const getActiveDeliveryTypes = async (req, res) => {
    try {
        const types = await DeliveryType.find({ isActive: true }).sort({ order: 1 });
        res.json({ success: true, types });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Ajouter un type de livraison
export const addDeliveryType = async (req, res) => {
    try {
        const { name, description, order } = req.body;
        
        const existing = await DeliveryType.findOne({ name });
        if (existing) {
            return res.json({ success: false, message: "Ce type existe déjà" });
        }
        
        const type = await DeliveryType.create({ name, description, order: order || 0 });
        res.json({ success: true, message: "Type ajouté", type });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Modifier un type de livraison
export const updateDeliveryType = async (req, res) => {
    try {
        const { id, name, description, isActive, order } = req.body;
        await DeliveryType.findByIdAndUpdate(id, { name, description, isActive, order });
        res.json({ success: true, message: "Type modifié" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Supprimer un type de livraison
export const deleteDeliveryType = async (req, res) => {
    try {
        const { id } = req.body;
        await DeliveryPrice.deleteMany({ deliveryTypeId: id });
        await DeliveryType.findByIdAndDelete(id);
        res.json({ success: true, message: "Type supprimé" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ==================== PRIX DE LIVRAISON ====================

// Récupérer tous les prix (admin)
export const getAllDeliveryPrices = async (req, res) => {
    try {
        const prices = await DeliveryPrice.find()
            .populate('deliveryTypeId', 'name')
            .populate('cityId', 'name')
            .populate('communeId', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, prices });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Récupérer le prix de livraison pour une commune et un type (client)
export const getDeliveryPrice = async (req, res) => {
    try {
        const { communeId, deliveryTypeId } = req.params;
        
        let price = await DeliveryPrice.findOne({ 
            communeId, 
            deliveryTypeId,
            isActive: true 
        });
        
        if (!price) {
            const commune = await Commune.findById(communeId);
            if (commune) {
                price = await DeliveryPrice.findOne({ 
                    cityId: commune.cityId, 
                    communeId: null,
                    deliveryTypeId,
                    isActive: true 
                });
            }
        }
        
        res.json({ success: true, price: price || null });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Ajouter un prix de livraison (corrigé pour gérer les chaînes vides)
export const addDeliveryPrice = async (req, res) => {
    try {
        let { deliveryTypeId, cityId, communeId, price } = req.body;
        
        // Convertir les chaînes vides en null
        cityId = cityId && cityId !== '' ? cityId : null;
        communeId = communeId && communeId !== '' ? communeId : null;
        
        const existing = await DeliveryPrice.findOne({ deliveryTypeId, cityId, communeId });
        if (existing) {
            return res.json({ success: false, message: "Ce tarif existe déjà" });
        }
        
        const deliveryPrice = await DeliveryPrice.create({
            deliveryTypeId,
            cityId,
            communeId,
            price: Number(price)
        });
        
        res.json({ success: true, message: "Tarif ajouté", deliveryPrice });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Ajouter plusieurs prix en masse (par virgules)
export const addBulkDeliveryPrices = async (req, res) => {
    try {
        const { deliveryTypeId, cityId, communeNames, price } = req.body;
        
        const namesList = communeNames.split(',').map(n => n.trim()).filter(n => n);
        let successCount = 0;
        let errorCount = 0;
        
        for (const name of namesList) {
            let commune = await Commune.findOne({ name, cityId });
            if (!commune) {
                commune = await Commune.create({ name, cityId });
            }
            
            const existing = await DeliveryPrice.findOne({ 
                deliveryTypeId, 
                communeId: commune._id 
            });
            
            if (!existing) {
                await DeliveryPrice.create({
                    deliveryTypeId,
                    cityId,
                    communeId: commune._id,
                    price: Number(price)
                });
                successCount++;
            } else {
                errorCount++;
            }
        }
        
        res.json({ 
            success: true, 
            message: `${successCount} commune(s) ajoutée(s), ${errorCount} existante(s)` 
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Modifier un prix
export const updateDeliveryPrice = async (req, res) => {
    try {
        const { id, price, isActive } = req.body;
        await DeliveryPrice.findByIdAndUpdate(id, { price: Number(price), isActive });
        res.json({ success: true, message: "Tarif modifié" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Supprimer un prix
export const deleteDeliveryPrice = async (req, res) => {
    try {
        const { id } = req.body;
        await DeliveryPrice.findByIdAndDelete(id);
        res.json({ success: true, message: "Tarif supprimé" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};