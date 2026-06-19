import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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

// --- Middleware CORS strict ---
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://greencart-pied-six.vercel.app',
    'https://greencart-ci.vercel.app',
    'https://greencart-five-ochre.vercel.app',
    'https://greencart-y.vercel.app'
];

app.use(cors({
    origin: function(origin, callback) {
        // Autoriser les requêtes sans origine (ex: Postman, serveur->serveur)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Origine non autorisée par CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Set-Cookie']
}));

// Webhook Stripe (doit être AVANT le parsing JSON standard)
app.post('/stripe', express.raw({type: 'application/json'}), stripeWebhooks)

// Parsing standard
app.use(express.json());
app.use(cookieParser());

// En-têtes de sécurité avec Helmet
app.use(helmet());

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

// Webhook GeniusPay (protégé par signature dans le contrôleur)
app.post('/api/geniuspay/webhook', express.json(), geniuspayWebhook);

// L'initiation GeniusPay est déjà protégée dans orderRouter,
// suppression de la route redondante et non authentifiée.

// Démarrage
app.listen(port, ()=>{
    console.log(`Server is running on http://localhost:${port}`);
});

export default app;