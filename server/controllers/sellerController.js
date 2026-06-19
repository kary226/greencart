import jwt from 'jsonwebtoken';

// Login Seller : /api/seller/login
export const sellerLogin = async (req, res) =>{
    try {
        const { email, password } = req.body;

        if(password === process.env.SELLER_PASSWORD && email === process.env.SELLER_EMAIL){
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