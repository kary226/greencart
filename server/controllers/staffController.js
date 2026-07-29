import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import StaffUser from '../models/StaffUser.js';
import Invitation from '../models/Invitation.js';
import { sendStaffInvitationEmail } from '../configs/email.js';

const ROLES_VALIDES = ['admin', 'commercant', 'livreur', 'assistant_shein'];
const INVITATION_VALIDITE_MS = 48 * 60 * 60 * 1000; // 48 heures

// Cookie séparé de 'token' (client) et de 'sellerToken' (ancien compte
// vendeur unique) — même logique de séparation des sessions par espace.
const STAFF_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    domain: '.ramci.ci',
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

const setStaffTokenCookie = (res, token) => {
    res.cookie('staffToken', token, STAFF_COOKIE_OPTIONS);
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
            return res.json({ success: false, message: 'Format de données invalide' });
        }

        const emailNormalise = email.trim().toLowerCase();

        if (!emailNormalise) {
            return res.json({ success: false, message: 'Email requis' });
        }

        if (!ROLES_VALIDES.includes(role)) {
            return res.json({ success: false, message: 'Rôle invalide' });
        }

        const compteExistant = await StaffUser.findOne({ email: emailNormalise });
        if (compteExistant) {
            return res.json({ success: false, message: 'Un compte existe déjà avec cet email' });
        }

        // Une seule invitation valide à la fois par email : on invalide
        // les précédentes non utilisées pour éviter plusieurs liens actifs.
        await Invitation.deleteMany({ email: emailNormalise, utilisee: false });

        const token = crypto.randomBytes(32).toString('hex');

        const invitation = await Invitation.create({
            email: emailNormalise,
            role,
            token,
            expireA: new Date(Date.now() + INVITATION_VALIDITE_MS),
            creePar: req.staffUser._id,
        });

        await sendStaffInvitationEmail(emailNormalise, token, role);

        return res.json({
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
        console.log(error.message);
        res.json({ success: false, message: error.message });
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

        return res.json({ success: true, invitations });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
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
            return res.json({ success: false, message: 'Format de données invalide' });
        }

        if (!nom.trim()) {
            return res.json({ success: false, message: 'Le nom est requis' });
        }

        if (password.length < 8) {
            return res.json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' });
        }

        const invitation = await Invitation.findOne({ token });

        if (!invitation) {
            return res.json({ success: false, message: "Lien d'invitation introuvable" });
        }

        if (invitation.utilisee) {
            return res.json({ success: false, message: 'Ce lien a déjà été utilisé' });
        }

        if (invitation.expireA.getTime() < Date.now()) {
            return res.json({ success: false, message: 'Ce lien a expiré, demandez une nouvelle invitation' });
        }

        const compteExistant = await StaffUser.findOne({ email: invitation.email });
        if (compteExistant) {
            return res.json({ success: false, message: 'Un compte existe déjà avec cet email' });
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

        // NOTE Phase 3 : si role === 'commercant', créer automatiquement
        // une Boutique vide et renseigner staffUser.boutiqueId ici.

        invitation.utilisee = true;
        await invitation.save();

        const jwtToken = jwt.sign({ id: staffUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        setStaffTokenCookie(res, jwtToken);

        // otpauthUrl n'est renvoyé qu'ICI, une seule fois, pour générer le
        // QR code de mise en place de l'authentificateur (Google
        // Authenticator / Authy). Il n'est plus jamais renvoyé ensuite.
        const otpauthUrl = authenticator.keyuri(staffUser.email, 'GreenCart', totpSecret);

        return res.json({
            success: true,
            message: 'Compte activé',
            staffUser: toPublicStaff(staffUser),
            totpSetup: { secret: totpSecret, otpauthUrl },
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// POST /api/staff/login — Public (rate-limité)
// ------------------------------------------------------------------ //
export const staffLogin = async (req, res) => {
    try {
        const { email, password, totpCode } = req.body;

        if (typeof email !== 'string' || typeof password !== 'string' || typeof totpCode !== 'string') {
            return res.json({ success: false, message: 'Identifiants invalides' });
        }

        const staffUser = await StaffUser.findOne({ email: email.trim().toLowerCase() });

        if (!staffUser) {
            return res.json({ success: false, message: 'Identifiants invalides' });
        }

        if (staffUser.statut !== 'actif') {
            return res.json({ success: false, message: 'Ce compte est suspendu' });
        }

        const passwordValide = await bcrypt.compare(password, staffUser.password);
        if (!passwordValide) {
            return res.json({ success: false, message: 'Identifiants invalides' });
        }

        const codeValide = authenticator.verify({ token: totpCode, secret: staffUser.totpSecret });
        if (!codeValide) {
            return res.json({ success: false, message: "Code d'authentification invalide" });
        }

        staffUser.derniereConnexion = new Date();
        await staffUser.save();

        const jwtToken = jwt.sign({ id: staffUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        setStaffTokenCookie(res, jwtToken);

        return res.json({ success: true, message: 'Connexion réussie', staffUser: toPublicStaff(staffUser) });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/staff/is-auth — Staff (authStaff)
// ------------------------------------------------------------------ //
export const isStaffAuth = async (req, res) => {
    try {
        return res.json({ success: true, staffUser: toPublicStaff(req.staffUser) });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/staff/logout — Staff
// ------------------------------------------------------------------ //
export const staffLogout = async (req, res) => {
    try {
        res.clearCookie('staffToken', STAFF_COOKIE_OPTIONS);
        return res.json({ success: true, message: 'Déconnexion réussie' });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// ------------------------------------------------------------------ //
// GET /api/staff/comptes — Admin uniquement
// ------------------------------------------------------------------ //
export const listStaffAccounts = async (req, res) => {
    try {
        const comptes = await StaffUser.find().sort('-createdAt').select('-password -totpSecret');
        return res.json({ success: true, comptes });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
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
            return res.json({ success: false, message: 'Statut invalide' });
        }

        if (id === req.staffUser._id.toString()) {
            return res.json({ success: false, message: 'Vous ne pouvez pas modifier votre propre statut' });
        }

        const staffUser = await StaffUser.findById(id);
        if (!staffUser) {
            return res.json({ success: false, message: 'Compte introuvable' });
        }

        staffUser.statut = statut;
        await staffUser.save();

        return res.json({ success: true, message: 'Statut mis à jour', staffUser: toPublicStaff(staffUser) });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
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
            return res.json({ success: false, message: 'Rôle invalide' });
        }

        if (id === req.staffUser._id.toString()) {
            return res.json({ success: false, message: 'Vous ne pouvez pas modifier votre propre rôle' });
        }

        const staffUser = await StaffUser.findById(id);
        if (!staffUser) {
            return res.json({ success: false, message: 'Compte introuvable' });
        }

        staffUser.role = role;
        await staffUser.save();

        return res.json({ success: true, message: 'Rôle mis à jour', staffUser: toPublicStaff(staffUser) });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};