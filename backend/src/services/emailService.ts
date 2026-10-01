import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config';

const getTransporter = (): Transporter | null => {
  const user = config.email.user?.trim() || process.env.EMAIL_USER?.trim() || '';
  const rawPass = config.email.password || process.env.EMAIL_PASSWORD || '';
  const pass = rawPass.trim().replace(/\s+/g, '');

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.email.host?.trim() || process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com',
    port: Number(config.email.port || process.env.EMAIL_PORT || 465),
    secure: Number(config.email.port || process.env.EMAIL_PORT || 465) === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
};

/**
 * Sends email via Resend HTTPS API (Port 443)
 */
const sendViaResend = async (
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const fromAddress = process.env.RESEND_FROM?.trim() || 'TeleVault <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || data?.error || `Resend failed with status ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to connect to Resend API' };
  }
};

/**
 * Sends email via Brevo HTTPS API (Port 443)
 */
const sendViaBrevo = async (
  apiKey: string,
  to: string,
  fullName: string,
  senderEmail: string,
  subject: string,
  htmlContent: string
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'TeleVault', email: senderEmail },
        to: [{ email: to, name: fullName || to }],
        subject,
        htmlContent,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || `Brevo failed with status ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to connect to Brevo API' };
  }
};

/**
 * Verifies email service connectivity.
 */
export const verifySmtpConnection = async (): Promise<{ ok: boolean; provider: string; error?: string }> => {
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (brevoKey) {
    return { ok: true, provider: 'Brevo HTTPS API (Port 443 - All Recipients)' };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    return { ok: true, provider: 'Resend HTTPS API (Port 443)' };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      ok: false,
      provider: 'None',
      error: 'No email configuration found. Please configure RESEND_API_KEY (recommended for Render) or EMAIL_USER/EMAIL_PASSWORD.',
    };
  }

  try {
    await transporter.verify();
    return { ok: true, provider: 'SMTP' };
  } catch (error: any) {
    return {
      ok: false,
      provider: 'SMTP',
      error: error?.message || 'SMTP connection timeout or authentication error.',
    };
  }
};

/**
 * Sends a real-time 6-digit OTP email to the user's registered email address.
 * Strictly verifies delivery and throws an error if email dispatch fails.
 */
export const sendVerificationOTP = async (
  email: string,
  fullName: string,
  otp: string
): Promise<void> => {
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

  const textContent = `Hi ${fullName || 'there'},\n\nYour TeleVault verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\n— TeleVault`;
  const subject = `Your TeleVault Verification Code: ${otp}`;

  // 1. Try Brevo HTTPS API (Port 443 - Works for ALL recipients on Render)
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = config.email.user?.trim() || process.env.EMAIL_USER?.trim() || 'vishnunaveenkumar27@gmail.com';
  if (brevoKey) {
    const brevoResult = await sendViaBrevo(brevoKey, email, fullName, senderEmail, subject, htmlContent);
    if (brevoResult.ok) {
      console.log(`[TeleVault Email] Successfully dispatched OTP email to ${email} via Brevo HTTPS.`);
      return;
    }
    console.error(`[TeleVault Email] Brevo API error: ${brevoResult.error}`);
    throw new Error(`Email Delivery Failed: ${brevoResult.error}`);
  }

  // 2. Try Resend HTTPS API (Port 443 - Works seamlessly on Render)
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const resendResult = await sendViaResend(resendKey, email, subject, htmlContent, textContent);
    if (resendResult.ok) {
      console.log(`[TeleVault Email] Successfully dispatched OTP email to ${email} via Resend HTTPS.`);
      return;
    }
    console.error(`[TeleVault Email] Resend API error: ${resendResult.error}`);
    throw new Error(`Email Delivery Failed: ${resendResult.error}`);
  }

  // 3. Try Direct SMTP / Gmail
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error(
      'Email service is not configured. On Render, please add RESEND_API_KEY or configure EMAIL_USER/EMAIL_PASSWORD.'
    );
  }

  const fromAddress = `TeleVault <${senderEmail}>`;

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject,
    text: textContent,
    html: htmlContent,
  });

  console.log(`[TeleVault Email] Successfully dispatched OTP email to ${email} via SMTP.`);
};

/**
 * Sends a real-time 6-digit Password Reset OTP email.
 */
export const sendPasswordResetOTP = async (
  email: string,
  fullName: string,
  otp: string
): Promise<void> => {
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
        <h1 class="title">Reset Your TeleVault Password</h1>
        <p class="text">Hi <strong>${fullName || 'there'}</strong>,<br><br>We received a request to reset the password for your TeleVault account. Use the 6-digit verification code below to set a new password:</p>
        
        <div class="otp-container">
          <p class="otp-code">${otp}</p>
        </div>

        <p class="text" style="font-size: 13px;">This code is valid for <strong>10 minutes</strong>. If you did not request this password reset, you can safely ignore this email — your account remains secure.</p>
        
        <div class="footer">
          TeleVault Cloud Storage · Private & Encrypted Vault
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `Hi ${fullName || 'there'},\n\nYour TeleVault password reset code is: ${otp}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.\n\n— TeleVault`;
  const subject = `TeleVault Password Reset Code: ${otp}`;

  // 1. Try Brevo HTTPS API (Port 443)
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = config.email.user?.trim() || process.env.EMAIL_USER?.trim() || 'vishnunaveenkumar27@gmail.com';
  if (brevoKey) {
    const brevoResult = await sendViaBrevo(brevoKey, email, fullName, senderEmail, subject, htmlContent);
    if (brevoResult.ok) {
      console.log(`[TeleVault Email] Successfully dispatched Password Reset OTP to ${email} via Brevo HTTPS.`);
      return;
    }
    console.error(`[TeleVault Email] Brevo API error: ${brevoResult.error}`);
    throw new Error(`Email Delivery Failed: ${brevoResult.error}`);
  }

  // 2. Try Resend HTTPS API (Port 443)
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const resendResult = await sendViaResend(resendKey, email, subject, htmlContent, textContent);
    if (resendResult.ok) {
      console.log(`[TeleVault Email] Successfully dispatched Password Reset OTP to ${email} via Resend HTTPS.`);
      return;
    }
    console.error(`[TeleVault Email] Resend API error: ${resendResult.error}`);
    throw new Error(`Email Delivery Failed: ${resendResult.error}`);
  }

  // 3. Try Direct SMTP / Gmail
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error(
      'Email service is not configured. On Render, please add RESEND_API_KEY or configure EMAIL_USER/EMAIL_PASSWORD.'
    );
  }

  const fromAddress = `TeleVault <${senderEmail}>`;

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject,
    text: textContent,
    html: htmlContent,
  });

  console.log(`[TeleVault Email] Successfully dispatched Password Reset OTP to ${email} via SMTP.`);
};

