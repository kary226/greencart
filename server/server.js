import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import connectDB from './configs/db.js';
import 'dotenv/config';
import userRouter from './routes/userRoute.js';
import sellerRouter from './routes/sellerRoute.js';
import connectCloudinary from './configs/cloudinary.js';
import sheinCartRouter from './routes/sheinCartRoute.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import addressRouter from './routes/addressRoute.js';
import orderRouter from './routes/orderRoute.js';
import bannerRouter from './routes/bannerRoute.js';
import categoryRouter from './routes/categoryRoute.js';
import reviewRouter from './routes/reviewRoute.js';
import wishlistRouter from './routes/wishlistRoute.js';
import couponRouter from './routes/couponRoute.js';
import locationRouter from './routes/locationRoute.js';
import deliveryRouter from './routes/deliveryRoute.js';
import settingRouter from './routes/settingRoute.js';
import pushRouter from './routes/pushRoute.js';
import staffRouter from './routes/staffRoute.js';
import { geniuspayWebhook } from './controllers/geniuspayController.js';
import { handleJekoWebhook } from './controllers/jekoController.js';
import dns from 'dns';

// [PHASE 3 - OBSERVABILITÉ] Mesure des temps de réponse
import requestMetrics from './middlewares/requestMetrics.js';
import metricsRouter from './routes/metricsRoute.js';

// PHASE 3 - Routes Commerçant
import boutiqueRouter from './routes/boutiqueRoute.js';
import walletRouter from './routes/walletRoute.js';
import retraitRouter from './routes/retraitRoute.js';

// PHASE 5 - Routes Assistant Shein
import colisSheinAdminRouter from './routes/colisSheinAdminRoute.js';
import messageColisRouter from './routes/messageColisRoute.js';

const app = express();
const port = process.env.PORT || 4000;

dns.setServers(['1.1.1.1', '8.8.8.8']);

await connectDB()
await connectCloudinary()

// [PHASE 3 - OBSERVABILITÉ] Monté en tout premier pour que la durée mesurée
// couvre réellement l'intégralité du traitement (CORS, compression, parsing
// du body, contrôleur), et pas seulement la partie métier. Le middleware
// n'ajoute rien au chemin critique : il ne fait qu'enregistrer un timestamp
// et pose un listener exécuté après l'envoi de la réponse.
app.use(requestMetrics());

// Configuration CORS complète
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://greencart-pied-six.vercel.app',
    'https://greencart-ci.vercel.app',
    'https://greencart-five-ochre.vercel.app',
    'https://greencart-y.vercel.app',
    'https://ramci.vercel.app',
    'https://ramci.ci',
    'https://www.ramci.ci'
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origine non autorisée par CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Set-Cookie']
}));

// Webhook GeniusPay
app.post('/api/geniuspay/webhook', express.raw({ type: 'application/json' }), geniuspayWebhook);

// Webhook Jèko — handleJekoWebhook n'est encore qu'un squelette (voir
// jekoController.js), mais la route existe déjà pour que tu puisses
// configurer l'URL côté Jèko dès maintenant.
app.post('/api/jeko/webhook', express.raw({ type: 'application/json' }), handleJekoWebhook);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
}));

// [PHASE 0 - PERF] Compression gzip/brotli des réponses (JSON, HTML, etc.)
// Coût CPU négligeable comparé au gain réseau, surtout utile pour les
// grosses réponses (listings produits paginés, etc.). Placé tôt dans la
// chaîne pour compresser toutes les routes API en dessous.
app.use(compression());

// [PHASE 2 - PERF] Limite de payload resserrée pour les routes JSON/urlencoded.
// Les 150MB historiques n'ont jamais servi qu'aux uploads d'images/vidéos,
// qui passent par Multer (multipart/form-data, limite dédiée dans
// configs/multer.js) et ne transitent donc jamais par ces middlewares.
// Appliquer 150MB ici exposait toutes les routes JSON (login, panier,
// commande, etc.) à des requêtes anormalement volumineuses pour rien.
// 2MB reste très large pour n'importe quel payload JSON légitime du site.
app.use(express.json({ 
    limit: '2mb'
}));
app.use(express.urlencoded({ 
    limit: '2mb', 
    extended: true 
}));
app.use(cookieParser());

// [FIX défense en profondeur] Nettoie automatiquement req.body/req.query/
app.use(mongoSanitize());

// Route de test
app.get('/', (req, res) => res.send("API is Working"));

// Routes API
app.use('/api/shein-cart', sheinCartRouter);
app.use('/api/user', userRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/address', addressRouter);
app.use('/api/order', orderRouter);
app.use('/api/banner', bannerRouter);
app.use('/api/category', categoryRouter);
app.use('/api/review', reviewRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/coupon', couponRouter);
app.use('/api/location', locationRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/setting', settingRouter);
app.use('/api/push', pushRouter);
app.use('/api/staff', staffRouter);

// PHASE 3 - Routes Commerçant
app.use('/api/boutiques', boutiqueRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/retraits', retraitRouter);

// PHASE 5 - Routes Assistant Shein
app.use('/api/shein-cart/admin', colisSheinAdminRouter);
app.use('/api/message-colis', messageColisRouter);

// [PHASE 3 - OBSERVABILITÉ] Lecture des métriques (protégée, voir le routeur)
app.use('/api/metrics', metricsRouter);

// ✅ AJOUT : Gestionnaire d'erreur global pour les uploads
app.use((err, req, res, next) => {
    // Erreur CORS
    if (err && err.message === 'Origine non autorisée par CORS') {
        return res.status(403).json({ success: false, message: 'Origine non autorisée' });
    }
    
    // Erreur de taille de payload (JSON/urlencoded — voir limite resserrée plus haut)
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ 
            success: false, 
            message: 'Les données envoyées sont trop volumineuses.' 
        });
    }
    
    // Erreur Multer déjà gérée dans productRoute.js
    if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ 
            success: false, 
            message: err.message 
        });
    }
    
    // Erreur inattendue
    // [PHASE 3 - OBSERVABILITÉ] Log structuré en plus du message lisible :
    // même format `type`/`ts`/`route` que les logs de requêtes, pour pouvoir
    // filtrer `type=error` dans les logs Vercel et corréler un pic d'erreurs
    // avec un pic de latence sur la même route.
    console.error(JSON.stringify({
        type: 'error',
        ts: new Date().toISOString(),
        method: req.method,
        route: req.originalUrl?.split('?')[0],
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
    }));
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
    });
});

// Démarrage du serveur
app.listen(port, ()=>{
    console.log(`Server is running on http://localhost:${port}`);
});

// EXPORT POUR VERCEL (SERVERLESS FUNCTIONS)
export default app;