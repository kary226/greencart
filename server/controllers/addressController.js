import Address from "../models/Address.js";
import City from "../models/City.js";
import Commune from "../models/Commune.js";

// Add Address : /api/address/add
export const addAddress = async (req, res) => {
    try {
        const { address, userId } = req.body;
        
        // Vérifier les champs obligatoires
        if (!address.firstName || !address.lastName || !address.phone || !address.street) {
            return res.json({ success: false, message: "Champs obligatoires manquants" });
        }

        // Récupérer les noms de la ville et de la commune si les IDs sont fournis
        let cityName = '';
        let communeName = '';

        if (address.cityId) {
            const city = await City.findById(address.cityId);
            if (city) cityName = city.name;
        }

        if (address.communeId) {
            const commune = await Commune.findById(address.communeId);
            if (commune) communeName = commune.name;
        }

        const newAddress = await Address.create({
            userId,
            firstName: address.firstName,
            lastName: address.lastName,
            email: address.email || '',
            street: address.street,
            city: address.city || cityName,
            state: address.state || '',
            zipcode: address.zipcode || '',
            country: address.country || 'Côte d\'Ivoire',
            phone: address.phone,
            cityId: address.cityId || null,
            communeId: address.communeId || null,
            cityName: cityName,
            communeName: communeName
        });

        res.json({ success: true, message: "Adresse ajoutée", address: newAddress });
    } catch (error) {
        console.log("Erreur addAddress:", error.message);
        res.json({ success: false, message: error.message });
    }
};

// Get Address : /api/address/get
export const getAddress = async (req, res) => {
    try {
        const { userId } = req.body;
        const addresses = await Address.find({ userId });
        
        // Enrichir les adresses avec les noms des villes et communes
        const enrichedAddresses = await Promise.all(addresses.map(async (addr) => {
            const addrObj = addr.toObject();
            
            if (addr.cityId) {
                const city = await City.findById(addr.cityId);
                if (city) addrObj.cityName = city.name;
            }
            if (addr.communeId) {
                const commune = await Commune.findById(addr.communeId);
                if (commune) addrObj.communeName = commune.name;
            }
            
            return addrObj;
        }));
        
        res.json({ success: true, addresses: enrichedAddresses });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};