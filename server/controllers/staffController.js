import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import StaffUser from '../models/StaffUser.js';
import { NOMS_ROLES } from '../configs/roles.js';
import Invitation from '../models/Invitation.js';
import Boutique from '../models/Boutique.js';
import Wallet from '../models/Wallet.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import WalletTransaction from '../models/WalletTransaction.js';
import DemandeRetrait from '../models/DemandeRetrait.js';
import {
    assurerBoutiqueCommercant,
    invaliderCacheBoutiquesSuspendues,
} from '../services/boutiqueService.js';
import { sendStaffInvitationEmail } from '../configs/email.js';
import { TYPE_STAFF } from '../utils/jwtTypes.js';
import { journaliser } from '../services/journalService.js';

// [FIX] Cette liste était recopiée à la main ici, séparément de la vraie
// source (NOMS_ROLES, dérivée de configs/roles.js — la même que le schéma
// StaffUser utilise pour son enum). Elle avait fini par diverger :
// "operations_admin" existait bien comme rôle réel mais manquait ici,
// donc toute tentative de créer ou modifier un compte avec ce rôle
// échouait avec "Rôle invalide". On utilise directement NOMS_ROLES —
// une seule liste, plus de copie qui peut se désynchroniser.
const ROLES_VALIDES = NOMS_ROLES;
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
    // [CORRECTIF] Les permissions manquaient ici, alors que la console les
    // lit sur cette réponse pour construire son menu. Résultat : le menu
    // était VIDE pour tout rôle granulaire — Finance, Opérations, Auditeur
    // ne voyaient que « À faire ». Seul le Super Admin s'en sortait, parce
    // que le layout le laisse passer sur son rôle sans regarder ses droits.
    //
    // `permissions` est posé par authStaff (loadPermissions), donc toujours
    // présent sur req.staffUser ; le repli protège les autres appelants de
    // cette fonction, qui travaillent parfois sur un document brut.
    permissions: staffUser.permissions || [],
});

// ------------------------------------------------------------------ //
// POST /api/staff/invitations — Admin uniquement
// [PHASE 0] Journalisation ajoutée
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

        // [PHASE 0] Journalisation
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'staff.invitation',
            cible: {
                id: invitation._id,
                libelle: emailNormalise,
            },
            note: `Rôle invité: ${role}`,
        });

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

        // Invitation « commerçant » = boutique + portefeuille créés d'office.
        // Le commerçant n'a plus qu'à renseigner lui-même le nom définitif,
        // la description, le logo et ses zones de livraison depuis « Ma
        // boutique ». Passe par le service pour rester identique aux autres
        // chemins de création (promotion de rôle, auto-réparation).
        await assurerBoutiqueCommercant(staffUser);

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
// [PHASE 0] Journalisation ajoutée
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

        // Suspendre le compte d'un commerçant retire aussi ses articles du
        // catalogue public (personne ne peut plus les expédier) — la liste
        // des boutiques masquées est mise en cache, on la réinitialise.
        if (staffUser.role === 'commercant') {
            await invaliderCacheBoutiquesSuspendues();
        }

        // [PHASE 0] Journalisation
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'staff.statut',
            cible: {
                id: staffUser._id,
                libelle: staffUser.email,
            },
            note: `Nouveau statut: ${statut}`,
        });

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
// [PHASE 0] Journalisation ajoutée
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

        // Un compte promu commerçant reçoit sa boutique et son portefeuille
        // ici, sinon il resterait bloqué partout faute de boutiqueId.
        if (role === 'commercant') {
            await assurerBoutiqueCommercant(staffUser);
        }

        // Le catalogue public masque les boutiques dont le compte n'est pas
        // actif : un changement de rôle peut faire entrer ou sortir une
        // boutique de cette liste.
        await invaliderCacheBoutiquesSuspendues();

        // [PHASE 0] Journalisation
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'staff.role',
            cible: {
                id: staffUser._id,
                libelle: staffUser.email,
            },
            note: `Nouveau rôle: ${role}`,
        });

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


