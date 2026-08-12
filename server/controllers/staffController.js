import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import StaffUser from '../models/StaffUser.js';
import Invitation from '../models/Invitation.js';
import Boutique from '../models/Boutique.js';
import Wallet from '../models/Wallet.js';
import { sendStaffInvitationEmail } from '../configs/email.js';
import { TYPE_STAFF } from '../utils/jwtTypes.js';

const ROLES_VALIDES = ['admin', 'commercant', 'livreur', 'assistant_shein'];
const INVITATION_VALIDITE_MS = 48 * 60 * 60 * 1000; // 48 heures

// [SÉCURITÉ] Empreinte d'un jeton d'invitation. La création et la
// vérification DOIVENT toutes deux passer par ici — sinon plus aucun lien
// d'activation ne fonctionne.
//
// SHA-256 nu suffit : le jeton fait 256 bits d'aléa cryptographique et vit
// 48 h. Il n'est pas devinable, un hachage lent façon bcrypt n'apporterait
// rien ici (contrairement à un mot de passe, qui est court et deviné).
const hacherJetonInvitation = (jeton) =>
    crypto.createHash('sha256').update(String(jeton)).digest('hex');

// Cookie séparé de 'token' (client) et de 'sellerToken' (ancien compte
// vendeur unique) — même logique de séparation des sessions par espace.
const getStaffCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        domain: isProduction ? '.ramci.ci' : undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    };
};

const setStaffTokenCookie = (res, token) => {
    res.cookie('staffToken', token, getStaffCookieOptions());
};

// Ne renvoie jamais password ni totpSecret au client.
const toPublicStaff = (staffUser) => ({
    _id: staffUser._id,
    email: staffUser.email,
    nom: staffUser.nom,
    telephone: staffUser.telephone,
    role: staffUser.role,
    statut: staffUser.statut,
    boutiqueId: staffUser.boutiqueId,
    derniereConnexion: staffUser.derniereConnexion,
    createdAt: staffUser.createdAt,
});

