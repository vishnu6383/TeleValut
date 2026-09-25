'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load and toggle theme
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

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    let mounted = true;
    api('/auth/me')
      .then(() => {
        if (mounted) router.replace('/dashboard');
      })
      .catch(() => {
        if (mounted) setCheckingAuth(false);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Invalid email/username or password.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="auth-form-wrap">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="brand-mark animate-pulse">T</div>
          <p className="muted">Loading TeleVault...</p>
        </div>
      </main>
    );
  }

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
              Zero-Knowledge Architecture
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
              Everything
              <br />
              in its place.
            </h1>

            <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: '#cbe0d9' }}>
              Welcome back to your private vault. Access your personal media gallery, documents, and
              archived files with secure high-speed cloud storage.
            </p>
          </div>
        </div>

        {/* Feature badges */}
        <div style={{ display: 'grid', gap: '1rem', marginTop: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#e0ece8', fontSize: '0.9rem' }}>
            <div style={{ background: 'rgba(215, 232, 126, 0.15)', padding: '0.4rem', borderRadius: '0.5rem', color: 'var(--lime)' }}>
              <Cloud size={18} />
            </div>
            <span>Encrypted cloud streaming with zero file compression</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#e0ece8', fontSize: '0.9rem' }}>
            <div style={{ background: 'rgba(215, 232, 126, 0.15)', padding: '0.4rem', borderRadius: '0.5rem', color: 'var(--lime)' }}>
              <HardDrive size={18} />
            </div>
            <span>Full-fidelity image preview and batch file operations</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#e0ece8', fontSize: '0.9rem' }}>
            <div style={{ background: 'rgba(215, 232, 126, 0.15)', padding: '0.4rem', borderRadius: '0.5rem', color: 'var(--lime)' }}>
              <CheckCircle2 size={18} />
            </div>
            <span>Strict user data isolation and secure JWT session management</span>
          </div>
        </div>
      </section>

      {/* Login Form Area */}
      <section className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit} noValidate>
          {/* Header with Brand & Theme Switcher */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/login" className="brand">
              <span className="brand-mark">T</span>
              <span className="font-display">TeleVault</span>
            </Link>

            {/* LIGHT / DARK MODE TOGGLE */}
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

          <div>
            <p className="muted" style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              SECURE SIGN IN
            </p>
            <h2 className="font-display" style={{ fontSize: '1.75rem', letterSpacing: '-0.04em', margin: '0.2rem 0 0.35rem', fontWeight: 800 }}>
              Welcome back
            </h2>
            <p className="muted">Sign in to unlock and manage your vault files.</p>
          </div>

          {/* Identifier Field */}
          <div className="field">
            <label htmlFor="identifier">Email or Username</label>
            <div className="field-input-wrap has-icon-left">
              <span className="field-icon-left">
                <UserIcon size={17} />
              </span>
              <input
                id="identifier"
                type="text"
                placeholder="you@example.com or username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="field-input-wrap has-icon-left has-icon-right">
              <span className="field-icon-left">
                <Lock size={17} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

          {error && (
            <div className="error-box">
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <div>
                <span>{error}</span>
                {error.toLowerCase().includes('verify') && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <Link
                      className="link"
                      href="/verify-email"
                      style={{ fontSize: '0.82rem', textDecoration: 'underline' }}
                    >
                      Click here to enter verification code ➔
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            className="primary"
            style={{ width: '100%', marginTop: '1.4rem' }}
            disabled={loading || !identifier || !password}
          >
            {loading ? (
              <>Signing in...</>
            ) : (
              <>
                Sign In to Vault <ArrowRight size={17} />
              </>
            )}
          </button>

          <p className="muted" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            New to TeleVault?{' '}
            <Link className="link" href="/register">
              Create an account
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
