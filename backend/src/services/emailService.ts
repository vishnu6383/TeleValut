import nodemailer from 'nodemailer';
import { config } from '../config';

const createTransporter = () => {
  if (!config.email.user || !config.email.password) {
    return null;
  }

  const cleanPass = config.email.password.trim().replace(/\s+/g, '');
  const cleanUser = config.email.user.trim();
  const isGmail =
    config.email.host?.toLowerCase().includes('gmail') ||
    cleanUser.toLowerCase().endsWith('@gmail.com');

  if (isGmail) {
    // Official Nodemailer Gmail service preset (bypasses ISP port 587 blocks and handles SSL automatically)
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port || 587,
    secure: config.email.port === 465,
    auth: {
      user: cleanUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  } as any);
};

const transporter = createTransporter();

/**
 * Verifies SMTP server connectivity and authentication.
 */
export const verifySmtpConnection = async (): Promise<{ ok: boolean; error?: string }> => {
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
  if (!transporter) {
    throw new Error(
      'Email service is not configured. Please provide EMAIL_USER and EMAIL_PASSWORD in .env.'
    );
  }

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
    from: config.email.from || `TeleVault <${config.email.user}>`,
    to: email,
    subject: `Your TeleVault Verification Code: ${otp}`,
    text: `Hi ${fullName || 'there'},\n\nYour TeleVault verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\n— TeleVault`,
    html: htmlContent,
  });
};
