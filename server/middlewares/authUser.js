import jwt from 'jsonwebtoken';

const authUser = async (req, res, next) => {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // ✅ Renvoyer une réponse 401 avec indicateur de redirection
        return res.status(401).json({ 
            success: false, 
            message: 'Veuillez vous connecter pour continuer',
            redirectToLogin: true 
        });
    }
    
    const token = authHeader.split(' ')[1];

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
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
        // ✅ Gestion des erreurs de token (expiré, invalide)
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