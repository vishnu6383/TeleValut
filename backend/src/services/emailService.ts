import nodemailer from 'nodemailer';
import { config } from '../config';

const createTransporter = () => {
  if (!config.email.host || !config.email.user || !config.email.password) {
    return null;
  }
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
};

const transporter = createTransporter();

/**
 * Verifies SMTP server connectivity and authentication.
 */
export const verifySmtpConnection = async (): Promise<{ ok: boolean; error?: string }> => {
  if (!transporter) {
    return {
      ok: false,
      error: 'SMTP credentials missing. Please set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASSWORD in .env',
    };
  }
  try {
    await transporter.verify();
    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || 'Failed to authenticate with SMTP provider.',
    };
  }
};

/**
 * Sends a real-time 6-digit OTP email to the user's registered email address.
 */
export const sendVerificationOTP = async (
  email: string,
  fullName: string,
  otp: string
): Promise<void> => {
  if (!transporter) {
    throw new Error(
      'Email service is not configured. Please set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASSWORD in .env'
    );
  }

  const subject = 'Verify your TeleVault account';
  const textContent = `Hello ${fullName || 'User'},

Your TeleVault verification code is:
${otp}

This code will expire in 10 minutes.
If you did not create this account, you can safely ignore this email.

Regards,
TeleVault Team`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1312; color: #f1f7f5; margin: 0; padding: 24px; }
    .card { max-width: 480px; margin: 0 auto; background: #131c1a; border: 1px solid #1f2f2c; border-radius: 16px; padding: 32px; }
    .logo { color: #d7e87e; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 24px; }
    .heading { font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #a4bab4; margin-bottom: 24px; }
    .otp-box { background: #080c0b; border: 1px solid #2a413d; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #d7e87e; font-family: monospace; }
    .footer { font-size: 12px; color: #627b75; margin-top: 28px; border-top: 1px solid #1a2724; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">⚡ TeleVault</div>
    <h1 class="heading">Verify your email address</h1>
    <p class="text">Hello <strong>${fullName || 'User'}</strong>,</p>
    <p class="text">Thank you for joining TeleVault. Use the verification code below to verify your account:</p>
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>
    <p class="text">This code will expire in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
    <div class="footer">
      Regards,<br>
      <strong>TeleVault Security Team</strong>
    </div>
  </div>
</body>
</html>
`;

  await transporter.sendMail({
    from: config.email.from,
    to: email,
    subject,
    text: textContent,
    html: htmlContent,
  });
};
