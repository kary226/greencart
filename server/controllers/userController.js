import User from "../models/User.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// [FIX sécurité] Pose le token dans un cookie httpOnly, en plus de le
// renvoyer dans le JSON (pour l'instant — le JSON sera retiré une fois
// le client migré). httpOnly = invisible pour JavaScript, donc invisible
// pour une éventuelle faille XSS. sameSite: 'none' + secure: true car le
// client (ramci.ci) et ce serveur sont sur deux domaines différents
// (cookie "cross-site").
const setTokenCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours, comme la durée de vie du JWT
    });
};

const getFullName = (firstName, lastName) => {
    const first = (firstName || '').trim();
    const last = (lastName || '').trim();
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (last) return last;
    return '';
};

// Échapper les caractères spéciaux pour éviter les ReDoS (M4)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        if ((!firstName && !lastName) || !email || !password) {
            return res.json({ success: false, message: 'Tous les champs sont requis' });
        }

        // [FIX injection NoSQL] email/password doivent être des chaînes de
        // caractères. Sans cette vérification, un attaquant pourrait envoyer
        // { "email": { "$ne": null } } et transformer la requête MongoDB
        // findOne({ email }) en une recherche par opérateur au lieu d'une
        // simple égalité.
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.json({ success: false, message: 'Format de données invalide' });
        }

        // M5 : Vérification de robustesse du mot de passe (minimum 8 caractères)
        if (password.length < 8) {
            return res.json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' });
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
        setTokenCookie(res, token);

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

        // [FIX injection NoSQL] Même protection que register : email/password
        // doivent être des chaînes, jamais des objets.
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.json({ success: false, message: 'Format de données invalide' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
        }

        if (!user.password) {
            return res.json({ success: false, message: 'Ce compte utilise la connexion Google. Veuillez vous connecter avec Google.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        setTokenCookie(res, token);

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
                communeName: user.communeName,
                avatar: user.avatar || ''
            }
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        });
        return res.json({ success: true, message: "Déconnexion réussie" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { userId, firstName, lastName, email, phone, street, cityId, communeId, name } = req.body;

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

        // Utiliser le name fourni par le client s'il est valide, sinon le recalculer
        if (name !== undefined && name.trim() !== '') {
            user.name = name.trim();
        } else {
            user.name = getFullName(user.firstName, user.lastName);
        }

        // Vérification : le nom ne doit pas être vide
        if (!user.name || user.name.trim().length === 0) {
            return res.json({ success: false, message: "Le nom ne peut pas être vide" });
        }

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

// ==================== CONNEXION GOOGLE ====================

export const googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.json({ success: false, message: 'Token Google manquant' });
        }

        const { OAuth2Client } = await import('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, given_name: firstName, family_name: lastName, picture: avatar, name } = payload;

        let user = await User.findOne({ email });

        if (user) {
            if (!user.googleId) {
                user.googleId = googleId;
                user.avatar = avatar || user.avatar;
                await user.save();
            }
        } else {
            user = await User.create({
                googleId,
                firstName: firstName || '',
                lastName: lastName || '',
                name: name || getFullName(firstName, lastName),
                email,
                avatar: avatar || '',
                password: null,
            });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        setTokenCookie(res, token);

        return res.json({
            success: true,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                avatar: user.avatar || ''
            },
            token
        });
    } catch (error) {
        console.log('Google auth error:', error.message);
        res.json({ success: false, message: 'Échec de la connexion Google' });
    }
};

// ==================== ADMIN : Récupérer tous les clients ====================

export const getAllClients = async (req, res) => {
    try {
        const { search = '', page = 1, limit = 20 } = req.query;

        // M4 : Échapper les caractères spéciaux pour éviter les ReDoS
        const safeSearch = escapeRegex(search).slice(0, 100);

        const query = {
            $or: [
                { firstName: { $regex: safeSearch, $options: 'i' } },
                { lastName: { $regex: safeSearch, $options: 'i' } },
                { name: { $regex: safeSearch, $options: 'i' } },
                { email: { $regex: safeSearch, $options: 'i' } },
                { phone: { $regex: safeSearch, $options: 'i' } }
            ]
        };

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(parseInt(limit) || 20, 100); // L4 : plafonner la limite à 100
        const skip = (pageNum - 1) * limitNum;

        const clients = await User.find(query)
            .select('-password -resetPasswordToken -resetPasswordExpires')
            .sort({ lastName: 1 })
            .skip(skip)
            .limit(limitNum);

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
            hasGoogleAccount: !!client.googleId,
            avatar: client.avatar || '',
            createdAt: client.createdAt,
            updatedAt: client.updatedAt
        }));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            clients: enrichedClients,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum)
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

        // [FIX injection NoSQL] email doit être une chaîne de caractères.
        if (typeof email !== 'string') {
            return res.json({ success: true, message: "Si un compte existe, un lien de réinitialisation a été envoyé." });
        }

        const user = await User.findOne({ email });

        // Traiter uniquement si l'utilisateur a un mot de passe (pas un compte Google)
        if (user && user.password) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetExpires = Date.now() + 3600000;

            user.resetPasswordToken = resetToken;
            user.resetPasswordExpires = resetExpires;
            await user.save();

            const { sendPasswordResetEmail } = await import('../configs/email.js');
            await sendPasswordResetEmail(email, resetToken);
        }

        // H4 : Réponse identique, que le compte existe ou non
        res.json({ success: true, message: "Si un compte existe, un lien de réinitialisation a été envoyé." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // [FIX CRITIQUE injection NoSQL] 'token' doit être une chaîne de
        // caractères. Sans cette vérification, un attaquant pouvait envoyer
        // { "token": { "$ne": null } } : MongoDB interprète alors ceci comme
        // l'opérateur "différent de null" au lieu d'une valeur à comparer,
        // et la requête matche N'IMPORTE QUEL utilisateur ayant actuellement
        // un token de reset valide et non expiré — permettant de voler le
        // compte de n'importe quel client ayant demandé une réinitialisation
        // récemment, sans connaître le vrai token reçu par email.
        if (typeof token !== 'string') {
            return res.json({ success: false, message: "Lien invalide ou expiré" });
        }

        // M5 : Vérifier la robustesse du nouveau mot de passe
        if (!newPassword || newPassword.length < 8) {
            return res.json({ success: false, message: "Le mot de passe doit contenir au moins 8 caractères" });
        }

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