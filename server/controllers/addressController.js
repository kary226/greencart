import Address from "../models/Address.js";

// Add Address : /api/address/add
export const addAddress = async (req, res) => {
    try {
        const { address, userId } = req.body;
        
        // Vérifier les champs obligatoires
        if (!address.firstName || !address.lastName || !address.phone || !address.street) {
            return res.json({ success: false, message: "Champs obligatoires manquants" });
        }

        const newAddress = await Address.create({
            userId,
            firstName: address.firstName,
            lastName: address.lastName,
            email: address.email || '',
            street: address.street,
            city: address.city || '',
            state: address.state || '',
            zipcode: address.zipcode || '',
            country: address.country || 'Côte d\'Ivoire',
            phone: address.phone,
            cityId: address.cityId || null,
            communeId: address.communeId || null
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
        res.json({ success: true, addresses });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};