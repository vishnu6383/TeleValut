'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

/**
 * Masks an email address for privacy (e.g., alex.morgan@gmail.com -> a***n@gmail.com)
 */
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

export default function VerifyEmail() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [count, setCount] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem('verifyEmail') ?? '';
    setEmail(savedEmail);
  }, []);

  useEffect(() => {
    if (count > 0) {
      const id = setInterval(() => setCount((v) => v - 1), 1000);
      return () => clearInterval(id);
    }
  }, [count]);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    if (otp.length !== 6) {
      setLoading(false);
      return setError('Please enter the full 6-digit code.');
    }

    try {
      await api('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });
      setNotice('Email verified successfully! Redirecting to sign in...');
      sessionStorage.removeItem('verifyEmail');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (count > 0 || resending) return;
    setResending(true);
    setError('');
    setNotice('');

    try {
      await api('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setCount(60);
      setNotice('A new verification code was sent to your email.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="auth-form-wrap" style={{ minHeight: '100vh' }}>
      <form className="auth-card" onSubmit={verify}>
        <div
          style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '1.2rem',
            background: '#d7e87e',
            display: 'grid',
            placeItems: 'center',
            fontSize: '2rem',
          }}
        >
          ✉
        </div>

        <p className="muted" style={{ marginTop: '2rem' }}>
          SECURITY VERIFICATION
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: '2.5rem',
            letterSpacing: '-.05em',
            margin: '.3rem 0',
          }}
        >
          Verify your email
        </h1>
        <p className="muted">
          Enter the 6-digit verification code sent to{' '}
          <strong style={{ color: '#ffffff' }}>{maskEmail(email)}</strong>. It expires in 10 minutes.
        </p>

        <div className="field" style={{ marginTop: '1.5rem' }}>
          <label htmlFor="otp">Verification code</label>
          <input
            id="otp"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            style={{
              fontSize: '1.5rem',
              letterSpacing: '0.3em',
              textAlign: 'center',
              fontWeight: 700,
            }}
            required
            autoFocus
          />
        </div>

        {error && <p className="error" style={{ marginTop: '0.8rem' }}>{error}</p>}
        {notice && (
          <p style={{ color: '#d7e87e', fontSize: '.9rem', marginTop: '0.8rem', fontWeight: 600 }}>
            {notice}
          </p>
        )}

        <button
          className="primary"
          style={{ width: '100%', marginTop: '1.3rem' }}
          disabled={loading || otp.length < 6}
        >
          {loading ? 'Verifying code...' : 'Verify Email'}
        </button>

        <button
          type="button"
          onClick={resend}
          disabled={count > 0 || resending}
          style={{
            width: '100%',
            border: 0,
            background: 'transparent',
            padding: '1rem',
            color: count > 0 ? '#627b75' : '#d7e87e',
            fontWeight: 700,
            cursor: count > 0 ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
          }}
        >
          {resending
            ? 'Sending new code...'
            : count > 0
            ? `Resend available in ${count}s`
            : 'Resend code'}
        </button>

        <p className="muted" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          Wrong email address?{' '}
          <Link className="link" href="/register">
            Start again
          </Link>
        </p>
      </form>
    </main>
  );
}
