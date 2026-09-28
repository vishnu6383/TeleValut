import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config';

let cachedTransporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (cachedTransporter) return cachedTransporter;

  const user = config.email.user?.trim() || process.env.EMAIL_USER?.trim();
  const rawPass = config.email.password || process.env.EMAIL_PASSWORD || '';
  const pass = rawPass.trim().replace(/\s+/g, '');

  if (!user || !pass) {
    return null;
  }

  const host = config.email.host?.trim() || process.env.EMAIL_HOST?.trim() || '';
  const isGmail = host.toLowerCase().includes('gmail') || user.toLowerCase().endsWith('@gmail.com');

  if (isGmail) {
    // High-speed direct SSL pool on port 465 for Gmail (bypasses slow STARTTLS 587 handshake)
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  } else {
    const port = Number(config.email.port || process.env.EMAIL_PORT || 587);
    cachedTransporter = nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port,
      secure: port === 465,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }

  return cachedTransporter;
};

/**
 * Verifies SMTP server connectivity and authentication.
 */
export const verifySmtpConnection = async (): Promise<{ ok: boolean; error?: string }> => {
  const transporter = getTransporter();
  if (!transporter) {
    return {
      ok: false,
      error: 'SMTP credentials missing. Please set EMAIL_USER and EMAIL_PASSWORD in .env',
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
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error(
      'Email service is not configured. Please provide EMAIL_USER and EMAIL_PASSWORD in .env.'
    );
  }

  const senderUser = config.email.user?.trim() || process.env.EMAIL_USER?.trim();
  const fromAddress = config.email.from || process.env.EMAIL_FROM || `TeleVault <${senderUser}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070c0e; color: #f1f7f5; margin: 0; padding: 24px; }
        .card { background-color: #0e1619; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; max-width: 480px; margin: 0 auto; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .brand { font-size: 22px; font-weight: 800; color: #d7e87e; text-decoration: none; display: inline-block; margin-bottom: 24px; }
        .title { font-size: 20px; font-weight: 700; color: #f1f7f5; margin-top: 0; margin-bottom: 12px; }
        .text { font-size: 15px; color: #9cb5ad; line-height: 1.6; margin-bottom: 24px; }
        .otp-container { background: linear-gradient(135deg, rgba(215, 232, 126, 0.1) 0%, rgba(13, 148, 136, 0.15) 100%); border: 1.5px dashed rgba(215, 232, 126, 0.4); border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
        .otp-code { font-family: monospace, Courier; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #d7e87e; margin: 0; }
        .footer { font-size: 12px; color: #6d8a81; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 18px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">TeleVault</div>
        <h1 class="title">Verify your email address</h1>
        <p class="text">Hi <strong>${fullName || 'there'}</strong>,<br><br>Thank you for creating a TeleVault account. Use the 6-digit verification code below to activate your account and unlock your private digital vault:</p>
        
        <div class="otp-container">
          <p class="otp-code">${otp}</p>
        </div>

        <p class="text" style="font-size: 13px;">This code is valid for <strong>10 minutes</strong>. If you did not request this email, please safely ignore it.</p>
        
        <div class="footer">
          TeleVault Cloud Storage · Private & Encrypted Vault
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject: `Your TeleVault Verification Code: ${otp}`,
    text: `Hi ${fullName || 'there'},\n\nYour TeleVault verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\n— TeleVault`,
    html: htmlContent,
  });
};