// ------------------------------------------------------------------ //
// GET /api/staff/comptes/:id/suppression — Admin uniquement
// ------------------------------------------------------------------ //
// Aperçu de ce que la suppression va emporter, et des raisons éventuelles
// de la refuser. L'admin voit exactement ce qu'il détruit AVANT de cliquer.
export const getSuppressionApercu = async (req, res) => {
    try {
        const { id } = req.params;

        const staffUser = await StaffUser.findById(id).select('-password -totpSecret');
        if (!staffUser) {
            return res.status(404).json({ success: false, message: 'Compte introuvable' });
        }

        const apercu = await construireApercuSuppression(staffUser);

        return res.status(200).json({
            success: true,
            compte: toPublicStaff(staffUser),
            ...apercu,
        });
    } catch (error) {
        console.error('Erreur getSuppressionApercu:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Ce que la suppression d'un compte emporte, et ce qui l'empêche.
//
// Deux garde-fous, tous deux liés à de l'argent réel :
//   - un portefeuille non vide (la plateforme doit encore cet argent) ;
//   - une demande de retrait en attente (dossier ouvert côté admin).
// Dans les deux cas, l'admin règle d'abord, supprime ensuite. En attendant,
// il lui reste la suspension, qui coupe l'activité immédiatement.
const construireApercuSuppression = async (staffUser) => {
    if (staffUser.role !== 'commercant') {
        return { boutique: null, nombreProduits: 0, nombreCoupons: 0, soldeWallet: 0, retraitsEnAttente: 0, bloquants: [] };
    }

    const boutique = await Boutique.findOne({ ownerId: staffUser._id }).select('nom statut').lean();
    const wallet = await Wallet.findOne({ ownerId: staffUser._id }).select('solde').lean();

    const [nombreProduits, nombreCoupons, retraitsEnAttente] = await Promise.all([
        boutique ? Product.countDocuments({ boutiqueId: boutique._id }) : 0,
        boutique ? Coupon.countDocuments({ boutiqueId: boutique._id }) : 0,
        DemandeRetrait.countDocuments({ commercialId: staffUser._id, statut: 'en_attente' }),
    ]);

    const soldeWallet = wallet?.solde || 0;
    const bloquants = [];
    if (soldeWallet > 0) {
        bloquants.push(`Portefeuille non soldé : ${soldeWallet.toLocaleString('fr-FR')} FCFA restent dus au commerçant.`);
    }
    if (retraitsEnAttente > 0) {
        bloquants.push(`${retraitsEnAttente} demande(s) de retrait encore en attente de traitement.`);
    }

    return { boutique, nombreProduits, nombreCoupons, soldeWallet, retraitsEnAttente, bloquants };
};

// ------------------------------------------------------------------ //
// DELETE /api/staff/comptes/:id — Admin uniquement
// [PHASE 0] Journalisation ajoutée
// ------------------------------------------------------------------ //
export const deleteStaffAccount = async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.staffUser._id.toString()) {
            return res.status(403).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
        }

        const staffUser = await StaffUser.findById(id);
        if (!staffUser) {
            return res.status(404).json({ success: false, message: 'Compte introuvable' });
        }

        // Ne jamais se retrouver sans aucun administrateur actif : plus
        // personne ne pourrait alors inviter ni gérer qui que ce soit.
        if (['admin', 'super_admin'].includes(staffUser.role)) {
            const autresAdmins = await StaffUser.countDocuments({
                _id: { $ne: staffUser._id },
                role: { $in: ['admin', 'super_admin'] },
                statut: 'actif',
            });
            if (autresAdmins === 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Impossible de supprimer le dernier administrateur actif',
                });
            }
        }

        const { boutique, bloquants } = await construireApercuSuppression(staffUser);

        if (bloquants.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Suppression impossible. ${bloquants.join(' ')} Suspendez le compte en attendant.`,
                bloquants,
            });
        }

        // [PHASE 0] Journalisation avant la suppression
        await journaliser({
            acteur: {
                id: req.staffUser._id,
                nom: req.staffUser.nom,
                role: req.staffUser.role,
            },
            action: 'staff.suppression',
            cible: {
                id: staffUser._id,
                libelle: staffUser.email,
            },
            note: `Compte supprimé (rôle: ${staffUser.role})`,
        });

        if (boutique) {
            // Les articles ne sont PAS effacés : ils sont référencés par des
            // commandes passées, dont l'historique doit rester lisible côté
            // client comme côté comptabilité. On les archive (invisibles au
            // catalogue, hors stock), ce que fait déjà la corbeille produits.
            await Product.updateMany(
                { boutiqueId: boutique._id },
                { $set: { isArchived: true, inStock: false } }
            );
            // Les coupons, eux, n'ont plus aucun sens sans la boutique.
            await Coupon.deleteMany({ boutiqueId: boutique._id });
            await Boutique.deleteOne({ _id: boutique._id });
        }

        const wallet = await Wallet.findOne({ ownerId: staffUser._id });
        if (wallet) {
            await WalletTransaction.deleteMany({ walletId: wallet._id });
            await Wallet.deleteOne({ _id: wallet._id });
        }

        // Demandes déjà traitées : historique de paiement, on les garde.
        await DemandeRetrait.deleteMany({ commercialId: staffUser._id, statut: 'en_attente' });

        // Invitations non utilisées à cette adresse : sinon un vieux lien
        // permettrait de recréer le compte qu'on vient de supprimer.
        await Invitation.deleteMany({ email: staffUser.email, utilisee: false });

        await StaffUser.deleteOne({ _id: staffUser._id });

        await invaliderCacheBoutiquesSuspendues();

        return res.status(200).json({
            success: true,
            message: `Compte de ${staffUser.nom} supprimé`,
        });
    } catch (error) {
        console.error('Erreur deleteStaffAccount:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};