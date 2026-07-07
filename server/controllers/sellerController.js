import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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
const SELLER_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    domain: '.ramci.ci',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

const setSellerTokenCookie = (res, token) => {
    res.cookie('sellerToken', token, SELLER_COOKIE_OPTIONS);
};

// Login Seller : /api/seller/login
export const sellerLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // [FIX injection NoSQL] email/password doivent être des chaînes.
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.json({ success: false, message: "Invalid Credentials" });
        }

        if (safeEqual(email, process.env.SELLER_EMAIL) && safeEqual(password, process.env.SELLER_PASSWORD)) {
            const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });
            setSellerTokenCookie(res, token);

            return res.json({ success: true, message: "Logged In" });
        } else {
            return res.json({ success: false, message: "Invalid Credentials" });
        }
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
        res.clearCookie('sellerToken', SELLER_COOKIE_OPTIONS);
        return res.json({ success: true, message: "Logged Out" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};