// ------------------------------------------------------------------ //
// POST /api/staff/invitations — Admin uniquement
// ------------------------------------------------------------------ //
export const createInvitation = async (req, res) => {
    try {
        const { email, role } = req.body;

        if (typeof email !== 'string' || typeof role !== 'string') {
            return res.status(400).json({ success: false, message: 'Format de données invalide' });
        }

        const emailNormalise = email.trim().toLowerCase();

        if (!emailNormalise) {
            return res.status(400).json({ success: false, message: 'Email requis' });
        }

        if (!ROLES_VALIDES.includes(role)) {
            return res.status(400).json({ success: false, message: 'Rôle invalide' });
        }

        const compteExistant = await StaffUser.findOne({ email: emailNormalise });
        if (compteExistant) {
            return res.status(409).json({ success: false, message: 'Un compte existe déjà avec cet email' });
        }

        // Une seule invitation valide à la fois par email : on invalide
        // les précédentes non utilisées pour éviter plusieurs liens actifs.
        await Invitation.deleteMany({ email: emailNormalise, utilisee: false });

        const token = crypto.randomBytes(32).toString('hex');

        const invitation = await Invitation.create({
            email: emailNormalise,
            role,
            // [SÉCURITÉ] Seule l'empreinte est stockée — le lien en clair ne
            // vit que dans l'e-mail. Un lien d'invitation vaut la création
            // d'un compte staff (potentiellement admin) : une fuite de la
            // base ne doit pas suffire à en fabriquer un.
            token: hacherJetonInvitation(token),
            expireA: new Date(Date.now() + INVITATION_VALIDITE_MS),
            creePar: req.staffUser._id,
        });

        await sendStaffInvitationEmail(emailNormalise, token, role);

        return res.status(201).json({
            success: true,
            message: 'Invitation envoyée',
            invitation: {
                _id: invitation._id,
                email: invitation.email,
                role: invitation.role,
                expireA: invitation.expireA,
            },
        });
    } catch (error) {
        console.error('Erreur createInvitation:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/staff/invitations — Admin uniquement
// ------------------------------------------------------------------ //
export const listInvitations = async (req, res) => {
    try {
        const invitations = await Invitation.find({ utilisee: false })
            .sort('-createdAt')
            .select('-token');

        return res.status(200).json({ success: true, invitations });
    } catch (error) {
        console.error('Erreur listInvitations:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// POST /api/staff/activation/:token — Public
// ------------------------------------------------------------------ //
export const activateAccount = async (req, res) => {
    try {
        const { token } = req.params;
        const { nom, password } = req.body;

        if (typeof token !== 'string' || typeof nom !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ success: false, message: 'Format de données invalide' });
        }

        if (!nom.trim()) {
            return res.status(400).json({ success: false, message: 'Le nom est requis' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' });
        }

        // [SÉCURITÉ] C'est l'empreinte qui est en base, pas le jeton reçu.
        const invitation = await Invitation.findOne({ token: hacherJetonInvitation(token) });

        if (!invitation) {
            return res.status(404).json({ success: false, message: "Lien d'invitation introuvable" });
        }

        if (invitation.utilisee) {
            return res.status(400).json({ success: false, message: 'Ce lien a déjà été utilisé' });
        }

        if (invitation.expireA.getTime() < Date.now()) {
            return res.status(410).json({ success: false, message: 'Ce lien a expiré, demandez une nouvelle invitation' });
        }

        const compteExistant = await StaffUser.findOne({ email: invitation.email });
        if (compteExistant) {
            return res.status(409).json({ success: false, message: 'Un compte existe déjà avec cet email' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const totpSecret = authenticator.generateSecret();

        const staffUser = await StaffUser.create({
            email: invitation.email,
            password: hashedPassword,
            nom: nom.trim(),
            role: invitation.role,
            statut: 'actif',
            totpSecret,
            creePar: invitation.creePar,
        });

        // ✅ PHASE 3 : Création automatique de la boutique et du wallet
        if (staffUser.role === 'commercant') {
            // Créer la boutique
            const boutique = await Boutique.create({
                nom: `Boutique de ${staffUser.nom}`,
                ownerId: staffUser._id,
                statut: 'active',
            });
            staffUser.boutiqueId = boutique._id;
            await staffUser.save();

            // Créer le portefeuille
            await Wallet.create({
                ownerId: staffUser._id,
                solde: 0,
            });
        }

        invitation.utilisee = true;
        await invitation.save();

        const jwtToken = jwt.sign({ id: staffUser._id, typ: TYPE_STAFF }, process.env.JWT_SECRET, { expiresIn: '7d' });
        setStaffTokenCookie(res, jwtToken);

        // otpauthUrl n'est renvoyé qu'ICI, une seule fois, pour générer le
        // QR code de mise en place de l'authentificateur (Google
        // Authenticator / Authy). Il n'est plus jamais renvoyé ensuite.
        const otpauthUrl = authenticator.keyuri(staffUser.email, 'GreenCart', totpSecret);

        return res.status(201).json({
            success: true,
            message: 'Compte activé',
            staffUser: toPublicStaff(staffUser),
            totpSetup: { secret: totpSecret, otpauthUrl },
        });
    } catch (error) {
        console.error('Erreur activateAccount:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// POST /api/staff/login — Public (rate-limité)
// ------------------------------------------------------------------ //
export const staffLogin = async (req, res) => {
    try {
        const { email, password, totpCode } = req.body;

        if (typeof email !== 'string' || typeof password !== 'string' || typeof totpCode !== 'string') {
            return res.status(400).json({ success: false, message: 'Identifiants invalides' });
        }

        const staffUser = await StaffUser.findOne({ email: email.trim().toLowerCase() });

        if (!staffUser) {
            return res.status(401).json({ success: false, message: 'Identifiants invalides' });
        }

        if (staffUser.statut !== 'actif') {
            return res.status(403).json({ success: false, message: 'Ce compte est suspendu' });
        }

        const passwordValide = await bcrypt.compare(password, staffUser.password);
        if (!passwordValide) {
            return res.status(401).json({ success: false, message: 'Identifiants invalides' });
        }

        const codeValide = authenticator.verify({ token: totpCode, secret: staffUser.totpSecret });
        if (!codeValide) {
            return res.status(401).json({ success: false, message: "Code d'authentification invalide" });
        }

        staffUser.derniereConnexion = new Date();
        await staffUser.save();

        const jwtToken = jwt.sign({ id: staffUser._id, typ: TYPE_STAFF }, process.env.JWT_SECRET, { expiresIn: '7d' });
        setStaffTokenCookie(res, jwtToken);

        return res.status(200).json({
            success: true,
            message: 'Connexion réussie',
            staffUser: toPublicStaff(staffUser)
        });
    } catch (error) {
        console.error('Erreur staffLogin:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/staff/is-auth — Staff (authStaff)
// ------------------------------------------------------------------ //
export const isStaffAuth = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            staffUser: toPublicStaff(req.staffUser)
        });
    } catch (error) {
        console.error('Erreur isStaffAuth:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/staff/logout — Staff
// ------------------------------------------------------------------ //
export const staffLogout = async (req, res) => {
    try {
        res.clearCookie('staffToken', getStaffCookieOptions());
        return res.status(200).json({ success: true, message: 'Déconnexion réussie' });
    } catch (error) {
        console.error('Erreur staffLogout:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/staff/comptes — Admin uniquement
// ------------------------------------------------------------------ //
export const listStaffAccounts = async (req, res) => {
    try {
        // Support de pagination optionnel
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Filtres optionnels
        const filter = {};
        if (req.query.role) filter.role = req.query.role;
        if (req.query.statut) filter.statut = req.query.statut;
        if (req.query.search) {
            filter.$or = [
                { nom: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } },
            ];
        }

        const comptes = await StaffUser.find(filter)
            .sort('-createdAt')
            .select('-password -totpSecret')
            .skip(skip)
            .limit(limit);

        const total = await StaffUser.countDocuments(filter);

        return res.status(200).json({
            success: true,
            comptes,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Erreur listStaffAccounts:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// PATCH /api/staff/comptes/:id/statut — Admin uniquement
// ------------------------------------------------------------------ //
export const updateStaffStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { statut } = req.body;

        if (!['actif', 'suspendu'].includes(statut)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }

        if (id === req.staffUser._id.toString()) {
            return res.status(403).json({ success: false, message: 'Vous ne pouvez pas modifier votre propre statut' });
        }

        const staffUser = await StaffUser.findById(id);
        if (!staffUser) {
            return res.status(404).json({ success: false, message: 'Compte introuvable' });
        }

        staffUser.statut = statut;
        await staffUser.save();

        return res.status(200).json({
            success: true,
            message: 'Statut mis à jour',
            staffUser: toPublicStaff(staffUser)
        });
    } catch (error) {
        console.error('Erreur updateStaffStatus:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// PATCH /api/staff/comptes/:id/role — Admin uniquement
// ------------------------------------------------------------------ //
export const updateStaffRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!ROLES_VALIDES.includes(role)) {
            return res.status(400).json({ success: false, message: 'Rôle invalide' });
        }

        if (id === req.staffUser._id.toString()) {
            return res.status(403).json({ success: false, message: 'Vous ne pouvez pas modifier votre propre rôle' });
        }

        const staffUser = await StaffUser.findById(id);
        if (!staffUser) {
            return res.status(404).json({ success: false, message: 'Compte introuvable' });
        }

        staffUser.role = role;
        await staffUser.save();

        return res.status(200).json({
            success: true,
            message: 'Rôle mis à jour',
            staffUser: toPublicStaff(staffUser)
        });
    } catch (error) {
        console.error('Erreur updateStaffRole:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};