import jwt from 'jsonwebtoken';

const authSeller = async (req, res, next) => {
    // [MIGRATION cookie httpOnly] Le token vendeur est maintenant lu depuis
    // le cookie httpOnly 'sellerToken'. Header Authorization gardé en
    // secours pour compatibilité.
    const token = req.cookies?.sellerToken
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    if (!token) {
        return res.json({ success: false, message: 'Not Authorized - Token manquant' });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if (tokenDecode.email === process.env.SELLER_EMAIL) {
            next();
        } else {
            return res.json({ success: false, message: 'Not Authorized - Email invalide' });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export default authSeller;