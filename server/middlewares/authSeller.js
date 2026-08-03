import jwt from 'jsonwebtoken';
import StaffUser from '../models/StaffUser.js';

const authSeller = async (req, res, next) => {
    console.log('🔍 authSeller - cookies:', req.cookies);
    console.log('🔍 authSeller - sellerToken:', req.cookies?.sellerToken);
    console.log('🔍 authSeller - staffToken:', req.cookies?.staffToken);
    
    const token = req.cookies?.sellerToken
        || req.cookies?.staffToken
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    console.log('🔍 authSeller - token extrait:', token ? 'Présent' : 'Manquant');

    if (!token) {
        return res.json({ success: false, message: 'Not Authorized - Token manquant' });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔍 authSeller - tokenDecode:', tokenDecode);

        // ✅ Cas 1 : C'est le seller technique (SELLER_EMAIL)
        if (tokenDecode.email === process.env.SELLER_EMAIL) {
            // ✅ AJOUT : Définir req.user pour que productController le reconnaisse
            req.user = { email: tokenDecode.email, role: 'seller' };
            console.log('✅ authSeller - Seller authentifié');
            return next();
        }

        // ✅ Cas 2 : C'est un StaffUser avec le rôle 'admin'
        if (tokenDecode.id) {
            const staffUser = await StaffUser.findById(tokenDecode.id).select('role');
            if (staffUser && staffUser.role === 'admin') {
                // ✅ AJOUT : Définir req.user pour que productController le reconnaisse
                req.user = { id: tokenDecode.id, email: tokenDecode.email, role: 'admin' };
                console.log('✅ authSeller - Admin Staff authentifié');
                return next();
            }
        }

        // ❌ Accès refusé
        console.log('❌ authSeller - Accès refusé');
        return res.json({ success: false, message: 'Not Authorized - Accès refusé' });
    } catch (error) {
        console.error('❌ authSeller - Erreur:', error.message);
        res.json({ success: false, message: error.message });
    }
};

export default authSeller;