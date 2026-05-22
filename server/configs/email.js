import nodemailer from 'nodemailer';

// Vérification que les variables SMTP sont configurées
const isSMTPConfigured = () => {
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.warn(`⚠️ Variables SMTP manquantes: ${missing.join(', ')}. Les emails ne seront pas envoyés.`);
        return false;
    }
    return true;
};

// Configuration du transporteur email (créé uniquement si configuré)
let transporter = null;
if (isSMTPConfigured()) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        // 🔧 FORCER IPv4 (important pour Render)
        family: 4,
        // Timeouts plus longs pour Render
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
    });
    
    // Vérifier la connexion au démarrage
    transporter.verify((error, success) => {
        if (error) {
            console.error("❌ Erreur de connexion SMTP:", error.message);
            console.error("   Vérifie que le mot de passe d'application est correct");
        } else {
            console.log("✅ SMTP configuré et prêt à envoyer des emails");
        }
    });
}

// Envoyer un email (avec gestion d'erreur robuste)
export const sendEmail = async (to, subject, html) => {
    // Si SMTP n'est pas configuré, on ne fait rien
    if (!transporter) {
        console.warn(`📧 Email non envoyé (SMTP non configuré): ${subject}`);
        return false;
    }
    
    // Validation basique
    if (!to || !subject || !html) {
        console.error("❌ Email non envoyé: paramètres manquants", { to, subject });
        return false;
    }
    
    try {
        const info = await transporter.sendMail({
            from: `"GreenCart" <${process.env.SMTP_FROM}>`,
            to,
            subject,
            html,
        });
        console.log(`✅ Email envoyé à ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`❌ Erreur envoi email à ${to}:`, error.message);
        return false;
    }
};

// Email de réinitialisation de mot de passe
export const sendPasswordResetEmail = async (to, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10B981;">GreenCart - Réinitialisation du mot de passe</h2>
            <p>Bonjour,</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous :</p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Réinitialiser mon mot de passe</a>
            <p>Ce lien expirera dans 1 heure.</p>
            <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            <hr />
            <p style="font-size: 12px; color: #666;">GreenCart - Votre marché en ligne</p>
        </div>
    `;
    return sendEmail(to, "Réinitialisation de votre mot de passe", html);
};

// Email de confirmation de commande (client)
export const sendOrderConfirmationEmail = async (to, orderId, amount) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10B981;">GreenCart - Confirmation de commande</h2>
            <p>Bonjour,</p>
            <p>Votre commande #${orderId.slice(-8)} a bien été enregistrée.</p>
            <p><strong>Montant total :</strong> ${amount} FCFA</p>
            <p>Vous pouvez suivre l'état de votre commande dans votre espace client.</p>
            <hr />
            <p style="font-size: 12px; color: #666;">GreenCart - Votre marché en ligne</p>
        </div>
    `;
    return sendEmail(to, `Confirmation de votre commande #${orderId.slice(-8)}`, html);
};

// Email de notification admin (nouvelle commande)
export const sendAdminNotificationEmail = async (orderId, amount, customerName, customerEmail) => {
    // Vérifier que l'email admin est configuré
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
        console.warn("⚠️ ADMIN_EMAIL non configuré, notification admin non envoyée");
        return false;
    }
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10B981;">🛍️ Nouvelle commande !</h2>
            <p>Une nouvelle commande a été passée sur GreenCart.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Commande :</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">#${orderId.slice(-8)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Client :</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${customerName}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Email :</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${customerEmail}</td>
                </tr>
                <tr>
                    <td style="padding: 8px;"><strong>Montant :</strong></td>
                    <td style="padding: 8px;">${amount} FCFA</td>
                </tr>
            </table>
            <p>Connectez-vous à l'administration pour gérer cette commande.</p>
            <hr />
            <p style="font-size: 12px; color: #666;">GreenCart - Notification automatique</p>
        </div>
    `;
    return sendEmail(adminEmail, `🛍️ Nouvelle commande #${orderId.slice(-8)}`, html);
};
