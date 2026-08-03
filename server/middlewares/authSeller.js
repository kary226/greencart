import jwt from 'jsonwebtoken';
import StaffUser from '../models/StaffUser.js';

const authSeller = async (req, res, next) => {
    // ✅ Accepter le cookie sellerToken OU staffToken
    const token = req.cookies?.sellerToken
        || req.cookies?.staffToken
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    if (!token) {
        return res.json({ success: false, message: 'Not Authorized - Token manquant' });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        // ✅ Cas 1 : C'est le seller technique (SELLER_EMAIL)
        if (tokenDecode.email === process.env.SELLER_EMAIL) {
            return next();
        }

        // ✅ Cas 2 : C'est un StaffUser avec le rôle 'admin'
        if (tokenDecode.id) {
            const staffUser = await StaffUser.findById(tokenDecode.id).select('role');
            if (staffUser && staffUser.role === 'admin') {
                return next();
            }
        }

        // ❌ Accès refusé
        return res.json({ success: false, message: 'Not Authorized - Accès refusé' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export default authSeller;