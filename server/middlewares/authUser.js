import jwt from 'jsonwebtoken';
import { TYPE_CLIENT, verifierType } from '../utils/jwtTypes.js';

const authUser = async (req, res, next) => {
    // [MIGRATION cookie httpOnly] Le token est maintenant lu depuis le
    // cookie httpOnly 'token' (posé par login/register/googleAuth).
    // On garde une lecture du header Authorization en secours (compatibilité
    // avec d'éventuels appels API externes), mais le cookie est la source
    // normale désormais.
    const token = req.cookies?.token
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Veuillez vous connecter pour continuer',
            redirectToLogin: true
        });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        // [SÉCURITÉ] Un jeton vendeur ou staff ne doit pas ouvrir l'espace
        // client : les trois partagent le même secret de signature, donc la
        // signature seule ne les distingue pas (voir utils/jwtTypes.js).
        if (!verifierType(tokenDecode, TYPE_CLIENT)) {
            return res.status(401).json({
                success: false,
                message: 'Session invalide pour cet espace',
                redirectToLogin: true
            });
        }

        if (tokenDecode.id) {
            req.body.userId = tokenDecode.id;
        } else {
            return res.status(401).json({
                success: false,
                message: 'Session expirée, veuillez vous reconnecter',
                redirectToLogin: true
            });
        }
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expirée, veuillez vous reconnecter',
                redirectToLogin: true
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Token invalide, veuillez vous reconnecter',
            redirectToLogin: true
        });
    }
};

export default authUser;