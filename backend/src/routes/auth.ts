import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { config } from '../config';
import { sendVerificationOTP } from '../services/emailService';
import { authenticate } from '../middleware/auth';
import { failure, success } from '../utils/api';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const otpHash = (otp: string) => crypto.createHash('sha256').update(otp).digest('hex');

const publicUser = (user: IUser) => ({
  id: user._id.toString(),
  username: user.username,
  fullName: user.fullName,
  email: user.email,
});

const issueCookie = (res: import('express').Response, userId: string) => {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('televault_token', token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

/**
 * Helper to generate cryptographically secure 6-digit numeric OTP,
 * hash it, store in MongoDB with 10-min expiration, and dispatch email.
 */
const sendOtp = async (user: IUser) => {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const hashed = otpHash(otp);

  user.emailVerificationOtpHash = hashed;
  user.emailVerificationOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  user.otpAttempts = 0;
  user.lastOtpSentAt = new Date();
  await user.save();

  await sendVerificationOTP(user.email, user.fullName, otp);
};

// 1. REGISTRATION ENDPOINT
router.post('/register', async (req, res, next) => {
  try {
    const { fullName, username, email, password } = req.body as Record<string, string>;

    if (!fullName?.trim() || !username?.trim() || !emailPattern.test(email ?? '') || !password || password.length < 8) {
      return failure(res, 'Please provide a valid name, email, username, and password of at least 8 characters.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existing) {
      return failure(
        res,
        existing.email === normalizedEmail
          ? 'An account with this email address already exists.'
          : 'That username is already taken.',
        409
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = new User({
      fullName: fullName.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      isEmailVerified: false,
    });

    await user.save();

    try {
      await sendOtp(user);
    } catch (error: any) {
      // Rollback user creation if email dispatch fails
      await User.findByIdAndDelete(user._id);
      return failure(
        res,
        error?.message || 'Failed to send verification email. Please check your email configuration.',
        500
      );
    }

    return success(
      res,
      { email: user.email },
      'Verification code sent to your email.',
      201
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      return failure(res, 'An account with that email or username already exists.', 409);
    }
    return next(error);
  }
});

// 2. VERIFY EMAIL ENDPOINT
router.post('/verify-email', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').toLowerCase().trim();
    const submittedOtp = String(req.body.otp ?? '').trim();

    if (!email || !submittedOtp || !/^\d{6}$/.test(submittedOtp)) {
      return failure(res, 'Please enter a valid 6-digit verification code.', 400);
    }

    const user = await User.findOne({ email });

    if (!user) {
      return failure(res, 'This verification request is not valid.', 400);
    }

    if (user.isEmailVerified) {
      return failure(res, 'This account is already verified. Please sign in.', 400);
    }

    if (user.otpAttempts >= 5) {
      // Invalidate the expired/exhausted OTP
      user.emailVerificationOtpHash = null;
      user.emailVerificationOtpExpiresAt = null;
      await user.save();
      return failure(res, 'Too many incorrect attempts. Please request a new verification code.', 429);
    }

    if (!user.emailVerificationOtpExpiresAt || new Date(user.emailVerificationOtpExpiresAt) < new Date()) {
      return failure(res, 'This verification code has expired. Please request a new code.', 400);
    }

    const submittedHash = otpHash(submittedOtp);

    if (submittedHash !== user.emailVerificationOtpHash) {
      user.otpAttempts += 1;
      if (user.otpAttempts >= 5) {
        user.emailVerificationOtpHash = null;
        user.emailVerificationOtpExpiresAt = null;
        await user.save();
        return failure(res, 'Too many incorrect attempts. Please request a new verification code.', 429);
      } else {
        await user.save();
        const remaining = 5 - user.otpAttempts;
        return failure(res, `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, 400);
      }
    }

    // OTP Verified Successfully -> Invalidate OTP and mark verified
    user.isEmailVerified = true;
    user.emailVerificationOtpHash = null;
    user.emailVerificationOtpExpiresAt = null;
    user.otpAttempts = 0;
    await user.save();

    return success(res, { email: user.email }, 'Email verified successfully. You can now log in.');
  } catch (error) {
    return next(error);
  }
});

// 3. RESEND OTP ENDPOINT
router.post('/resend-otp', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').toLowerCase().trim();
    if (!email) return failure(res, 'Email address is required.', 400);

    const user = await User.findOne({ email });

    if (!user) {
      return failure(res, 'Account not found.', 404);
    }

    if (user.isEmailVerified) {
      return failure(res, 'This account is already verified. Please sign in.', 400);
    }

    // 60-second cooldown check
    if (user.lastOtpSentAt) {
      const elapsed = Date.now() - new Date(user.lastOtpSentAt).getTime();
      if (elapsed < 60_000) {
        const remainingSeconds = Math.ceil((60_000 - elapsed) / 1000);
        return failure(
          res,
          `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting another code.`,
          429
        );
      }
    }

    try {
      await sendOtp(user);
    } catch (error: any) {
      return failure(
        res,
        error?.message || 'Failed to send verification email. Please check your email configuration.',
        500
      );
    }

    return success(res, { email: user.email }, 'A new verification code was sent to your email.');
  } catch (error) {
    return next(error);
  }
});

// 4. LOGIN ENDPOINT
router.post('/login', async (req, res, next) => {
  try {
    const identifier = String(req.body.identifier ?? '').toLowerCase().trim();
    const password = String(req.body.password ?? '');

    if (!identifier || !password) {
      return failure(res, 'Please provide your email/username and password.', 400);
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return failure(res, 'Invalid email or password.', 401);
    }

    if (!user.isEmailVerified) {
      return failure(res, 'Please verify your email before logging in.', 403);
    }

    issueCookie(res, user._id.toString());
    return success(res, { user: publicUser(user) }, 'Logged in.');
  } catch (error) {
    return next(error);
  }
});

// 5. LOGOUT & CURRENT USER
router.post('/logout', (_req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('televault_token', {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  });
  return success(res, {}, 'Logged out.');
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return failure(res, 'User not found.', 404);
    return success(res, { user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

export default router;
