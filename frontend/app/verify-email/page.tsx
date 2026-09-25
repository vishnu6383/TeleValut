'use client';

import { FormEvent, useEffect, useRef, useState, ClipboardEvent, KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, KeyRound, Sun, Moon } from 'lucide-react';
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

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isCustomEmail, setIsCustomEmail] = useState(false);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [count, setCount] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
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

  useEffect(() => {
    const savedEmail = sessionStorage.getItem('verifyEmail') ?? '';
    if (savedEmail) {
      setEmail(savedEmail);
    } else {
      setIsCustomEmail(true);
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (count > 0) {
      const timer = setInterval(() => setCount((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [count]);

  // Focus first empty slot on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

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

    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setDigits(next);

    const targetIndex = Math.min(pasted.length, 5);
    inputRefs.current[targetIndex]?.focus();
  };

  const fullOtp = digits.join('');

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      return setError('Please provide a valid email address.');
    }

    if (fullOtp.length !== 6) {
      return setError('Please enter the full 6-digit verification code.');
    }

    setLoading(true);
    try {
      await api('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail, otp: fullOtp }),
      });

      setVerifiedSuccess(true);
      setNotice('Email verified successfully! Redirecting you to sign in...');
      sessionStorage.removeItem('verifyEmail');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError((err as Error).message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (count > 0 || resending) return;
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      return setError('Please enter your email address to receive a code.');
    }

    setResending(true);
    setError('');
    setNotice('');

    try {
      await api('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail }),
      });
      setCount(60);
      setNotice('A fresh verification code has been dispatched to your email.');
    } catch (err) {
      setError((err as Error).message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <main
      className="auth-form-wrap"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(0.75rem, 3vw, 1.75rem)',
        background: 'var(--bg-dark)',
      }}
    >
      <form
        className="auth-card"
        onSubmit={verify}
        noValidate
        style={{
          width: '100%',
          maxWidth: '30rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '1.4rem',
          padding: 'clamp(1.1rem, 4.5vw, 2.25rem)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Brand & Theme Switcher Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <Link href="/login" className="brand">
            <span className="brand-mark">T</span>
            <span className="font-display">TeleVault</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {/* LIGHT / DARK MODE TOGGLE */}
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              style={{ padding: '0.4rem 0.75rem', minHeight: '2.1rem', fontSize: '0.8rem' }}
              aria-label="Toggle Theme"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            <div
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: '9999px',
                background: 'rgba(215, 232, 126, 0.12)',
                border: '1px solid rgba(215, 232, 126, 0.25)',
                color: 'var(--lime)',
                fontSize: '0.72rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                whiteSpace: 'nowrap',
              }}
            >
              <KeyRound size={12} />
              Step 2 of 2
            </div>
          </div>
        </div>

        {/* Verification Icon */}
        <div
          style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, rgba(215, 232, 126, 0.2) 0%, rgba(13, 148, 136, 0.25) 100%)',
            border: '1.5px solid var(--border-active)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--lime)',
            marginBottom: '1rem',
          }}
        >
          <Mail size={26} />
        </div>

        <div>
          <p className="muted" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            EMAIL VERIFICATION
          </p>
          <h1 className="font-display" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 1.85rem)', letterSpacing: '-0.04em', margin: '0.15rem 0 0.35rem', fontWeight: 800 }}>
            Check your email
          </h1>
          <p className="muted" style={{ lineHeight: 1.5, fontSize: '0.88rem' }}>
            We sent a 6-digit security code to{' '}
            <strong style={{ color: 'var(--ink)' }}>
              {isCustomEmail ? 'your email address' : maskEmail(email)}
            </strong>
            . The code is valid for 10 minutes.
          </p>
        </div>

        {/* Editable email field if not in session or user needs to correct */}
        {isCustomEmail && (
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="email">Email Address</label>
            <div className="field-input-wrap has-icon-left">
              <span className="field-icon-left">
                <Mail size={17} />
              </span>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* 6-Digit OTP Input Row (Ultra-responsive on all mobile viewports from 300px+) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'clamp(0.2rem, 1.8vw, 0.6rem)',
            margin: '1.5rem 0 1.25rem',
            width: '100%',
          }}
        >
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              autoComplete="one-time-code"
              aria-label={`Digit ${index + 1} of 6`}
              style={{
                width: 'clamp(2.2rem, 11vw, 3.3rem)',
                height: 'clamp(2.75rem, 12.5vw, 3.8rem)',
                border: '1.5px solid var(--border-subtle)',
                borderRadius: '0.8rem',
                background: 'var(--bg-elevated)',
                color: 'var(--ink)',
                fontSize: 'clamp(1.15rem, 5vw, 1.55rem)',
                fontWeight: 800,
                textAlign: 'center',
                outline: 'none',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-space-grotesk), monospace',
                borderColor: digit ? 'var(--lime)' : 'var(--border-subtle)',
                boxShadow: digit ? '0 0 0 2px var(--lime-glow)' : 'none',
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {error && (
          <div className="error-box">
            <AlertCircle size={17} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="success-box">
            <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
            <span>{notice}</span>
          </div>
        )}

        <button
          className="primary"
          style={{ width: '100%', marginTop: '1.25rem' }}
          disabled={loading || fullOtp.length !== 6 || verifiedSuccess}
        >
          {loading ? (
            <>Verifying Code...</>
          ) : verifiedSuccess ? (
            <>
              Verified! Redirecting... <CheckCircle2 size={17} />
            </>
          ) : (
            <>
              Verify & Unlock Vault <ArrowRight size={17} />
            </>
          )}
        </button>

        {/* Resend Action */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={resend}
            disabled={count > 0 || resending}
            style={{
              background: 'transparent',
              border: 'none',
              color: count > 0 ? 'var(--muted)' : 'var(--lime)',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: count > 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
            {resending
              ? 'Sending new code...'
              : count > 0
              ? `Resend code in ${count}s`
              : 'Resend verification code'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '1.35rem', paddingTop: '1.15rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
          <button
            type="button"
            onClick={() => setIsCustomEmail(!isCustomEmail)}
            className="link"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {isCustomEmail ? 'Use saved email' : 'Change email address'}
          </button>

          <Link className="link" href="/login">
            Back to Sign in
          </Link>
        </div>
      </form>
    </main>
  );
}
