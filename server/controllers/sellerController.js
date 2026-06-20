import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// [FIX M3] Comparaison en temps constant pour éviter les attaques par
// mesure de temps (timing attack). Une comparaison '===' classique sur
// des chaînes s'arrête au premier caractère différent, ce qui peut (en
// théorie, avec suffisamment de mesures réseau) laisser fuiter des
// informations sur la longueur ou le contenu du secret comparé.
// crypto.timingSafeEqual prend le même temps quelle que soit la position
// du premier caractère différent.
const safeEqual = (a, b) => {
    const bufA = Buffer.from(String(a ?? ''));
    const bufB = Buffer.from(String(b ?? ''));
    // timingSafeEqual exige des buffers de même longueur ; on compare
    // d'abord les longueurs (cette comparaison-là n'a pas besoin d'être
    // constante : la longueur d'un mot de passe correct n'est pas un
    // secret aussi sensible que son contenu), puis le contenu en temps
    // constant uniquement si les longueurs correspondent.
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
};

// Login Seller : /api/seller/login
export const sellerLogin = async (req, res) =>{
    try {
        const { email, password } = req.body;

        if(safeEqual(email, process.env.SELLER_EMAIL) && safeEqual(password, process.env.SELLER_PASSWORD)){
            const token = jwt.sign({email}, process.env.JWT_SECRET, {expiresIn: '7d'});

            // Retourner le token (pas de cookie)
            return res.json({ success: true, message: "Logged In", token });
        }else{
            return res.json({ success: false, message: "Invalid Credentials" });
        }
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// Seller isAuth : /api/seller/is-auth
export const isSellerAuth = async (req, res)=>{
    try {
        // L'utilisateur est déjà authentifié par le middleware authSeller
        return res.json({success: true})
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// Logout Seller : /api/seller/logout
export const sellerLogout = async (req, res)=>{
    try {
        // Plus de cookie à nettoyer, juste retourner succès
        return res.json({ success: true, message: "Logged Out" })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}