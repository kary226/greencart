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

// Configuration du transporteur email
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
        family: 4,
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
    });
    
    transporter.verify((error, success) => {
        if (error) {
            console.error("❌ Erreur de connexion SMTP:", error.message);
        } else {
            console.log("✅ SMTP configuré et prêt à envoyer des emails");
        }
    });
}

// Envoyer un email
export const sendEmail = async (to, subject, html) => {
    if (!transporter) {
        console.warn(`📧 Email non envoyé (SMTP non configuré): ${subject}`);
        return false;
    }
    
    if (!to || !subject || !html) {
        console.error("❌ Email non envoyé: paramètres manquants", { to, subject });
        return false;
    }
    
    try {
        const info = await transporter.sendMail({
            from: `"RAMCI" <${process.env.SMTP_FROM}>`,
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

// ✅ Fonction pour formater une date en français
const formatDateFr = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
};

// Email de réinitialisation de mot de passe
export const sendPasswordResetEmail = async (to, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5; color: #333333;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08); overflow: hidden;">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 30px 40px 20px; border-bottom: 2px solid #e53935;">
                                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111111; letter-spacing: 0.5px;">RAMCI<span style="color: #e53935;">.ci</span></h1>
                                    <p style="margin: 4px 0 0; font-size: 13px; color: #888888;">Votre boutique en ligne</p>
                                </td>
                            </tr>
                            <!-- Body -->
                            <tr>
                                <td style="padding: 35px 40px 25px;">
                                    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #111111;">Réinitialisation du mot de passe</h2>
                                    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #555555;">Bonjour,</p>
                                    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #555555;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.</p>
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" style="padding: 10px 0 20px;">
                                                <a href="${resetUrl}" style="display: inline-block; background-color: #e53935; color: #ffffff; padding: 12px 32px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 4px;">Réinitialiser mon mot de passe</a>
                                            </td>
                                        </tr>
                                    </table>
                                    <p style="margin: 0 0 8px; font-size: 13px; color: #888888;">Ce lien expirera dans 1 heure.</p>
                                    <p style="margin: 0; font-size: 13px; color: #888888;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 20px 40px 30px; border-top: 1px solid #eeeeee; text-align: center;">
                                    <p style="margin: 0; font-size: 12px; color: #999999;">RAMCI - Votre boutique en ligne</p>
                                    <p style="margin: 4px 0 0; font-size: 12px; color: #999999;">&copy; ${new Date().getFullYear()} RAMCI. Tous droits réservés.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
    return sendEmail(to, "RAMCI - Réinitialisation de votre mot de passe", html);
};

// ✅ Email de confirmation de commande (client) - PROFESSIONNEL SANS STICKER
export const sendOrderConfirmationEmail = async (to, orderId, amount, estimatedDeliveryStart = null, estimatedDeliveryEnd = null) => {
    const deliveryStart = formatDateFr(estimatedDeliveryStart);
    const deliveryEnd = formatDateFr(estimatedDeliveryEnd);
    
    let deliveryHtml = '';
    if (deliveryStart && deliveryEnd) {
        deliveryHtml = `
            <tr>
                <td style="background: #f8f9fa; border: 1px solid #e8edf2; border-radius: 4px; padding: 14px 18px;">
                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a3c6e;">Livraison prévue</p>
                    <p style="margin: 4px 0 0; font-size: 14px; color: #2c5282;">Du ${deliveryStart} au ${deliveryEnd}</p>
                    <p style="margin: 2px 0 0; font-size: 12px; color: #718096;">Délai de livraison : 7 jours ouvrés</p>
                </td>
            </tr>
        `;
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5; color: #333333;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08); overflow: hidden;">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 30px 40px 20px; border-bottom: 2px solid #e53935;">
                                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111111; letter-spacing: 0.5px;">RAMCI<span style="color: #e53935;">.ci</span></h1>
                                    <p style="margin: 4px 0 0; font-size: 13px; color: #888888;">Votre boutique en ligne</p>
                                </td>
                            </tr>
                            <!-- Body -->
                            <tr>
                                <td style="padding: 35px 40px 25px;">
                                    <h2 style="margin: 0 0 4px; font-size: 20px; font-weight: 600; color: #111111;">Confirmation de commande</h2>
                                    <p style="margin: 0 0 20px; font-size: 14px; color: #888888;">Commande #${orderId.slice(-8)}</p>
                                    
                                    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #555555;">Bonjour,</p>
                                    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #555555;">Nous vous remercions pour votre commande. Celle-ci a bien été enregistrée et est en cours de traitement.</p>
                                    
                                    <!-- Récapitulatif -->
                                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 4px; margin-bottom: 20px;">
                                        <tr>
                                            <td style="padding: 14px 18px;">
                                                <table width="100%" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555;"><strong>Montant total</strong></td>
                                                        <td style="padding: 4px 0; font-size: 14px; font-weight: 700; color: #111111; text-align: right;">${amount.toLocaleString()} FCFA</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555;"><strong>Date de commande</strong></td>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555; text-align: right;">${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555;"><strong>Mode de paiement</strong></td>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555; text-align: right;">Paiement à la livraison</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Livraison -->
                                    ${deliveryHtml}
                                    
                                    <!-- Informations -->
                                    <p style="margin: 20px 0 8px; font-size: 14px; color: #555555;">Vous pouvez suivre l'état de votre commande dans votre espace client.</p>
                                    <p style="margin: 0; font-size: 14px; color: #555555;">Nous restons à votre disposition pour toute question.</p>
                                    <p style="margin: 16px 0 0; font-size: 14px; color: #555555;">Cordialement,</p>
                                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111111;">L'équipe RAMCI</p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 20px 40px 30px; border-top: 1px solid #eeeeee; text-align: center;">
                                    <p style="margin: 0; font-size: 13px; color: #555555;">
                                        <a href="${process.env.FRONTEND_URL}/my-orders" style="color: #e53935; text-decoration: none; font-weight: 500;">Voir mes commandes</a>
                                        &nbsp;·&nbsp;
                                        <a href="${process.env.FRONTEND_URL}" style="color: #555555; text-decoration: none;">Visiter le site</a>
                                    </p>
                                    <p style="margin: 8px 0 0; font-size: 12px; color: #999999;">RAMCI - Votre boutique en ligne</p>
                                    <p style="margin: 2px 0 0; font-size: 12px; color: #999999;">&copy; ${new Date().getFullYear()} RAMCI. Tous droits réservés.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
    return sendEmail(to, `RAMCI - Confirmation de votre commande #${orderId.slice(-8)}`, html);
};

// Email de notification admin (nouvelle commande)
export const sendAdminNotificationEmail = async (orderId, amount, customerName, customerEmail) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
        console.warn("⚠️ ADMIN_EMAIL non configuré, notification admin non envoyée");
        return false;
    }
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5; color: #333333;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08); overflow: hidden;">
                            <tr>
                                <td style="padding: 30px 40px 20px; border-bottom: 2px solid #e53935;">
                                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111111; letter-spacing: 0.5px;">RAMCI<span style="color: #e53935;">.ci</span></h1>
                                    <p style="margin: 4px 0 0; font-size: 13px; color: #888888;">Administration</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 35px 40px 25px;">
                                    <h2 style="margin: 0 0 4px; font-size: 20px; font-weight: 600; color: #111111;">Nouvelle commande</h2>
                                    <p style="margin: 0 0 20px; font-size: 14px; color: #888888;">Commande #${orderId.slice(-8)}</p>
                                    
                                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 4px; margin-bottom: 20px;">
                                        <tr>
                                            <td style="padding: 14px 18px;">
                                                <table width="100%" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555;"><strong>Commande</strong></td>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555; text-align: right;">#${orderId.slice(-8)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555;"><strong>Client</strong></td>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555; text-align: right;">${customerName}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555;"><strong>Email</strong></td>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555; text-align: right;">${customerEmail}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 4px 0; font-size: 14px; color: #555555;"><strong>Montant</strong></td>
                                                        <td style="padding: 4px 0; font-size: 14px; font-weight: 700; color: #111111; text-align: right;">${amount.toLocaleString()} FCFA</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <p style="margin: 0 0 8px; font-size: 14px; color: #555555;">Connectez-vous à l'administration pour gérer cette commande.</p>
                                    <p style="margin: 0; font-size: 14px; color: #555555;">
                                        <a href="${process.env.FRONTEND_URL}/seller/orders" style="color: #e53935; text-decoration: none; font-weight: 500;">Gérer les commandes</a>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 20px 40px 30px; border-top: 1px solid #eeeeee; text-align: center;">
                                    <p style="margin: 0; font-size: 12px; color: #999999;">RAMCI - Notification automatique</p>
                                    <p style="margin: 2px 0 0; font-size: 12px; color: #999999;">&copy; ${new Date().getFullYear()} RAMCI. Tous droits réservés.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
    return sendEmail(adminEmail, `RAMCI - Nouvelle commande #${orderId.slice(-8)}`, html);
};
// Libellés affichés pour chaque rôle staff
const ROLE_LABELS = {
    admin: 'Administrateur',
    commercant: 'Commerçant',
    livreur: 'Livreur',
    assistant_shein: 'Assistant Shein',
};

// Email d'invitation à activer un compte staff (admin, commerçant,
// livreur ou assistant Shein). La personne choisit elle-même son mot de
// passe en cliquant sur le lien — il n'est jamais fixé par l'admin.
export const sendStaffInvitationEmail = async (to, token, role) => {
    const activationUrl = `${process.env.FRONTEND_URL}/staff/activation/${token}`;
    const roleLabel = ROLE_LABELS[role] || role;
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5; color: #333333;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.08); overflow: hidden;">
                            <tr>
                                <td style="padding: 30px 40px 20px; border-bottom: 2px solid #e53935;">
                                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111111; letter-spacing: 0.5px;">RAMCI<span style="color: #e53935;">.ci</span></h1>
                                    <p style="margin: 4px 0 0; font-size: 13px; color: #888888;">Votre boutique en ligne</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 35px 40px 25px;">
                                    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #111111;">Invitation à rejoindre l'équipe RAMCI</h2>
                                    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #555555;">Bonjour,</p>
                                    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #555555;">Un administrateur vous invite à créer un compte avec le rôle <strong>${roleLabel}</strong>. Cliquez sur le bouton ci-dessous pour choisir votre mot de passe et activer votre compte.</p>
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" style="padding: 10px 0 20px;">
                                                <a href="${activationUrl}" style="display: inline-block; background-color: #e53935; color: #ffffff; padding: 12px 32px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 4px;">Activer mon compte</a>
                                            </td>
                                        </tr>
                                    </table>
                                    <p style="margin: 0 0 8px; font-size: 13px; color: #888888;">Ce lien expirera dans 48 heures.</p>
                                    <p style="margin: 0; font-size: 13px; color: #888888;">Si vous ne vous attendiez pas à cette invitation, ignorez simplement cet email.</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 20px 40px 30px; border-top: 1px solid #eeeeee; text-align: center;">
                                    <p style="margin: 0; font-size: 12px; color: #999999;">RAMCI - Votre boutique en ligne</p>
                                    <p style="margin: 4px 0 0; font-size: 12px; color: #999999;">&copy; ${new Date().getFullYear()} RAMCI. Tous droits réservés.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
    return sendEmail(to, `RAMCI - Invitation : ${roleLabel}`, html);
};