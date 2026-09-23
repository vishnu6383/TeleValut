import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const required = (name: string): string => {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') throw new Error(`Missing environment variable: ${name}`);
  return value ?? '';
};

export const config = {
  port: Number(process.env.PORT ?? 5000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET') || 'development-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID ?? '',
  maxFileSize: Number(process.env.MAX_FILE_SIZE_BYTES ?? 52428800),
  email: {
    host: process.env.EMAIL_HOST ?? '', port: Number(process.env.EMAIL_PORT ?? 587),
    user: process.env.EMAIL_USER ?? '', password: process.env.EMAIL_PASSWORD ?? '',
    from: process.env.EMAIL_FROM ?? 'TeleVault <no-reply@example.com>',
  },
};
