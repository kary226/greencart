import jwt from 'jsonwebtoken';

const authSeller = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log("=== AUTH SELLER ===");
    console.log("authHeader:", authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("❌ Token manquant ou mal formé");
        return res.json({ success: false, message: 'Not Authorized - Token manquant' });
    }
    
    const token = authHeader.split(' ')[1];
    console.log("Token reçu:", token.substring(0, 50) + "...");

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Token décodé:", tokenDecode);
        console.log("SELLER_EMAIL attendu:", process.env.SELLER_EMAIL);
        
        if (tokenDecode.email === process.env.SELLER_EMAIL) {
            console.log("✅ Admin authentifié");
            next();
        } else {
            console.log("❌ Email invalide");
            return res.json({ success: false, message: 'Not Authorized - Email invalide' });
        }
    } catch (error) {
        console.log("❌ Erreur JWT:", error.message);
        res.json({ success: false, message: error.message });
    }
};

export default authSeller;