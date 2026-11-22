const nodemailer = require('nodemailer');

async function sendCode(email, code) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
    const port = Number(SMTP_PORT);
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('SMTP configuration is incomplete.');
    }
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
    });
    await transporter.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: 'Difan Logistics sign-in code',
        text: `Your sign-in code is ${code}. It expires in 10 minutes. If you did not sign in, contact your administrator.`
    });
}

module.exports = { sendCode };
