import User from "../models/User.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Configuration des cookies cross-origin
const cookieOptions = {
    httpOnly: true,
    secure: true, // HTTPS obligatoire en production
    sameSite: 'none', // CRUCIAL : permet les connexions depuis différents domaines
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: '.vercel.app' // Permet au cookie d'être partagé entre sous-domaines
};

const clearCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: '.vercel.app'
};

// Register User : /api/user/register
export const register = async (req, res)=>{
    try {
        const { name, email, password } = req.body;

        if(!name || !email || !password){
            return res.json({success: false, message: 'Missing Details'})
        }

        const existingUser = await User.findOne({email})

        if(existingUser)
            return res.json({success: false, message: 'User already exists'})

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await User.create({name, email, password: hashedPassword})

        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '7d'});

        res.cookie('token', token, cookieOptions)

        return res.json({success: true, user: {email: user.email, name: user.name}})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// Login User : /api/user/login
export const login = async (req, res)=>{
    try {
        const { email, password } = req.body;

        if(!email || !password)
            return res.json({success: false, message: 'Email and password are required'});
        const user = await User.findOne({email});

        if(!user){
            return res.json({success: false, message: 'Invalid email or password'});
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if(!isMatch)
            return res.json({success: false, message: 'Invalid email or password'});

        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '7d'});

        res.cookie('token', token, cookieOptions)

        return res.json({success: true, user: {email: user.email, name: user.name}})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// Check Auth : /api/user/is-auth
export const isAuth = async (req, res)=>{
    try {
        const { userId } = req.body;
        const user = await User.findById(userId).select("-password")
        return res.json({success: true, user})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// Logout User : /api/user/logout
export const logout = async (req, res)=>{
    try {
        res.clearCookie('token', clearCookieOptions);
        return res.json({ success: true, message: "Logged Out" })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// Update User : /api/user/update
export const updateUser = async (req, res)=>{
    try {
        const { userId, name, email, phone, street, cityId, communeId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "Utilisateur non trouvé" });
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (phone !== undefined) user.phone = phone;
        if (street !== undefined) user.street = street;
        if (cityId !== undefined) user.cityId = cityId;
        if (communeId !== undefined) user.communeId = communeId;

        if (cityId) {
            const City = await import('../models/City.js').then(m => m.default);
            const city = await City.findById(cityId);
            if (city) user.cityName = city.name;
        }
        if (communeId) {
            const Commune = await import('../models/Commune.js').then(m => m.default);
            const commune = await Commune.findById(communeId);
            if (commune) user.communeName = commune.name;
        }

        await user.save();

        return res.json({ 
            success: true, 
            message: "Informations mises à jour", 
            user: { 
                name: user.name, 
                email: user.email, 
                phone: user.phone,
                street: user.street,
                cityId: user.cityId,
                communeId: user.communeId,
                cityName: user.cityName,
                communeName: user.communeName
            } 
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// ==================== MOT DE PASSE OUBLIÉ ====================

// Demande de réinitialisation de mot de passe
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.json({ success: false, message: "Aucun compte associé à cet email" });
        }
        
        // Générer un token unique
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = Date.now() + 3600000; // 1 heure
        
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetExpires;
        await user.save();
        
        // Envoyer l'email
        const { sendPasswordResetEmail } = await import('../configs/email.js');
        await sendPasswordResetEmail(email, resetToken);
        
        res.json({ success: true, message: "Un email de réinitialisation vous a été envoyé" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// Réinitialisation du mot de passe
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.json({ success: false, message: "Token invalide ou expiré" });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        
        res.json({ success: true, message: "Mot de passe modifié avec succès" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};