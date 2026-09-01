import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import connectDB from './configs/db.js';
import connectCloudinary from './configs/cloudinary.js';
import 'dotenv/config';
import { handleJekoWebhook } from './controllers/jekoController.js';
import dns from 'dns';

// ─── Routes conservées ────────────────────────────────────────────────

// Routes spécifiques (Shein, client, webhook)
import sheinCartRouter from './routes/sheinCartRoute.js';
import colisSheinAdminRouter from './routes/colisSheinAdminRoute.js';
import cartRouter from './routes/cartRoute.js';
import addressRouter from './routes/addressRoute.js';
import reviewRouter from './routes/reviewRoute.js';
import wishlistRouter from './routes/wishlistRoute.js';
import pushRouter from './routes/pushRoute.js';
import journalRouter from './routes/journalRoute.js';
import messageColisRouter from './routes/messageColisRoute.js';

// Routes commerçant / livreur / assistant (hors console admin)
import walletRouter from './routes/walletRoute.js';
import retraitRouter from './routes/retraitRoute.js';

// ⚠️ RÉTABLI : routes historiques encore appelées par le frontend
// (le frontend n'a jamais été migré vers /api/admin/* lors de la Phase 7)
import productRouter from './routes/productRoute.js';
import orderRouter from './routes/orderRoute.js';
import settingRouter from './routes/settingRoute.js';
import staffRouter from './routes/staffRoute.js';
import userRouter from './routes/userRoute.js';
import categoryRouter from './routes/categoryRoute.js';
import couponRouter from './routes/couponRoute.js';
import bannerRouter from './routes/bannerRoute.js';
import locationRouter from './routes/locationRoute.js';
import deliveryRouter from './routes/deliveryRoute.js';
import boutiqueRouter from './routes/boutiqueRoute.js';
import metricsRouter from './routes/metricsRoute.js';

// 🔵 ROUTE ADMIN UNIFIÉE (TOUT LE RESTE)
import adminRouter from './routes/adminRoutes.js';
// [RAMCI 14] Console : ce que le compte connecte doit faire maintenant.
import consoleRouter from './routes/consoleRoute.js';

// Middlewares
import requestMetrics from './middlewares/requestMetrics.js';
import { estOperationnelle } from './utils/AppError.js';

const app = express();
const port = process.env.PORT || 4000;

// [SÉCURITÉ] Vercel place l'app derrière un seul proxy inverse qui pose
// X-Forwarded-For. Sans ce réglage, Express ignore cet en-tête (défaut :
// false) et express-rate-limit ne peut pas isoler l'IP réelle du client.
app.set('trust proxy', 1);
dns.setServers(['1.1.1.1', '8.8.8.8']);

await connectDB();
await connectCloudinary();

// ─── Middlewares ──────────────────────────────────────────────────────

app.use(requestMetrics());

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

// Webhook Jèko
app.post('/api/jeko/webhook', express.raw({ type: 'application/json' }), handleJekoWebhook);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
}));

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());

// ─── Routes ──────────────────────────────────────────────────────────

app.get('/', (req, res) => res.send('API is Working'));

// 🔵 ROUTES SPÉCIFIQUES (conservées)
app.use('/api/shein-cart/admin', colisSheinAdminRouter);
app.use('/api/shein-cart', sheinCartRouter);
app.use('/api/cart', cartRouter);
app.use('/api/address', addressRouter);
app.use('/api/review', reviewRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/push', pushRouter);
app.use('/api/journal', journalRouter);
app.use('/api/message-colis', messageColisRouter);

// 🔵 ROUTES COMMERCANT / LIVREUR / ASSISTANT (hors console admin)
app.use('/api/console', consoleRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/retraits', retraitRouter);

// ⚠️ RÉTABLI : routes historiques encore appelées par le frontend
app.use('/api/product', productRouter);
app.use('/api/order', orderRouter);
app.use('/api/setting', settingRouter);
app.use('/api/staff', staffRouter);
app.use('/api/user', userRouter);
app.use('/api/category', categoryRouter);
app.use('/api/coupon', couponRouter);
app.use('/api/banner', bannerRouter);
app.use('/api/location', locationRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/boutiques', boutiqueRouter);
app.use('/api/metrics', metricsRouter);

// 🔵 ROUTE ADMIN UNIFIÉE (TOUT EST ICI)
app.use('/api/admin', adminRouter);

// ─── Gestion des erreurs ─────────────────────────────────────────────

app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint inexistant' });
});

app.use((err, req, res, next) => {
    if (err && err.message === 'Origine non autorisée par CORS') {
        return res.status(403).json({ success: false, message: 'Origine non autorisée' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'Les données envoyées sont trop volumineuses.'
        });
    }
    if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: err.message });
    }
    if (estOperationnelle(err)) {
        console.warn(JSON.stringify({
            type: 'warn',
            ts: new Date().toISOString(),
            method: req.method,
            route: req.originalUrl?.split('?')[0],
            status: err.statusCode,
            message: err.message,
        }));
        return res.status(err.statusCode || 400).json({
            success: false,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
        });
    }
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

// ─── Démarrage ────────────────────────────────────────────────────────

app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
    console.log(`📊 Admin routes mounted on /api/admin`);
});

export default app;