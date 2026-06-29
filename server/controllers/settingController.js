import Setting from "../models/Setting.js";

// GET /api/setting/:key
export const getSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const setting = await Setting.findOne({ key });
        
        if (!setting) {
            return res.json({ success: false, message: "Paramètre non trouvé" });
        }
        
        res.json({ success: true, data: setting.value });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// POST /api/setting/update
export const updateSetting = async (req, res) => {
    try {
        const { key, value } = req.body;
        
        if (!key) {
            return res.json({ success: false, message: "Clé requise" });
        }
        
        const setting = await Setting.findOneAndUpdate(
            { key },
            { key, value, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        
        res.json({ success: true, message: "Paramètre mis à jour", data: setting });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// GET /api/setting/all
export const getAllSettings = async (req, res) => {
    try {
        const settings = await Setting.find({});
        res.json({ success: true, data: settings });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};