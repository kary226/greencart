import jwt from 'jsonwebtoken';
import { TYPE_VENDEUR, verifierType } from '../utils/jwtTypes.js';

const authSeller = async (req, res, next) => {
    // [MIGRATION cookie httpOnly] Le token vendeur est lu depuis le cookie
    // httpOnly 'sellerToken'. Header Authorization gardé en secours pour
    // compatibilité. Seul le compte technique (SELLER_EMAIL) est accepté ici
    // — un compte staff/admin ne donne pas accès à l'espace seller.
    const token = req.cookies?.sellerToken
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    if (!token) {
        return res.json({ success: false, message: 'Not Authorized - Token manquant' });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        // [SÉCURITÉ] Voir utils/jwtTypes.js — le type est porté par le jeton,
        // il ne se déduit plus de la seule forme du payload.
        if (!verifierType(tokenDecode, TYPE_VENDEUR)) {
            return res.json({ success: false, message: 'Not Authorized - Accès refusé' });
        }

        if (tokenDecode.email === process.env.SELLER_EMAIL) {
            // Posé pour que addProduct (et consorts) distinguent le compte
            // technique du reste — sans ce flag, la logique en aval qui lit
            // req.isTechnicalSeller ne serait jamais vraie.
            req.isTechnicalSeller = true;
            return next();
        }

        return res.json({ success: false, message: 'Not Authorized - Accès refusé' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export default authSeller;