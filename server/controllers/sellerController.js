import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { TYPE_VENDEUR } from '../utils/jwtTypes.js';

// [FIX M3] Comparaison en temps constant pour éviter les attaques par
// mesure de temps (timing attack). Une comparaison '===' classique sur
// des chaînes s'arrête au premier caractère différent, ce qui peut (en
// théorie, avec suffisamment de mesures réseau) laisser fuiter des
// informations sur la longueur ou le contenu du secret comparé.
// crypto.timingSafeEqual prend le même temps quelle que soit la position
// du premier caractère différent.
const safeEqual = (a, b) => {
    const bufA = Buffer.from(String(a ?? ''));
    const bufB = Buffer.from(String(b ?? ''));
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
};

// [MIGRATION cookie httpOnly] Cookie séparé du cookie 'token' de l'espace
// client, pour ne jamais mélanger une session vendeur et une session
// client dans le même navigateur (même logique que l'ancien
// localStorage.setItem('sellerToken', ...), juste transposée en cookie).
//
// [CORRECTIF AUDIT — 23 août 2026] secure/domain étaient figés à leurs
// valeurs de production (secure: true, domain: '.ramci.ci'), contrairement
// à getStaffCookieOptions() dans staffController.js, qui s'adapte déjà à
// l'environnement. Conséquence concrète : en local (localhost, HTTP) ou
// sur une URL de preview Vercel, le navigateur refuse silencieusement de
// stocker ce cookie — `secure: true` exige HTTPS, et `domain: '.ramci.ci'`
// ne correspond à aucun de ces hôtes. Le login répondait "Logged In" (le
// serveur ne voit aucune erreur), mais la requête suivante n'avait plus de
// cookie à envoyer → "Not Authorized" quelques secondes plus tard. Même
// correctif que celui déjà appliqué à staffController.js, jamais reporté
// ici.
const getSellerCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'lax' : 'lax',
        domain: isProduction ? '.ramci.ci' : undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    };
};

const setSellerTokenCookie = (res, token) => {
    res.cookie('sellerToken', token, getSellerCookieOptions());
};

// Login Seller : /api/seller/login
export const sellerLogin = async (req, res) => {
    try {
        const { email, password, totpCode } = req.body;

        // [FIX injection NoSQL] email/password/totpCode doivent être des chaînes.
        if (typeof email !== 'string' || typeof password !== 'string' || typeof totpCode !== 'string') {
            return res.json({ success: false, message: "Invalid Credentials" });
        }

        if (!safeEqual(email, process.env.SELLER_EMAIL) || !safeEqual(password, process.env.SELLER_PASSWORD)) {
            return res.json({ success: false, message: "Invalid Credentials" });
        }

        // [FIX 2FA] Deuxième facteur obligatoire : code à 6 chiffres généré
        // par l'app d'authentification (Google Authenticator / Authy), à
        // partir du secret SELLER_TOTP_SECRET configuré une seule fois.
        // Même si le mot de passe est volé ou deviné, l'accès admin reste
        // protégé sans ce code, qui change toutes les 30 secondes.
        const isValidCode = authenticator.verify({
            token: totpCode,
            secret: process.env.SELLER_TOTP_SECRET
        });

        if (!isValidCode) {
            return res.json({ success: false, message: "Code d'authentification invalide" });
        }

        const token = jwt.sign({ email, typ: TYPE_VENDEUR }, process.env.JWT_SECRET, { expiresIn: '7d' });
        setSellerTokenCookie(res, token);

        return res.json({ success: true, message: "Logged In" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Seller isAuth : /api/seller/is-auth
export const isSellerAuth = async (req, res) => {
    try {
        // L'utilisateur est déjà authentifié par le middleware authSeller
        return res.json({ success: true });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Logout Seller : /api/seller/logout
export const sellerLogout = async (req, res) => {
    try {
        res.clearCookie('sellerToken', getSellerCookieOptions());
        return res.json({ success: true, message: "Logged Out" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};