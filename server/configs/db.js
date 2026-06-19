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
            maxPoolSize: 10,        // Max 10 connexions simultanées par instance
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
