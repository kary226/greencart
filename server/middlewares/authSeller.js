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

    // [SÉCURITÉ] Code HTTP 401 sur un refus, pas 200. `res.json(...)` sans
    // `.status()` renvoyait « 200 OK » avec un corps « accès refusé » : la
    // requête était bien bloquée (aucune donnée ne sortait), mais une réponse
    // qui dit « OK » sur un refus casse la sémantique HTTP et trompe caches,
    // supervision et clients d'API.
    if (!token) {
        return res.status(401).json({ success: false, message: 'Not Authorized - Token manquant' });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        // [SÉCURITÉ] Voir utils/jwtTypes.js — le type est porté par le jeton,
        // il ne se déduit plus de la seule forme du payload.
        if (!verifierType(tokenDecode, TYPE_VENDEUR)) {
            return res.status(403).json({ success: false, message: 'Not Authorized - Accès refusé' });
        }

        if (tokenDecode.email === process.env.SELLER_EMAIL) {
            // Posé pour que addProduct (et consorts) distinguent le compte
            // technique du reste — sans ce flag, la logique en aval qui lit
            // req.isTechnicalSeller ne serait jamais vraie.
            req.isTechnicalSeller = true;
            return next();
        }

        return res.status(403).json({ success: false, message: 'Not Authorized - Accès refusé' });
    } catch {
        // [SÉCURITÉ] On ne renvoie plus `error.message` : « invalid signature »,
        // « jwt malformed » etc. renseignent un attaquant sur le mécanisme. Un
        // message générique suffit au client légitime.
        return res.status(401).json({ success: false, message: 'Not Authorized - Token invalide' });
    }
};

export default authSeller;