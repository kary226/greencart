import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const Setting = mongoose.models.setting || mongoose.model('setting', settingSchema);

// ─── Initialisation des seuils par défaut ──────────────────────────
export const initSettings = async () => {
    const defaults = [
        { key: 'finance.approval.wallet_adjust_threshold', value: 50000 },
        { key: 'finance.approval.withdrawal_threshold', value: 100000 },
    ];
    for (const setting of defaults) {
        await Setting.findOneAndUpdate(
            { key: setting.key },
            { key: setting.key, value: setting.value },
            { upsert: true }
        );
    }
};

export default Setting;