'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  User as UserIcon,
  AtSign,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  ArrowRight,
  HardDrive,
  Cloud,
  KeyRound,
  Sun,
  Moon,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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

  // Check if already authenticated
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

  // Password requirement rules
  const hasMinLength = form.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(form.password);
  const hasLowercase = /[a-z]/.test(form.password);
  const hasNumber = /[0-9]/.test(form.password);
  const hasSpecial = /[^A-Za-z0-9]/.test(form.password);

  const passedRequirementsCount = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length;

  const isPasswordValid =
    hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const isMatch = form.password === form.confirm && form.confirm.length > 0;
  const isFormValid =
    form.fullName.trim().length > 0 &&
    form.username.trim().length > 0 &&
    form.email.trim().includes('@') &&
    isPasswordValid &&
    isMatch;

  // Strength score
  const strengthLevel =
    passedRequirementsCount <= 2
      ? { label: 'Weak', color: '#f43f5e', percent: 25 }
      : passedRequirementsCount <= 4
      ? { label: 'Medium', color: '#f59e0b', percent: 65 }
      : { label: 'Strong & Secure', color: '#10b981', percent: 100 };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      return setError('Please fulfill all password requirements.');
    }
    if (!isMatch) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    try {
      const normalizedEmail = form.email.trim().toLowerCase();
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          email: normalizedEmail,
          password: form.password,
        }),
      });

      sessionStorage.setItem('verifyEmail', normalizedEmail);
      router.push('/verify-email');
    } catch (err) {
      setError((err as Error).message || 'Registration failed. Please try again.');
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
      {/* Brand & Showcase Aside */}
      <section className="auth-aside">
        <div>
          <Link href="/login" className="brand">
            <span className="brand-mark">T</span>
            <span className="font-display">TeleVault</span>
          </Link>

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
              <KeyRound size={14} />
              Private & Encrypted Storage
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
              Your personal
              <br />
              digital vault.
            </h1>

            <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: '#cbe0d9' }}>
              Create your account to start storing and streaming unlimited photos, documents, and media
              securely in your private cloud vault.
            </p>
          </div>
        </div>

        {/* Aside Features list */}
        <div style={{ display: 'grid', gap: '1rem', marginTop: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#e0ece8', fontSize: '0.9rem' }}>
            <div style={{ background: 'rgba(215, 232, 126, 0.15)', padding: '0.4rem', borderRadius: '0.5rem', color: 'var(--lime)' }}>
              <ShieldCheck size={18} />
            </div>
            <span>Zero file compression & full high-resolution preservation</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#e0ece8', fontSize: '0.9rem' }}>
            <div style={{ background: 'rgba(215, 232, 126, 0.15)', padding: '0.4rem', borderRadius: '0.5rem', color: 'var(--lime)' }}>
              <Cloud size={18} />
            </div>
            <span>Stream directly to your private, encrypted cloud vault</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#e0ece8', fontSize: '0.9rem' }}>
            <div style={{ background: 'rgba(215, 232, 126, 0.15)', padding: '0.4rem', borderRadius: '0.5rem', color: 'var(--lime)' }}>
              <HardDrive size={18} />
            </div>
            <span>Fast multi-select batch download & instant search filters</span>
          </div>
        </div>
      </section>

      {/* Registration Form Area */}
      <section className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit} noValidate>
          {/* Mobile Header with Brand & Theme Switcher */}
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
              CREATE ACCOUNT
            </p>
            <h2 className="font-display" style={{ fontSize: '1.75rem', letterSpacing: '-0.04em', margin: '0.2rem 0 0.35rem', fontWeight: 800 }}>
              Start with TeleVault
            </h2>
            <p className="muted">We will send a 6-digit verification code to your email.</p>
          </div>

          {/* Full Name */}
          <div className="field">
            <label htmlFor="fullName">Full Name</label>
            <div className="field-input-wrap has-icon-left">
              <span className="field-icon-left">
                <UserIcon size={17} />
              </span>
              <input
                id="fullName"
                type="text"
                placeholder="e.g. Alex Morgan"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
                autoComplete="name"
              />
            </div>
          </div>

          {/* Username */}
          <div className="field">
            <label htmlFor="username">Username</label>
            <div className="field-input-wrap has-icon-left">
              <span className="field-icon-left">
                <AtSign size={17} />
              </span>
              <input
                id="username"
                type="text"
                placeholder="alexmorgan"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* Email */}
          <div className="field">
            <label htmlFor="email">Email Address</label>
            <div className="field-input-wrap has-icon-left">
              <span className="field-icon-left">
                <Mail size={17} />
              </span>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="field-input-wrap has-icon-left has-icon-right">
              <span className="field-icon-left">
                <Lock size={17} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onFocus={() => setPasswordFocused(true)}
                required
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

          {/* Password Requirements Card */}
          {(passwordFocused || form.password.length > 0) && (
            <div className="password-requirements-card">
              <div className="header">
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
                  Password Strength: <strong style={{ color: strengthLevel.color }}>{strengthLevel.label}</strong>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {passedRequirementsCount}/5 met
                </span>
              </div>

              <div className="strength-meter-bar">
                <div
                  className="strength-meter-fill"
                  style={{
                    width: `${strengthLevel.percent}%`,
                    backgroundColor: strengthLevel.color,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gap: '0.2rem' }}>
                <div className={`requirement-item ${hasMinLength ? 'valid' : ''}`}>
                  <span className="requirement-icon">
                    {hasMinLength ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
                  </span>
                  <span>At least 8 characters</span>
                </div>

                <div className={`requirement-item ${hasUppercase ? 'valid' : ''}`}>
                  <span className="requirement-icon">
                    {hasUppercase ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
                  </span>
                  <span>At least one uppercase letter (A-Z)</span>
                </div>

                <div className={`requirement-item ${hasLowercase ? 'valid' : ''}`}>
                  <span className="requirement-icon">
                    {hasLowercase ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
                  </span>
                  <span>At least one lowercase letter (a-z)</span>
                </div>

                <div className={`requirement-item ${hasNumber ? 'valid' : ''}`}>
                  <span className="requirement-icon">
                    {hasNumber ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
                  </span>
                  <span>At least one number (0-9)</span>
                </div>

                <div className={`requirement-item ${hasSpecial ? 'valid' : ''}`}>
                  <span className="requirement-icon">
                    {hasSpecial ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
                  </span>
                  <span>At least one special character (!@#$%^&*)</span>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Password */}
          <div className="field">
            <label htmlFor="confirm">Confirm Password</label>
            <div className="field-input-wrap has-icon-left has-icon-right">
              <span className="field-icon-left">
                <Lock size={17} />
              </span>
              <input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="field-icon-right-btn"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {form.confirm.length > 0 && (
              <p
                style={{
                  fontSize: '0.78rem',
                  marginTop: '0.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: isMatch ? 'var(--success)' : 'var(--danger)',
                  fontWeight: 600,
                }}
              >
                {isMatch ? <Check size={13} /> : <X size={13} />}
                {isMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          {error && (
            <div className="error-box">
              <span>{error}</span>
            </div>
          )}

          <button
            className="primary"
            style={{ width: '100%', marginTop: '1.4rem' }}
            disabled={loading || !isFormValid}
          >
            {loading ? (
              <>Sending verification code...</>
            ) : (
              <>
                Create Account <ArrowRight size={17} />
              </>
            )}
          </button>

          <p className="muted" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            Already have an account?{' '}
            <Link className="link" href="/login">
              Sign in here
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
