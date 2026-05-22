import jwt from 'jsonwebtoken';

const authSeller = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json({ success: false, message: 'Not Authorized - Token manquant' });
    }
    
    const token = authHeader.split(' ')[1];

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