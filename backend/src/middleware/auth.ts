import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { failure } from '../utils/api';

declare global { namespace Express { interface Request { userId?: string } } }

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.televault_token ?? req.headers.authorization?.replace('Bearer ', '');
  if (!token) return failure(res, 'Authentication required.', 401);
  try { req.userId = (jwt.verify(token, config.jwtSecret) as jwt.JwtPayload).sub as string; return next(); }
  catch { return failure(res, 'Invalid or expired session.', 401); }
};
