'use client';

import { FormEvent, useEffect, useRef, useState, ClipboardEvent, KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  KeyRound,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || 'your email';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  const first = user[0];
  const last = user[user.length - 1];
  const maskedMiddle = '*'.repeat(Math.min(user.length - 2, 5));
  return `${first}${maskedMiddle}${last}@${domain}`;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [identifier, setIdentifier] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  
  // OTP state
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI states
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [count, setCount] = useState(15);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Theme support
  useEffect(() => {
    const saved = (localStorage.getItem('televault_theme') as 'dark' | 'light') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('televault_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  // Cooldown countdown timer
  useEffect(() => {
    if (count > 0 && step === 'reset') {
      const timer = setInterval(() => setCount((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [count, step]);

  const handleDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const digit = cleaned[cleaned.length - 1];
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    // Auto-advance to next slot
    if (index < 5 && digit) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // Step 1: Request Password Reset OTP
  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your email or username.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const res = await api<{ email: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const userEmail = res?.email || identifier.trim();
      setConfirmedEmail(userEmail);
      setStep('reset');
      setCount(15);
      setNotice(`A 6-digit recovery code was sent to ${maskEmail(userEmail)}.`);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || 'Failed to request password reset code.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResend = async () => {
    if (count > 0 || resending) return;
    setResending(true);
    setError('');
    setNotice('');

    try {
      await api('/auth/resend-reset-otp', {
        method: 'POST',
        body: JSON.stringify({ email: confirmedEmail || identifier.trim() }),
      });
      setCount(15);
      setNotice('A fresh 6-digit reset code has been sent to your email.');
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || 'Failed to resend reset code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    const otp = digits.join('');

    if (otp.length < 6) {
      setError('Please enter all 6 digits of your reset code.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: confirmedEmail || identifier.trim(),
          otp,
          newPassword,
        }),
      });

      setStep('success');
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || 'Password reset failed. Please verify your OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      {/* Brand Aside */}
      <section className="auth-aside">
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/login" className="brand">
              <span className="brand-mark">T</span>
              <span className="font-display">TeleVault</span>
            </Link>
          </div>

          <div style={{ marginTop: '5rem', maxWidth: '32rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.85rem',
                borderRadius: '9999px',
                background: 'rgba(215, 232, 126, 0.12)',
                border: '1px solid rgba(215, 232, 126, 0.25)',
                color: 'var(--lime)',
                fontSize: '0.78rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '1.25rem',
              }}
            >
              <ShieldCheck size={14} />
              Account Recovery
            </div>

            <h1
              className="font-display"
              style={{
                fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.05em',
                fontWeight: 800,
                marginBottom: '1.25rem',
              }}
            >
              Recover
              <br />
              your vault.
            </h1>

            <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: '#cbe0d9' }}>
              Lost your password? No worries. Verify your account with a secure one-time code sent directly to your registered email to regain access immediately.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '3rem', fontSize: '0.85rem', color: '#6d8a81' }}>
          TeleVault Cloud Storage · Zero-Knowledge Encryption
        </div>
      </section>

      {/* Form Area */}
      <section className="auth-form-wrap">
        <div className="auth-card">
          {/* Header */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/login" className="brand">
              <span className="brand-mark">T</span>
              <span className="font-display">TeleVault</span>
            </Link>

            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              style={{ padding: '0.45rem 0.8rem', minHeight: '2.2rem', fontSize: '0.8rem' }}
              aria-label="Toggle Theme"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          {/* STEP 1: Enter email / username */}
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} noValidate>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'inline-flex', padding: '0.5rem', borderRadius: '12px', background: 'rgba(215, 232, 126, 0.12)', color: 'var(--lime)', marginBottom: '0.75rem' }}>
                  <KeyRound size={24} />
                </div>
                <h2 className="font-display" style={{ fontSize: '1.65rem', letterSpacing: '-0.03em', margin: '0 0 0.35rem', fontWeight: 800 }}>
                  Forgot Password?
                </h2>
                <p className="muted" style={{ fontSize: '0.9rem' }}>
                  Enter your registered email address or username to receive a 6-digit recovery code.
                </p>
              </div>

              <div className="field">
                <label htmlFor="identifier">Email or Username</label>
                <div className="field-input-wrap has-icon-left">
                  <span className="field-icon-left">
                    <Mail size={17} />
                  </span>
                  <input
                    id="identifier"
                    type="text"
                    placeholder="you@example.com or username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="error-box" style={{ marginTop: '1rem' }}>
                  <AlertCircle size={17} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="primary"
                style={{ width: '100%', marginTop: '1.5rem' }}
                disabled={loading || !identifier.trim()}
              >
                {loading ? 'Sending Code...' : (
                  <>
                    Send Recovery Code <ArrowRight size={17} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <Link href="/login" className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                  <ArrowLeft size={16} /> Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Enter OTP & New Password */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} noValidate>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'inline-flex', padding: '0.5rem', borderRadius: '12px', background: 'rgba(215, 232, 126, 0.12)', color: 'var(--lime)', marginBottom: '0.75rem' }}>
                  <Lock size={24} />
                </div>
                <h2 className="font-display" style={{ fontSize: '1.65rem', letterSpacing: '-0.03em', margin: '0 0 0.35rem', fontWeight: 800 }}>
                  Reset Password
                </h2>
                <p className="muted" style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
                  Enter the 6-digit code sent to <strong style={{ color: 'var(--ink)' }}>{maskEmail(confirmedEmail)}</strong> and choose a new password.
                </p>
              </div>

              {/* 6-Digit OTP slots */}
              <div className="field">
                <label>6-Digit Verification Code</label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      style={{
                        width: '100%',
                        height: '3.2rem',
                        textAlign: 'center',
                        fontSize: '1.35rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        borderRadius: '0.65rem',
                        border: '1.5px solid var(--border-subtle)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--lime)',
                      }}
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* New Password */}
              <div className="field" style={{ marginTop: '1.1rem' }}>
                <label htmlFor="newPassword">New Password</label>
                <div className="field-input-wrap has-icon-left has-icon-right">
                  <span className="field-icon-left">
                    <Lock size={17} />
                  </span>
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="field-icon-right-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="field" style={{ marginTop: '0.9rem' }}>
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <div className="field-input-wrap has-icon-left">
                  <span className="field-icon-left">
                    <Lock size={17} />
                  </span>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {notice && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.6rem',
                    background: 'rgba(13, 148, 136, 0.15)',
                    border: '1px solid rgba(13, 148, 136, 0.35)',
                    color: 'var(--teal-light)',
                    fontSize: '0.84rem',
                    marginTop: '0.9rem',
                  }}
                >
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{notice}</span>
                </div>
              )}

              {error && (
                <div className="error-box" style={{ marginTop: '0.9rem' }}>
                  <AlertCircle size={17} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="primary"
                style={{ width: '100%', marginTop: '1.25rem' }}
                disabled={loading || digits.join('').length < 6 || !newPassword || newPassword.length < 8}
              >
                {loading ? 'Updating Password...' : (
                  <>
                    Update Password <ArrowRight size={17} />
                  </>
                )}
              </button>

              {/* Resend OTP Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setError('');
                    setNotice('');
                  }}
                  className="link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.84rem', padding: 0 }}
                >
                  Change Email
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={count > 0 || resending}
                  className="link"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: count > 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.84rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    opacity: count > 0 ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                  {count > 0 ? `Resend code in ${count}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Success Screen */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div
                style={{
                  width: '4rem',
                  height: '4rem',
                  borderRadius: '9999px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                  color: 'var(--success)',
                }}
              >
                <CheckCircle2 size={32} />
              </div>

              <h2 className="font-display" style={{ fontSize: '1.75rem', letterSpacing: '-0.04em', margin: '0 0 0.5rem', fontWeight: 800 }}>
                Password Updated!
              </h2>

              <p className="muted" style={{ fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
                Your TeleVault password has been successfully reset. You can now securely sign in to your vault with your new credentials.
              </p>

              <button
                type="button"
                className="primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => router.push('/login')}
              >
                Sign In Now <ArrowRight size={17} />
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
