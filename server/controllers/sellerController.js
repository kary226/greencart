import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Fonction utilitaire pour une comparaison en temps constant
const safeEqual = (a, b) => {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    // Si les longueurs diffèrent, on retourne false immédiatement (pas de risque de timing exploitable)
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

// Login Seller : /api/seller/login
export const sellerLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (safeEqual(email, process.env.SELLER_EMAIL) && safeEqual(password, process.env.SELLER_PASSWORD)) {
            const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });
            return res.json({ success: true, message: "Logged In", token });
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
        return res.json({ success: true });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Logout Seller : /api/seller/logout
export const sellerLogout = async (req, res) => {
    try {
        return res.json({ success: true, message: "Logged Out" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};