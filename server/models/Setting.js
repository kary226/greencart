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
export default Setting;