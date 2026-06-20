import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import connectDB from './configs/db.js';
import 'dotenv/config';
import userRouter from './routes/userRoute.js';
import sellerRouter from './routes/sellerRoute.js';
import connectCloudinary from './configs/cloudinary.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import addressRouter from './routes/addressRoute.js';
import orderRouter from './routes/orderRoute.js';
import { stripeWebhooks } from './controllers/orderController.js';
import bannerRouter from './routes/bannerRoute.js';
import categoryRouter from './routes/categoryRoute.js';
import reviewRouter from './routes/reviewRoute.js';
import wishlistRouter from './routes/wishlistRoute.js';
import couponRouter from './routes/couponRoute.js';
import locationRouter from './routes/locationRoute.js';
import deliveryRouter from './routes/deliveryRoute.js';
import { geniuspayWebhook } from './controllers/geniuspayController.js';
import dns from 'dns';

const app = express();
const port = process.env.PORT || 4000;

dns.setServers(['1.1.1.1', '8.8.8.8']);

await connectDB()
await connectCloudinary()

// Configuration CORS complète
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://greencart-pied-six.vercel.app',
    'https://greencart-ci.vercel.app',
    'https://greencart-five-ochre.vercel.app',
    'https://greencart-y.vercel.app'
];

// Middleware CORS - Version permissive
app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log(`⚠️ Origine non listée mais autorisée: ${origin}`);
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Set-Cookie']
}));

// Gestion des requêtes OPTIONS (preflight)
app.options('*', cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept']
}));

// Route webhook Stripe (doit être avant express.json())
app.post('/stripe', express.raw({type: 'application/json'}), stripeWebhooks)

// Middleware standard
app.use(express.json());
app.use(cookieParser());

// Route de test
app.get('/', (req, res) => res.send("API is Working"));

// Routes API
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

// Webhook GeniusPay — point d'entrée UNIQUE, signature HMAC vérifiée
// dans geniuspayWebhook (voir controllers/geniuspayController.js).
app.post('/api/geniuspay/webhook', express.json(), geniuspayWebhook);

// ============================================================
// [FIX C1/C2] La route ci-dessous a été SUPPRIMÉE :
//   app.post('/api/order/geniuspay/initiate', geniuspayInitiate);
//
// Elle dupliquait la route déjà déclarée dans orderRoute.js
// (orderRouter.post('/geniuspay/initiate', authUser, initiateGeniusPay))
// mais SANS le middleware authUser — un attaquant non connecté
// pouvait donc initier des paiements/commandes directement sur
// ce endpoint, contournant entièrement l'authentification et
// rendant inutile le 'userId' attendu par le contrôleur.
//
// Le seul point d'entrée pour initier un paiement GeniusPay est
// désormais : POST /api/order/geniuspay/initiate (monté via
// orderRouter, protégé par authUser).
// ============================================================

// Démarrage du serveur
app.listen(port, ()=>{
    console.log(`Server is running on http://localhost:${port}`);
});

// EXPORT POUR VERCEL (SERVERLESS FUNCTIONS)
export default app;