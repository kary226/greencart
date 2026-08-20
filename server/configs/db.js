import mongoose from "mongoose";

// Connection pooling pour Vercel Serverless
// Evite d'ouvrir une nouvelle connexion à chaque requête

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    // Si une connexion existe déjà, on la réutilise
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,

            // [CAPACITÉ] Nombre de connexions qu'UNE instance serverless
            // réserve à la base. Atlas M0 plafonne à 500 connexions au TOTAL,
            // toutes instances confondues — c'est la limite dure du palier
            // gratuit.
            //
            // À 10, il suffisait de ~50 instances Vercel simultanées pour
            // épuiser ces 500 connexions : au-delà, Atlas refuse, et le site
            // renvoie des erreurs à tout le monde. À 5, il en faut ~100 :
            // le plafond de trafic double, sans changer de palier ni payer.
            //
            // Ce n'est pas un compromis coûteux ici : le cache Redis
            // (catalogue, catégories, bannières) fait que la majorité des
            // pages ne touchent pas la base. Une instance réservait donc 10
            // connexions pour n'en utiliser qu'une ou deux — on récupère du
            // gaspillage, pas de la capacité utile.
            //
            // À remonter le jour d'un passage sur un palier dédié (M10 et
            // au-delà : 1 500 connexions), où la contrainte disparaît.
            maxPoolSize: 5,

            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        mongoose.connection.on('connected', () => console.log("✅ Database Connected"));
        mongoose.connection.on('error', (err) => console.error("❌ DB Error:", err));

        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts);
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        cached.promise = null;
        console.error("❌ DB Connection failed:", error.message);
        throw error;
    }

    return cached.conn;
};

export default connectDB;
