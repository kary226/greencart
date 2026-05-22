import jwt from 'jsonwebtoken';

const authUser = async (req, res, next) => {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json({ success: false, message: 'Not Authorized - Token manquant' });
    }
    
    const token = authHeader.split(' ')[1];

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        if (tokenDecode.id) {
            req.body.userId = tokenDecode.id;
        } else {
            return res.json({ success: false, message: 'Not Authorized - Token invalide' });
        }
        next();
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export default authUser;