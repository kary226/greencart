import User from "../models/User.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const getFullName = (firstName, lastName) => {
    const first = (firstName || '').trim();
    const last = (lastName || '').trim();
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (last) return last;
    return '';
};

export const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        if ((!firstName && !lastName) || !email || !password) {
            return res.json({ success: false, message: 'Tous les champs sont requis' });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.json({ success: false, message: 'Cet email est déjà utilisé' });
        }

        const name = getFullName(firstName, lastName);
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            firstName: firstName || '',
            lastName: lastName || '',
            name,
            email,
            password: hashedPassword
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.json({
            success: true,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.name,
                email: user.email,
                phone: user.phone || ''
            },
            token
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.json({ success: false, message: 'Email et mot de passe requis' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.json({
            success: true,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.name,
                email: user.email,
                phone: user.phone || ''
            },
            token
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

export const isAuth = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId).select("-password");
        return res.json({
            success: true,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                street: user.street || '',
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
};

export const logout = async (req, res) => {
    try {
        return res.json({ success: true, message: "Déconnexion réussie" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { userId, firstName, lastName, email, phone, street, cityId, communeId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "Utilisateur non trouvé" });
        }

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (email !== undefined) user.email = email;
        if (phone !== undefined) user.phone = phone;
        if (street !== undefined) user.street = street;
        if (cityId !== undefined) user.cityId = cityId;
        if (communeId !== undefined) user.communeId = communeId;

        user.name = getFullName(user.firstName, user.lastName);

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
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
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
};

// ==================== ADMIN : Récupérer tous les clients ====================

export const getAllClients = async (req, res) => {
    try {
        const { search = '', page = 1, limit = 20 } = req.query;
        
        const query = {
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ]
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const clients = await User.find(query)
            .select('-password -resetPasswordToken -resetPasswordExpires')
            .sort({ lastName: 1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        // Enrichir les clients avec toutes les informations
        const enrichedClients = clients.map(client => ({
            _id: client._id,
            firstName: client.firstName || '',
            lastName: client.lastName || '',
            name: client.name || '',
            email: client.email,
            phone: client.phone || '',
            street: client.street || '',
            cityName: client.cityName || '',
            communeName: client.communeName || '',
            createdAt: client.createdAt,
            updatedAt: client.updatedAt
        }));
        
        const total = await User.countDocuments(query);
        
        res.json({
            success: true,
            clients: enrichedClients,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// ==================== MOT DE PASSE OUBLIÉ ====================

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ success: false, message: "Aucun compte associé à cet email" });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = Date.now() + 3600000;

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetExpires;
        await user.save();

        const { sendPasswordResetEmail } = await import('../configs/email.js');
        await sendPasswordResetEmail(email, resetToken);

        res.json({ success: true, message: "Un email de réinitialisation vous a été envoyé" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.json({ success: false, message: "Lien invalide ou expiré" });
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