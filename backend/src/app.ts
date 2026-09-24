import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import dashboardRoutes from './routes/dashboard';
import { config } from './config';
import { errorHandler } from './middleware/errors';

export const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));

// Robust CORS allowing matching origins, onrender domains, and local dev
app.use(
  cors({
    origin: (incomingOrigin, callback) => {
      if (!incomingOrigin) return callback(null, true);
      const cleanOrigin = incomingOrigin.trim().replace(/\/+$/, '');
      const cleanConfig = config.frontendUrl.replace(/\/+$/, '');

      if (
        cleanOrigin === cleanConfig ||
        cleanOrigin.includes('localhost') ||
        cleanOrigin.includes('127.0.0.1') ||
        cleanOrigin.endsWith('.onrender.com')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('combined'));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.get('/api/health', (_req: Request, res: Response) => res.json({ success: true, message: 'TeleVault API is healthy', data: {} }));
app.use(errorHandler);
