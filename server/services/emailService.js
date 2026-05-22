import emailjs from '@emailjs/nodejs';

const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;

const TEMPLATES = {
    ORDER_CONFIRMATION: 'order_confirmation',
    PASSWORD_RESET: 'password_reset',
    ADMIN_NOTIFICATION: 'admin_notification'
};

const isConfigured = () => {
    if (!PUBLIC_KEY || !PRIVATE_KEY || !SERVICE_ID) {
        console.warn('⚠️ EmailJS non configuré');
        return false;
    }
    console.log('✅ EmailJS configuré');
    return true;
};

export const sendEmail = async (to, templateId, templateParams) => {
    if (!isConfigured()) return false;
    
    try {
        const response = await emailjs.send(
            SERVICE_ID,
            templateId,
            {
                to_email: to,
                ...templateParams
            },
            {
                publicKey: PUBLIC_KEY,
                privateKey: PRIVATE_KEY
            }
        );
        console.log(`✅ Email envoyé à ${to}`);
        return true;
    } catch (error) {
        console.error(`❌ Erreur EmailJS:`, error.message);
        return false;
    }
};

export const sendPasswordResetEmail = async (to, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    return sendEmail(to, TEMPLATES.PASSWORD_RESET, {
        reset_url: resetUrl
    });
};

export const sendOrderConfirmationEmail = async (to, orderId, amount, customerName) => {
    return sendEmail(to, TEMPLATES.ORDER_CONFIRMATION, {
        order_id: orderId.slice(-8),
        amount: amount,
        customer_name: customerName
    });
};

export const sendAdminNotificationEmail = async (orderId, amount, customerName, customerEmail) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return false;
    
    return sendEmail(adminEmail, TEMPLATES.ADMIN_NOTIFICATION, {
        order_id: orderId.slice(-8),
        amount: amount,
        customer_name: customerName,
        customer_email: customerEmail
    });
};