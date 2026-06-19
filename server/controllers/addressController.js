import Address from "../models/Address.js";
import City from "../models/City.js";
import Commune from "../models/Commune.js";

// Add Address : /api/address/add
export const addAddress = async (req, res) => {
    try {
        const { address, userId } = req.body;

        if (!address.firstName || !address.lastName || !address.phone || !address.street) {
            return res.json({ success: false, message: "Champs obligatoires manquants" });
        }

        // ✅ Récupérer city et commune en parallèle (au lieu de 2 requêtes séquentielles)
        const [city, commune] = await Promise.all([
            address.cityId ? City.findById(address.cityId) : null,
            address.communeId ? Commune.findById(address.communeId) : null
        ]);

        const newAddress = await Address.create({
            userId,
            firstName: address.firstName,
            lastName: address.lastName,
            email: address.email || '',
            street: address.street,
            city: address.city || city?.name || '',
            state: address.state || '',
            zipcode: address.zipcode || '',
            country: address.country || "Côte d'Ivoire",
            phone: address.phone,
            cityId: address.cityId || null,
            communeId: address.communeId || null,
            cityName: city?.name || '',
            communeName: commune?.name || ''
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
        // ✅ Les cityName/communeName sont déjà stockés dans l'adresse, pas besoin de requêtes supplémentaires
        const addresses = await Address.find({ userId });
        res.json({ success: true, addresses });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Delete Address : /api/address/delete
export const deleteAddress = async (req, res) => {
    try {
        const { addressId, userId } = req.body;

        // ✅ Vérifie que l'adresse appartient bien à l'utilisateur avant de supprimer
        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
            return res.json({ success: false, message: "Adresse non trouvée" });
        }

        await Address.findByIdAndDelete(addressId);
        res.json({ success: true, message: "Adresse supprimée" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};
